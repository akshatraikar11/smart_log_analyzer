function StatsPanel({ stats, onRefresh }) {
  if (!stats || !stats.overall) {
    return null
  }

  const { overall, severityBreakdown } = stats
  const maxCount = Math.max(1, ...(severityBreakdown || []).map((s) => s.count))

  return (
    <>
      <div className="rail-head">
        <h2>Counters</h2>
        <button className="secondary" onClick={onRefresh}>reload</button>
      </div>

      <dl className="metric-list">
        <div className="metric">
          <dt>logs</dt>
          <dd>{(overall?.totalLogs ?? 0).toLocaleString()}</dd>
        </div>
        <div className="metric is-flag">
          <dt>flagged</dt>
          <dd>{(overall?.totalFlags ?? 0).toLocaleString()}</dd>
        </div>
        <div className="metric">
          <dt>sources</dt>
          <dd>{overall?.uniqueSources ?? 0}</dd>
        </div>
        <div className="metric">
          <dt>events</dt>
          <dd>{overall?.uniqueEventTypes ?? 0}</dd>
        </div>
      </dl>

      {severityBreakdown && severityBreakdown.length > 0 && (
        <div className="sev-list">
          <h3>mix</h3>
          {severityBreakdown.map((item) => (
            <div key={item.severity} className={`sev-row ${item.severity}`}>
              <span className={`severity-badge severity-${item.severity}`}>{item.severity}</span>
              <div className="sev-bar">
                <span style={{ width: `${Math.round((item.count / maxCount) * 100)}%` }} />
              </div>
              <span className="n">{item.count}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export default StatsPanel
