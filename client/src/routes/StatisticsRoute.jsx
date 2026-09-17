export default function StatisticsRoute({ statistics }) {
  return <section className="workspacePanel" aria-labelledby="statistics-heading">
    <div className="workspaceHeading"><div><p className="eyebrow">On this device</p><h2 id="statistics-heading">Reading statistics</h2><p>Local activity only. Reading time stops counting after five idle minutes.</p></div></div>
    <div className="statGrid">
      <Stat label="Books completed" value={statistics.completedBooks} />
      <Stat label="Reading time" value={formatDuration(statistics.totalReadingTimeMs)} />
      <Stat label="Current streak" value={`${statistics.currentStreakDays} ${statistics.currentStreakDays === 1 ? 'day' : 'days'}`} />
      <Stat label="Active days" value={statistics.activeDays} />
      <Stat label="PDF page visits" value={`≈ ${statistics.pdfPagesVisitedEstimate}`} />
      <Stat label="EPUB location changes" value={`≈ ${statistics.epubLocationChanges}`} />
    </div>
    <p className="metricNote">Page visits can repeat across reading sessions. EPUB reflow has no stable page count, so the app reports location changes instead of pretending they are pages.</p>
    <h3>Monthly activity</h3>
    {!statistics.monthlyActivity.length ? <p className="emptyState">Reading activity will appear after you open a book.</p> : <div className="tableScroller"><table className="activityTable"><thead><tr><th>Month</th><th>Time</th><th>Sessions</th><th>Active days</th></tr></thead><tbody>{statistics.monthlyActivity.map((month) => <tr key={month.month}><th>{month.month}</th><td>{formatDuration(month.durationMs)}</td><td>{month.sessions}</td><td>{month.activeDays}</td></tr>)}</tbody></table></div>}
  </section>
}

function Stat({ label, value }) {
  return <article><span>{label}</span><strong>{value}</strong></article>
}

function formatDuration(milliseconds) {
  const minutes = Math.round(milliseconds / 60_000)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
