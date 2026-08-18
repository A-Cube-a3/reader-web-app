import { describe, expect, it } from 'vitest'
import { filterLibrary, getContinueReading, getRecentBooks } from './libraryView.js'

const books = [
  book({ id: 'pdf', title: 'Café Design', author: 'Ada', format: 'pdf', importedAt: '2026-01-01' }),
  book({ id: 'epub', title: 'Local Systems', publisher: 'Cube Press', format: 'epub', importedAt: '2026-02-01' }),
  book({ id: 'done', title: 'Finished', format: 'epub', importedAt: '2025-12-01', lastOpenedAt: '2026-03-02', readingStatus: 'completed' }),
  book({
    id: 'reading',
    title: 'In Progress',
    format: 'pdf',
    importedAt: '2026-01-15',
    progress: { progression: 0.4, updatedAt: '2026-03-01' },
    lastOpenedAt: '2026-03-03',
  }),
]

describe('library views', () => {
  it('searches local metadata case- and accent-insensitively', () => {
    expect(filterLibrary(books, { query: 'CAFE' }).map(({ id }) => id)).toEqual(['pdf'])
    expect(filterLibrary(books, { query: 'cube press' }).map(({ id }) => id)).toEqual(['epub'])
  })

  it('combines metadata search and format filters', () => {
    expect(filterLibrary(books, { query: 'local', format: 'epub' }).map(({ id }) => id))
      .toEqual(['epub'])
    expect(filterLibrary(books, { query: 'local', format: 'pdf' })).toEqual([])
  })

  it('derives continue-reading and recent sections from local timestamps', () => {
    expect(getContinueReading(books).map(({ id }) => id)).toEqual(['reading'])
    expect(getRecentBooks(books).map(({ id }) => id)).toEqual(['reading', 'done', 'epub', 'pdf'])
  })
})

function book(overrides) {
  return { author: '', publisher: '', language: '', identifier: '', description: '', ...overrides }
}
