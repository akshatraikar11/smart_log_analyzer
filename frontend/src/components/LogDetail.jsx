import { useState, useEffect } from 'react'
import { anomaliesAPI } from '../services/api'
import SeverityIndicator from './SeverityIndicator'

function LogDetail({ log, onClose }) {
  const [generating, setGenerating] = useState(false)
  const [aiExplanation, setAiExplanation] = useState({
    explanation: log.ai_explanation,
    rootCause: log.ai_root_cause,
    nextSteps: log.ai_next_steps,
    processedAt: log.ai_processed_at
  })
  const [error, setError] = useState(null)

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A'
    const date = new Date(timestamp)
    const pad = (n) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }

  const handleGenerateExplanation = async () => {
    setGenerating(true)
    setError(null)
    
    try {
      const response = await anomaliesAPI.explainAnomaly(log.id)
      
      if (response.success) {
        setAiExplanation({
          explanation: response.data.explanation,
          rootCause: response.data.rootCause,
          nextSteps: response.data.nextSteps,
          processedAt: new Date().toISOString()
        })
      } else {
        setError(response.message || 'Failed to generate explanation')
      }
    } catch (err) {
      console.error('Failed to generate AI explanation:', err)
      setError(err.response?.data?.message || 'Failed to generate AI explanation')
    } finally {
      setGenerating(false)
    }
  }

  const parseNextSteps = (nextSteps) => {
    if (!nextSteps) return []
    
    // Split by newlines and filter empty lines
    const lines = nextSteps.split('\n').filter(line => line.trim())
    
    // Extract bullet points or numbered items
    return lines.map(line => {
      // Remove common prefixes like -, *, 1., etc.
      return line.replace(/^[-*•]\s*|\d+\.\s*/g, '').trim()
    }).filter(line => line.length > 0)
  }

  return (
    <aside className="inspector">
        <div className="inspector-head">
          <div>
            <h2>inspect</h2>
            <p className="id-line">{log.id}</p>
          </div>
          <button className="secondary" onClick={onClose}>
            esc
          </button>
        </div>

        <div className="inspector-body">
          <div className="detail-section">
            <h3>Record</h3>
            <dl className="kv">
              <dt>time</dt>
              <dd className="mono">{formatTimestamp(log.timestamp)}</dd>
              <dt>sev</dt>
              <dd><SeverityIndicator severity={log.severity} /></dd>
              <dt>src</dt>
              <dd className="mono">{log.source}</dd>
              <dt>event</dt>
              <dd className="mono">{log.event_type}</dd>
            </dl>

            {log.message && (
              <div className="raw-block">
                <label>
                  Message
                </label>
                <div className="raw-text">
                  {log.message}
                </div>
              </div>
            )}

            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <div className="raw-block">
                <label>
                  Metadata
                </label>
                <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
              </div>
            )}
          </div>

          {/* Anomaly Detection Results */}
          {log.is_flagged && (
            <div className="detail-section">
              <h3>rules</h3>
              <div className="detection-block">
                <div className="detection-meta">
                  <div>
                    <div className="detail-item">
                      <label>
                      Anomaly Score
                      </label>
                    </div>
                    <div className="score">
                      {Math.round(log.anomaly_score)}/100
                    </div>
                  </div>
                  <div className="algo">
                    <div className="detail-item">
                      <label>Triggered Rules</label>
                    </div>
                    <div>{log.detection_algorithm}</div>
                  </div>
                </div>

                <div>
                  <div className="detail-item">
                    <label>
                    Detection Reason
                    </label>
                  </div>
                  <div className="detection-reason">
                    {log.detection_reason}
                  </div>
                </div>

                {log.flagged_at && (
                  <div className="flagged-at">
                    Flagged at: {formatTimestamp(log.flagged_at)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Explanation Section */}
          {log.is_flagged && (
            <div className="detail-section">
              <div className="section-head">
                <h3>llm</h3>
                {!aiExplanation.processedAt && (
                  <button 
                    className="primary" 
                    onClick={handleGenerateExplanation}
                    disabled={generating}
                  >
                    {generating ? 'Generating...' : 'Generate explanation'}
                  </button>
                )}
                {aiExplanation.processedAt && (
                  <button 
                    className="secondary" 
                    onClick={handleGenerateExplanation}
                    disabled={generating}
                  >
                    {generating ? 'Regenerating...' : 'Regenerate'}
                  </button>
                )}
              </div>

              {error && (
                <div className="error" style={{ marginBottom: '8px', marginLeft: 0, marginRight: 0 }}>
                  {error}
                </div>
              )}

              {aiExplanation.processedAt ? (
                <div className="ai-callout">
                  <div className="ai-callout-label">AI Explanation</div>
                  <div className="ai-callout-body">
                  <div>
                    <h4>Plain-English Explanation</h4>
                    <p>{aiExplanation.explanation}</p>
                  </div>

                  <div>
                    <h4>Likely Root Cause</h4>
                    <p>{aiExplanation.rootCause}</p>
                  </div>

                  <div>
                    <h4>Recommended Next Steps</h4>
                    {parseNextSteps(aiExplanation.nextSteps).length > 0 ? (
                      <ul>
                        {parseNextSteps(aiExplanation.nextSteps).map((step, index) => (
                          <li key={index}>{step}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>{aiExplanation.nextSteps}</p>
                    )}
                  </div>

                  <div className="ai-stamp">
                    Generated at: {formatTimestamp(aiExplanation.processedAt)}
                  </div>
                  </div>
                </div>
              ) : (
                <div className="ai-empty">
                  AI explanation not yet generated. Trigger one request to store it with this anomaly.
                </div>
              )}
            </div>
          )}

          {/* Metadata Section */}
          <div className="detail-section">
            <h3>ingest</h3>
            <dl className="kv">
              <dt>created</dt>
              <dd className="mono">{formatTimestamp(log.created_at)}</dd>
              {log.is_flagged && (
                <>
                  <dt>state</dt>
                  <dd className="mono" style={{ color: '#c23b22', fontWeight: 600 }}>FLAGGED</dd>
                </>
              )}
            </dl>
          </div>
        </div>
    </aside>
  )
}

export default LogDetail
