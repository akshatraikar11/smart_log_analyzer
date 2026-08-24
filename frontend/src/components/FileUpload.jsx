import { useState } from 'react'

function FileUpload({ onSuccess }) {
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        setResult({
          type: 'success',
          message: `✅ ${data.message}`,
          details: `Ingested: ${data.ingestion.successful}/${data.ingestion.total} | Flagged: ${data.detection.flagged}`
        })
        if (onSuccess) setTimeout(onSuccess, 1500)
      } else {
        setResult({
          type: 'error',
          message: data.message || 'Upload failed'
        })
      }
    } catch (err) {
      setResult({
        type: 'error',
        message: 'Upload failed: ' + err.message
      })
    } finally {
      setUploading(false)
      e.target.value = '' // Reset input
    }
  }

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <label 
        htmlFor="file-upload"
        style={{
          display: 'inline-block',
          padding: '0.75rem 1.5rem',
          background: uploading ? '#94a3b8' : '#667eea',
          color: 'white',
          borderRadius: '4px',
          cursor: uploading ? 'not-allowed' : 'pointer',
          fontSize: '0.875rem',
          fontWeight: '600',
          transition: 'all 0.2s'
        }}
      >
        {uploading ? '⏳ Uploading...' : '📁 Upload Log File (CSV/JSON/TXT)'}
      </label>
      <input
        id="file-upload"
        type="file"
        accept=".csv,.json,.txt,.log"
        onChange={handleFileUpload}
        disabled={uploading}
        style={{ display: 'none' }}
      />
      
      {result && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.75rem',
          borderRadius: '4px',
          fontSize: '0.875rem',
          background: result.type === 'success' ? '#d1fae5' : '#fed7d7',
          color: result.type === 'success' ? '#065f46' : '#991b1b',
          borderLeft: `4px solid ${result.type === 'success' ? '#10b981' : '#dc2626'}`
        }}>
          <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
            {result.message}
          </div>
          {result.details && (
            <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
              {result.details}
            </div>
          )}
        </div>
      )}
      
      <div style={{ 
        marginTop: '0.5rem', 
        fontSize: '0.75rem', 
        color: '#718096' 
      }}>
        Supports CSV, JSON, TXT files • Max 10MB • Sample files in /sample-data
      </div>
    </div>
  )
}

export default FileUpload
