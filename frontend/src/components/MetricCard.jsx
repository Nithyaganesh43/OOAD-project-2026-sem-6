const MetricCard = ({ label, value }) => {
  return (
    <article className="metric-card">
      <p className="muted small">{label}</p>
      <p className="metric-value">{value}</p>
    </article>
  )
}

export default MetricCard
