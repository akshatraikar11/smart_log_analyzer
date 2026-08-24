/**
 * AnomalyToast – slide-in notification cards for real-time anomaly alerts
 */

function AnomalyToast({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null

  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-anomaly sev-${t.severity}`}>
          <div className="toast-header">
            <span className={`severity-badge severity-${t.severity}`}>{t.severity}</span>
            <span className="toast-score">score {t.score}</span>
            <button className="toast-close" onClick={() => onDismiss(t.id)} aria-label="Dismiss">
              ×
            </button>
          </div>
          <div className="toast-body">
            <span className="toast-source">{t.source}</span>
            <span className="toast-sep">›</span>
            <span className="toast-event">{t.eventType}</span>
          </div>
          <div className="toast-algo">{t.algorithm}</div>
        </div>
      ))}
    </div>
  )
}

export default AnomalyToast
