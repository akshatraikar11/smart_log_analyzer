import { useState } from 'react'
import { logsAPI } from '../services/api'

function LogIngestionForm({ onSuccess }) {
  const [formData, setFormData] = useState({
    timestamp: new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:MM
    event_type: '',
    severity: 'INFO',
    source: '',
    message: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Convert datetime-local to ISO format
      const logData = {
        ...formData,
        timestamp: new Date(formData.timestamp).toISOString()
      }

      const response = await logsAPI.ingestLogs(logData)
      
      if (response.success) {
        setSuccess(true)
        // Reset form
        setFormData({
          timestamp: new Date().toISOString().slice(0, 16),
          event_type: '',
          severity: 'INFO',
          source: '',
          message: ''
        })
        
        // Notify parent component
        if (onSuccess) {
          setTimeout(() => onSuccess(), 1000)
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to ingest log')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div style={{ 
      background: 'white', 
      padding: '1.5rem', 
      borderRadius: '8px', 
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      marginBottom: '2rem'
    }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#2d3748' }}>
        📝 Ingest New Log Entry
      </h2>

      {success && (
        <div style={{
          background: '#d1fae5',
          color: '#065f46',
          padding: '0.75rem',
          borderRadius: '4px',
          marginBottom: '1rem',
          borderLeft: '4px solid #10b981'
        }}>
          ✅ Log ingested successfully! Anomaly detection running...
        </div>
      )}

      {error && (
        <div className="error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          <div className="filter-group">
            <label>Timestamp *</label>
            <input
              type="datetime-local"
              name="timestamp"
              value={formData.timestamp}
              onChange={handleChange}
              required
            />
          </div>

          <div className="filter-group">
            <label>Severity *</label>
            <select
              name="severity"
              value={formData.severity}
              onChange={handleChange}
              required
            >
              <option value="DEBUG">DEBUG</option>
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="ERROR">ERROR</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Event Type *</label>
            <input
              type="text"
              name="event_type"
              value={formData.event_type}
              onChange={handleChange}
              placeholder="e.g., USER_LOGIN, DATABASE_ERROR"
              required
            />
          </div>

          <div className="filter-group">
            <label>Source *</label>
            <input
              type="text"
              name="source"
              value={formData.source}
              onChange={handleChange}
              placeholder="e.g., api-service, auth-service"
              required
            />
          </div>

          <div className="filter-group" style={{ gridColumn: '1 / -1' }}>
            <label>Message</label>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              placeholder="Optional log message"
              rows="3"
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid #cbd5e0',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            type="submit" 
            className="primary"
            disabled={loading}
          >
            {loading ? '⏳ Ingesting...' : '📥 Ingest Log'}
          </button>
          
          <button 
            type="button"
            className="secondary"
            onClick={() => {
              setFormData({
                timestamp: new Date().toISOString().slice(0, 16),
                event_type: '',
                severity: 'INFO',
                source: '',
                message: ''
              })
              setError(null)
              setSuccess(false)
            }}
          >
            Clear
          </button>

          <span style={{ fontSize: '0.875rem', color: '#718096' }}>
            * Required fields
          </span>
        </div>
      </form>

      <div style={{ 
        marginTop: '1.5rem', 
        padding: '1rem', 
        background: '#f7fafc', 
        borderRadius: '4px',
        fontSize: '0.875rem',
        color: '#4a5568'
      }}>
        <strong>💡 Quick Examples:</strong>
        <ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
          <li><strong>Normal:</strong> INFO, USER_LOGIN, auth-service</li>
          <li><strong>Error:</strong> ERROR, DATABASE_CONNECTION, api-service</li>
          <li><strong>Critical:</strong> CRITICAL, DISK_FULL, worker-service</li>
        </ul>
      </div>
    </div>
  )
}

export default LogIngestionForm
