import { describe, expect, it } from 'vitest'
import { ReadingActivityTracker } from './ReadingActivityTracker.js'
import { calculateLibraryStatistics } from './libraryStatistics.js'

const bookId = '11111111-1111-4111-8111-111111111111'

describe('local reading statistics', () => {
  it('bounds idle time and counts distinct PDF pages within a session', async () => {
    const records = new Map()
    const moments = [new Date(2026, 8, 17, 10, 0), new Date(2026, 8, 17, 10, 2), new Date(2026, 8, 17, 10, 20)]
    const tracker = new ReadingActivityTracker({ repository: { put: async (record) => records.set(record.id, { ...record }) }, idFactory: () => '22222222-2222-4222-8222-222222222222', clock: () => moments.shift(), idleLimitMs: 5 * 60_000 })
    const session = await tracker.start({ book: { id: bookId, format: 'pdf' }, locator: pdfLocator(1) })
    session.recordLocation(pdfLocator(2))
    await session.close()
    expect([...records.values()][0]).toMatchObject({ durationMs: 7 * 60_000, pdfPagesVisited: 2 })
  })

  it('reports honest streaks, monthly totals, and format-specific movement', () => {
    const statistics = calculateLibraryStatistics({ books: [{ readingStatus: 'completed' }, { readingStatus: 'want-to-read' }], today: new Date(2026, 8, 17, 12), activities: [
      { localDate: '2026-09-17', durationMs: 60_000, pdfPagesVisited: 2, epubLocationChanges: 0 },
      { localDate: '2026-09-16', durationMs: 120_000, pdfPagesVisited: 0, epubLocationChanges: 3 },
      { localDate: '2026-09-14', durationMs: 60_000, pdfPagesVisited: 1, epubLocationChanges: 0 },
    ] })
    expect(statistics).toMatchObject({ completedBooks: 1, totalReadingTimeMs: 240_000, currentStreakDays: 2, activeDays: 3, pdfPagesVisitedEstimate: 3, epubLocationChanges: 3 })
    expect(statistics.monthlyActivity[0]).toMatchObject({ month: '2026-09', sessions: 3, activeDays: 3 })
  })
})

function pdfLocator(page) {
  return { version: 1, format: 'pdf', progression: (page - 1) / 2, pdf: { page, pageCount: 3 } }
}
