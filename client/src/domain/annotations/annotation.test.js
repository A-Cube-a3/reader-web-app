import { describe, expect, it } from 'vitest'
import {
  createBookmark,
  createHighlight,
  createNote,
  updateNote,
} from './annotation.js'

const ids = {
  record: '11111111-1111-4111-8111-111111111111',
  book: '22222222-2222-4222-8222-222222222222',
  highlight: '33333333-3333-4333-8333-333333333333',
}
const now = '2026-09-10T00:00:00.000Z'
const locator = {
  version: 1,
  format: 'pdf',
  progression: 0.5,
  pdf: {
    page: 2,
    pageCount: 3,
    textQuote: { exact: 'Selected text', prefix: 'Before', suffix: 'After' },
    geometry: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.04 }],
  },
}

describe('offline annotation records', () => {
  it('creates bookmarks with stable locators and useful fallback labels', () => {
    expect(createBookmark({ id: ids.record, bookId: ids.book, locator, now })).toMatchObject({
      label: 'Page 2',
      locator,
    })
  })

  it('requires a robust selected-text anchor for highlights', () => {
    expect(createHighlight({ id: ids.record, bookId: ids.book, locator, color: 'green', now }))
      .toMatchObject({ color: 'green', quote: { exact: 'Selected text' } })
    expect(() => createHighlight({
      id: ids.record,
      bookId: ids.book,
      locator: { ...locator, pdf: { page: 2, pageCount: 3 } },
      now,
    })).toThrow(/anchored text/)
  })

  it('creates book/location/highlight notes and validates edits', () => {
    const note = createNote({
      id: ids.record,
      bookId: ids.book,
      highlightId: ids.highlight,
      locator,
      body: 'My note\nwith context',
      now,
    })
    expect(note).toMatchObject({ body: 'My note\nwith context', highlightId: ids.highlight, locator })
    expect(updateNote(note, 'Edited note', '2026-09-10T01:00:00.000Z'))
      .toMatchObject({ body: 'Edited note', updatedAt: '2026-09-10T01:00:00.000Z' })
    expect(() => updateNote(note, '   ', now)).toThrow(/cannot be empty/)
  })
})
