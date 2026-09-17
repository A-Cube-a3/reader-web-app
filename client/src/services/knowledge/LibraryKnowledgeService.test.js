import { describe, expect, it } from 'vitest'
import { LibraryKnowledgeService } from './LibraryKnowledgeService.js'

const ids = {
  book: '11111111-1111-4111-8111-111111111111',
  collection: '22222222-2222-4222-8222-222222222222',
  highlight: '33333333-3333-4333-8333-333333333333',
  note: '44444444-4444-4444-8444-444444444444',
}
const now = '2026-09-17T12:00:00.000Z'
const locator = { version: 1, format: 'pdf', progression: 0, pdf: { page: 1, pageCount: 2, textQuote: { exact: 'Anchor', prefix: '', suffix: '' } } }

describe('LibraryKnowledgeService', () => {
  it('organizes books and aggregates offline knowledge', async () => {
    const harness = createHarness()
    const collection = await harness.service.createCollection('Research')
    await harness.service.setBookInCollection(collection.id, ids.book, true)
    await harness.service.updateBookOrganization(ids.book, { readingStatus: 'completed', favorite: true })
    await harness.service.updateTags('note', ids.note, ['Idea'])
    const snapshot = await harness.service.load()
    expect(snapshot.collections[0].bookIds).toEqual([ids.book])
    expect(snapshot.books[0]).toMatchObject({ readingStatus: 'completed', favorite: true })
    expect(snapshot.tags).toEqual(['idea'])
    expect(snapshot.statistics.completedBooks).toBe(1)
  })

  it('preserves linked note anchors when deleting a highlight', async () => {
    const harness = createHarness()
    await harness.service.deleteHighlight(ids.highlight)
    expect(await harness.notes.get(ids.note)).toMatchObject({ highlightId: null, locator })
    expect(await harness.highlights.get(ids.highlight)).toBeUndefined()
  })
})

function createHarness() {
  const books = memoryRepository([{ id: ids.book, title: 'Local', format: 'pdf', readingStatus: 'want-to-read', favorite: false }])
  const collections = memoryRepository([])
  const highlights = memoryRepository([{ id: ids.highlight, bookId: ids.book, locator, quote: { exact: 'Anchor' }, tags: [], updatedAt: now }])
  const notes = memoryRepository([{ id: ids.note, bookId: ids.book, highlightId: ids.highlight, locator: null, body: 'Thought', tags: [], updatedAt: now }])
  notes.listByHighlight = async (id) => (await notes.list()).filter((item) => item.highlightId === id)
  const service = new LibraryKnowledgeService({
    booksRepository: books,
    collectionRepository: collections,
    highlightRepository: highlights,
    noteRepository: notes,
    activityRepository: { list: async () => [] },
    idFactory: () => ids.collection,
    clock: () => now,
  })
  return { service, notes, highlights }
}

function memoryRepository(initial) {
  const records = new Map(initial.map((record) => [record.id, record]))
  return {
    get: async (id) => records.get(id),
    list: async () => [...records.values()],
    listAll: async () => [...records.values()],
    add: async (record) => { records.set(record.id, record); return record },
    put: async (record) => { records.set(record.id, record); return record },
    delete: async (id) => records.delete(id),
  }
}
