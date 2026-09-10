import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReaderToolsService, UnresolvedReadingAnchorError } from './ReaderToolsService.js'

const bookId = '11111111-1111-4111-8111-111111111111'
const ids = [
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
]

describe('ReaderToolsService', () => {
  afterEach(() => vi.useRealTimers())

  it('restores local state and contains a malformed saved position', async () => {
    const harness = createHarness({ progress: { locator: { version: 99 } } })
    const loaded = await harness.service.load(harness.book)

    expect(loaded.locator).toBeNull()
    expect(loaded.restoreWarning).toMatch(/no longer valid/)
    expect(loaded.preferences).toEqual({ fit: 'fit-page' })
  })

  it('persists bookmarks, highlights, notes, preferences, and final progress offline', async () => {
    vi.useFakeTimers()
    const harness = createHarness()
    const loaded = await harness.service.load(harness.book)
    const session = await harness.service.start({ book: harness.book, engine: harness.engine, loaded })

    const bookmark = await session.addBookmark('Important page')
    const highlight = await session.addHighlight({ locator: selectionLocator() }, 'green')
    const note = await session.addNote({ body: 'First line\nSecond line', highlightId: highlight.id })
    await session.updateNote(note.id, 'Edited local note')
    expect(session.searchAnnotations('edited')).toEqual([
      expect.objectContaining({ type: 'note', label: 'Edited local note' }),
    ])
    await session.updatePreferences({ fit: 'custom', zoom: 1.5 })
    await session.jumpTo(bookmark)

    await session.deleteHighlight(highlight.id)
    expect(harness.noteRepository.records.get(note.id)).toMatchObject({
      highlightId: null,
      locator: selectionLocator(),
    })

    harness.engine.emitLocation(pdfLocator(2))
    await session.close()

    expect(harness.bookRepository.put).toHaveBeenCalledWith(expect.objectContaining({ lastOpenedAt: expect.any(String) }))
    expect(harness.progressRepository.set).toHaveBeenCalledWith(bookId, expect.objectContaining({ locator: pdfLocator(2) }))
    expect(harness.preferencesRepository.set).toHaveBeenCalledWith('pdf', expect.objectContaining({ zoom: 1.5 }))
    expect(harness.engine.goTo).toHaveBeenCalledWith(pdfLocator(1))
    expect(harness.lifecycle.unsubscribe).toHaveBeenCalledOnce()
  })

  it('reports stale anchors without discarding their records', async () => {
    const harness = createHarness()
    harness.engine.goTo.mockRejectedValue(new Error('missing page'))
    const session = await harness.service.start({
      book: harness.book,
      engine: harness.engine,
      loaded: await harness.service.load(harness.book),
    })
    await expect(session.jumpTo({ locator: pdfLocator(1) })).rejects.toBeInstanceOf(UnresolvedReadingAnchorError)
    await session.close()
  })
})

function createHarness({ progress = null } = {}) {
  const book = { id: bookId, format: 'pdf', title: 'Local book' }
  const bookmarkRepository = memoryRepository()
  const highlightRepository = memoryRepository()
  const noteRepository = memoryRepository()
  const listeners = new Set()
  let currentLocator = pdfLocator(1)
  const engine = {
    getCurrentLocator: vi.fn(() => currentLocator),
    subscribe: vi.fn((listener) => { listeners.add(listener); return () => listeners.delete(listener) }),
    emitLocation(locator) { currentLocator = locator; for (const listener of listeners) listener({ type: 'location', locator }) },
    setHighlights: vi.fn().mockResolvedValue(undefined),
    setViewPreferences: vi.fn(async (changes) => ({ fit: 'fit-width', zoom: 1, rotation: 0, theme: 'dark', ...changes })),
    goTo: vi.fn().mockResolvedValue(undefined),
  }
  const progressRepository = { get: vi.fn().mockResolvedValue(progress), set: vi.fn().mockResolvedValue(undefined) }
  const bookRepository = { get: vi.fn().mockResolvedValue(book), put: vi.fn().mockResolvedValue(undefined) }
  const preferencesRepository = {
    get: vi.fn().mockResolvedValue({ fit: 'fit-page' }),
    set: vi.fn().mockResolvedValue(undefined),
  }
  const lifecycle = { unsubscribe: vi.fn(), subscribeFlush: vi.fn(() => lifecycle.unsubscribe) }
  let idIndex = 0
  const service = new ReaderToolsService({
    booksRepository: bookRepository,
    progressRepository,
    bookmarkRepository,
    highlightRepository,
    noteRepository,
    preferencesRepository,
    lifecycle,
    idFactory: () => ids[idIndex++],
    clock: () => '2026-09-10T10:00:00.000Z',
    debounceMs: 100,
  })
  return { service, book, engine, progressRepository, preferencesRepository, bookRepository, noteRepository, lifecycle }
}

function memoryRepository() {
  const records = new Map()
  return {
    records,
    listByBook: vi.fn(async (id) => [...records.values()].filter((record) => record.bookId === id)),
    add: vi.fn(async (record) => { records.set(record.id, record); return record }),
    put: vi.fn(async (record) => { records.set(record.id, record); return record }),
    delete: vi.fn(async (id) => records.delete(id)),
  }
}

function pdfLocator(page) {
  return { version: 1, format: 'pdf', progression: page - 1, pdf: { page, pageCount: 2 } }
}

function selectionLocator() {
  return {
    ...pdfLocator(1),
    pdf: {
      page: 1,
      pageCount: 2,
      textQuote: { exact: 'Offline selection', prefix: '', suffix: '' },
      geometry: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.04 }],
    },
  }
}
