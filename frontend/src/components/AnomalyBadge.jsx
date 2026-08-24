function AnomalyBadge({ score }) {
  const displayScore = score != null && score !== '' ? Math.round(Number(score)) : null

  return (
    <span className="anomaly-badge">
      Flagged
      {displayScore !== null && <span className="score">{displayScore}</span>}
    </span>
  )
}

export default AnomalyBadge
