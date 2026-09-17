import { READING_STATUSES } from '../../domain/books/book.js'
import { localDateKey } from './ReadingActivityTracker.js'

export function calculateLibraryStatistics({ books = [], activities = [], today = new Date() } = {}) {
  const days = [...new Set(activities.map((item) => item.localDate).filter(Boolean))].sort()
  const monthly = new Map()
  for (const activity of activities) {
    const month = String(activity.localDate || '').slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(month)) continue
    const current = monthly.get(month) || { month, sessions: 0, durationMs: 0, activeDays: new Set() }
    current.sessions += 1
    current.durationMs += safeNumber(activity.durationMs)
    current.activeDays.add(activity.localDate)
    monthly.set(month, current)
  }
  return {
    completedBooks: books.filter((book) => book.readingStatus === READING_STATUSES.COMPLETED).length,
    totalReadingTimeMs: activities.reduce((sum, item) => sum + safeNumber(item.durationMs), 0),
    pdfPagesVisitedEstimate: activities.reduce((sum, item) => sum + safeNumber(item.pdfPagesVisited), 0),
    epubLocationChanges: activities.reduce((sum, item) => sum + safeNumber(item.epubLocationChanges), 0),
    activeDays: days.length,
    currentStreakDays: calculateStreak(days, today),
    monthlyActivity: [...monthly.values()]
      .sort((a, b) => b.month.localeCompare(a.month))
      .map(({ activeDays, ...item }) => ({ ...item, activeDays: activeDays.size })),
  }
}

function calculateStreak(dayKeys, today) {
  if (!dayKeys.length) return 0
  const available = new Set(dayKeys)
  const cursor = dateFromLocalKey(localDateKey(today))
  if (!available.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  if (!available.has(localDateKey(cursor))) return 0
  let streak = 0
  while (available.has(localDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function dateFromLocalKey(key) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function safeNumber(value) {
  return Number.isFinite(value) && value > 0 ? value : 0
}
