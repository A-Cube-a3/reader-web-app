import { describe, expect, it } from 'vitest'
import { updateBookOrganization } from './book.js'

describe('book organization', () => {
  it('updates status and favorite while preserving the application identity', () => {
    const book = { id: 'local-id', readingStatus: 'want-to-read', favorite: false, updatedAt: '2026-09-16T00:00:00.000Z' }
    expect(updateBookOrganization(book, { readingStatus: 'currently-reading', favorite: true }, '2026-09-17T00:00:00.000Z'))
      .toEqual({ ...book, readingStatus: 'currently-reading', favorite: true, updatedAt: '2026-09-17T00:00:00.000Z' })
    expect(updateBookOrganization(book, { readingStatus: 'want-to-read', favorite: false })).toBe(book)
    expect(() => updateBookOrganization(book, { readingStatus: 'later' })).toThrow(/unsupported/)
  })
})
