/**
 * LiveIndicator – pulsing dot that shows WebSocket connection status
 */

function LiveIndicator({ connected }) {
  return (
    <span className={`live-indicator ${connected ? 'is-live' : 'is-offline'}`}>
      <span className="live-dot" />
      {connected ? 'live' : 'offline'}
    </span>
  )
}

export default LiveIndicator
