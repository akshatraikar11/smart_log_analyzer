import { useState, useEffect, useCallback } from 'react'
import LogList from './components/LogList'
import LogDetail from './components/LogDetail'
import StatsPanel from './components/StatsPanel'
import QuickIngest from './components/QuickIngest'
import LiveIndicator from './components/LiveIndicator'
import AnomalyToast from './components/AnomalyToast'
import useSocket from './hooks/useSocket'
import { statsAPI, logsAPI } from './services/api'

function App() {
  const [stats, setStats] = useState(null)
  const [selectedLog, setSelectedLog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Real-time WebSocket connection
  const { connected, lastEvent, toasts, dismissToast } = useSocket()

  useEffect(() => {
    loadStats()
  }, [])

  // React to real-time events — auto-refresh stats + log list
  useEffect(() => {
    if (!lastEvent) return

    if (lastEvent.type === 'stats:update' || lastEvent.type === 'log:new') {
      // Re-fetch stats when new data arrives
      loadStats()
    }

    if (lastEvent.type === 'log:new' || lastEvent.type === 'anomaly:new') {
      // Bump the refresh key so LogList re-fetches
      setRefreshKey((prev) => prev + 1)
    }

    if (lastEvent.type === 'ai:complete' && selectedLog?.id === lastEvent.logId) {
      // If the user is looking at this exact log, refresh the detail panel
      handleLogClick(selectedLog.id)
    }
  }, [lastEvent])

  const loadStats = async () => {
    try {
      setLoading(true)
      const data = await statsAPI.getOverallStats()
      setStats(data)
      setError(null)
    } catch (err) {
      console.error('Failed to load stats:', err)
      setError('Backend unreachable — start the API on :3000.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogClick = async (logId) => {
    try {
      const response = await logsAPI.getLogById(logId)
      setSelectedLog(response.log)
    } catch (err) {
      console.error('Failed to load log details:', err)
    }
  }

  const handleRefresh = () => {
    loadStats()
    setRefreshKey((prev) => prev + 1)
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <span className="brand-mark">SLA</span>
          <h1>log stream</h1>
        </div>
        <div className="topbar-right">
          <QuickIngest onSuccess={handleRefresh} />
          <LiveIndicator connected={connected} />
          <span className="topbar-meta">detect · groq explain</span>
        </div>
      </div>

      {error && <div className="app-error">{error}</div>}

      <div className={`shell${selectedLog ? ' has-inspector' : ''}`}>
        <aside className="rail">
          {loading && !stats ? (
            <div className="loading">loading counters…</div>
          ) : (
            <StatsPanel stats={stats} onRefresh={handleRefresh} />
          )}
        </aside>

        <LogList
          key={refreshKey}
          onLogClick={handleLogClick}
          selectedId={selectedLog?.id}
        />

        {selectedLog && (
          <LogDetail log={selectedLog} onClose={() => setSelectedLog(null)} />
        )}
      </div>

      {/* Real-time anomaly toasts */}
      <AnomalyToast toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

export default App
