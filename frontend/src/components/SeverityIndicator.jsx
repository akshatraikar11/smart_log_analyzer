function SeverityIndicator({ severity }) {
  return (
    <span className={`severity-badge severity-${severity}`}>
      {severity}
    </span>
  )
}

export default SeverityIndicator
