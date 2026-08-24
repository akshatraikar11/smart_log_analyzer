import { useState, useEffect } from 'react'
import { logsAPI } from '../services/api'
import SeverityIndicator from './SeverityIndicator'
import AnomalyBadge from './AnomalyBadge'

function LogList({ onLogClick, selectedId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [severity, setSeverity] = useState('')
  const [source, setSource] = useState('')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const pageSize = 50

  // Auto-refresh when component mounts or remounts (key change)
  useEffect(() => {
    setPage(1) // Reset to page 1 on mount/refresh
    loadLogs()
  }, [])

  // Reload when filters or page changes
  useEffect(() => {
    loadLogs()
  }, [page, severity, source, flaggedOnly])

  const loadLogs = async () => {
    try {
      setLoading(true)
      const data = await logsAPI.getLogs({
        page,
        pageSize,
        ...(severity && { severity }),
        ...(source && { source }),
        flaggedOnly,
      })
      setLogs(data.logs)
      setTotalPages(data.totalPages)
      setTotal(data.total)
      setError(null)
      console.log(`✅ Loaded ${data.logs.length} logs (page ${page}, total ${data.total})`)
    } catch (err) {
      console.error('Failed to load logs:', err)
      setError('stream read failed')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (name, value) => {
    setPage(1)
    if (name === 'severity') setSeverity(value)
    if (name === 'source') setSource(value)
    if (name === 'flaggedOnly') setFlaggedOnly(value)
  }

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }

  return (
    <section className="stream">
      <div className="stream-toolbar">
        <div>
          <h2>tail</h2>
          <p className="logs-count">{logs.length}/{total}</p>
        </div>

        <div className="filters">
          <div className="filter-group">
            <label>sev</label>
            <select value={severity} onChange={(e) => handleFilterChange('severity', e.target.value)}>
              <option value="">*</option>
              <option value="CRITICAL">CRIT</option>
              <option value="ERROR">ERR</option>
              <option value="WARNING">WARN</option>
              <option value="INFO">INFO</option>
              <option value="DEBUG">DBG</option>
            </select>
          </div>
          <div className="filter-group">
            <label>src</label>
            <input
              type="text"
              placeholder="source"
              value={source}
              onChange={(e) => handleFilterChange('source', e.target.value)}
            />
          </div>
          <label className={`filter-check${flaggedOnly ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={(e) => handleFilterChange('flaggedOnly', e.target.checked)}
            />
            flagged
          </label>
          {(severity || source || flaggedOnly) && (
            <button
              className="secondary"
              onClick={() => {
                setSeverity('')
                setSource('')
                setFlaggedOnly(false)
                setPage(1)
              }}
            >
              reset
            </button>
          )}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <div className="loading">reading stream…</div>
      ) : logs.length === 0 ? (
        <div className="empty-state">no lines match</div>
      ) : (
        <>
          <div className="stream-body">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`log-line${log.is_flagged ? ' is-flagged' : ''}${selectedId === log.id ? ' is-active' : ''}`}
                onClick={() => onLogClick(log.id)}
              >
                <span className="ts">{formatTimestamp(log.timestamp)}</span>
                <SeverityIndicator severity={log.severity} />
                <span className="src">{log.source}</span>
                <span className="evt">{log.event_type}</span>
                <span className="msg">{log.message || <span className="msg-empty">—</span>}</span>
                {log.is_flagged ? (
                  <AnomalyBadge score={log.anomaly_score} algorithm={log.detection_algorithm} />
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button className="secondary" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
                older
              </button>
              <span>{page}/{totalPages}</span>
              <button className="secondary" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
                newer
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default LogList
