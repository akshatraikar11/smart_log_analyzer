import { useState, useRef, useEffect } from 'react'
import { logsAPI } from '../services/api'

const SOURCES = ['auth-service', 'payment-gateway', 'order-processor', 'inventory-db', 'api-gateway', 'worker-service']
const NORMAL_EVENTS = ['USER_LOGIN', 'ORDER_CREATED', 'PAYMENT_PROCESSED', 'TOKEN_REFRESHED', 'CACHE_HIT', 'DATABASE_QUERY']
const ANOMALIES = [
  { event_type: 'DATABASE_DEADLOCK', severity: 'CRITICAL', source: 'payment-gateway', message: 'Fatal: deadlock detected on relation "orders_pkey" during checkout' },
  { event_type: 'HTTP_500_BURST', severity: 'ERROR', source: 'api-gateway', message: 'HTTP 500 returned to 45 clients requesting /api/checkout' },
  { event_type: 'CONNECTION_POOL_EXHAUSTED', severity: 'CRITICAL', source: 'api-gateway', message: 'All 500 postgres pool connections in use. New requests queueing' },
  { event_type: 'MEMORY_LIMIT_EXCEEDED', severity: 'CRITICAL', source: 'order-processor', message: 'Heap out of memory: heap used 1.8GB / limit 2.0GB' },
  { event_type: 'AUTH_BURST_FAILURE', severity: 'ERROR', source: 'auth-service', message: 'Multiple failed password attempts for user admin from IP 198.51.100.42' }
]

function QuickIngest({ onSuccess }) {
  const [showModal, setShowModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const streamTimerRef = useRef(null)
  const countRef = useRef(0)

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current)
    }
  }, [])

  const toggleStream = () => {
    if (isStreaming) {
      clearInterval(streamTimerRef.current)
      streamTimerRef.current = null
      setIsStreaming(false)
    } else {
      setIsStreaming(true)
      streamTimerRef.current = setInterval(async () => {
        countRef.current += 1
        const isAnomaly = countRef.current % 4 === 0
        let log
        if (isAnomaly) {
          const sample = ANOMALIES[Math.floor(Math.random() * ANOMALIES.length)]
          log = {
            timestamp: new Date().toISOString(),
            ...sample
          }
        } else {
          const evt = NORMAL_EVENTS[Math.floor(Math.random() * NORMAL_EVENTS.length)]
          const src = SOURCES[Math.floor(Math.random() * SOURCES.length)]
          const sev = Math.random() > 0.8 ? 'WARNING' : 'INFO'
          log = {
            timestamp: new Date().toISOString(),
            event_type: evt,
            severity: sev,
            source: src,
            message: `Normal operational event: ${evt} completed successfully in 32ms`
          }
        }

        try {
          await logsAPI.ingestLogs(log)
        } catch (e) {
          console.warn('Stream ingestion error:', e.message)
        }
      }, 2200)
    }
  }

  const handleFileUpload = async (e) => {
    e.preventDefault()
    if (!selectedFile) {
      setStatusMsg('⚠️ Please select a CSV, JSON, or LOG file first')
      return
    }
    setLoading(true)
    setStatusMsg(null)
    try {
      const res = await logsAPI.uploadFile(selectedFile)
      const count = res.ingestion?.successful || res.successCount || 'all'
      const flagged = res.detection?.flagged || res.flaggedCount || 0
      setStatusMsg(`✅ Uploaded! Ingested ${count} logs, Flagged ${flagged} anomalies.`)
      
      setTimeout(() => {
        setShowModal(false)
        setStatusMsg(null)
        setSelectedFile(null)
        if (onSuccess) onSuccess()
      }, 1500)
    } catch (err) {
      setStatusMsg('❌ Upload failed: ' + (err.response?.data?.message || err.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button 
        onClick={toggleStream}
        style={{ 
          fontSize: '12px', 
          padding: '4px 10px', 
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          background: isStreaming ? '#c23b22' : '#1f6b63',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          borderRadius: '2px',
          boxShadow: isStreaming ? '0 0 10px rgba(194, 59, 34, 0.6)' : 'none',
          transition: 'all 0.2s ease'
        }}
      >
        {isStreaming ? '⏹ Stop Stream' : '⚡ Simulate Stream'}
      </button>

      <button 
        className="primary"
        onClick={() => setShowModal(true)}
        style={{ 
          fontSize: '12px', 
          padding: '4px 10px', 
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}
      >
        📤 Upload File
      </button>

      {showModal && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(10, 18, 24, 0.8)', 
          backdropFilter: 'blur(8px)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{ 
            background: 'var(--surface)', 
            border: '1px solid var(--line)',
            padding: '1.25rem', 
            borderRadius: '6px', 
            maxWidth: '560px',
            width: '94%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 16px 40px rgba(0,0,0,0.35)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, fontFamily: 'var(--font-mono)' }}>
                📤 Upload Log File
              </h3>
              <button 
                className="secondary" 
                onClick={() => { setShowModal(false); setStatusMsg(null); setSelectedFile(null); }}
                style={{ padding: '2px 8px', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>

            {/* File Upload Form */}
            <form onSubmit={handleFileUpload}>
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '0.75rem' }}>
                Select a <strong>.csv</strong>, <strong>.json</strong>, or <strong>.txt/.log</strong> file to upload and process:
              </p>
              <div style={{ 
                border: '2px dashed var(--line)', 
                padding: '1.25rem', 
                textAlign: 'center', 
                borderRadius: '4px',
                background: 'var(--paper)',
                marginBottom: '0.75rem'
              }}>
                <input 
                  type="file" 
                  accept=".json,.csv,.txt,.log"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}
                />
                {selectedFile && (
                  <div style={{ marginTop: '0.5rem', fontSize: '12px', color: 'var(--teal)' }}>
                    Selected: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>
              <button type="submit" className="primary" disabled={loading || !selectedFile} style={{ width: '100%' }}>
                {loading ? 'Uploading & Analyzing...' : 'Upload & Process Logs'}
              </button>
            </form>

            {/* Status Feedback */}
            {statusMsg && (
              <div style={{ marginTop: '0.75rem', fontSize: '13px', padding: '6px 8px', background: 'var(--paper)', fontFamily: 'var(--font-mono)' }}>
                {statusMsg}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default QuickIngest
