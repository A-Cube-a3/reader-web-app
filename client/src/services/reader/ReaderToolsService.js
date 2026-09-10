import {
  createBookmark,
  createHighlight,
  createNote,
  updateNote,
} from '../../domain/annotations/annotation.js'
import { validateReadingLocator } from '../../domain/reading/locator.js'
import { DebouncedProgressWriter } from './DebouncedProgressWriter.js'

export class ReaderToolsService {
  constructor({
    booksRepository,
    progressRepository,
    bookmarkRepository,
    highlightRepository,
    noteRepository,
    preferencesRepository,
    lifecycle = null,
    idFactory = () => globalThis.crypto.randomUUID(),
    clock = () => new Date().toISOString(),
    debounceMs = 750,
  }) {
    Object.assign(this, {
      booksRepository,
      progressRepository,
      bookmarkRepository,
      highlightRepository,
      noteRepository,
      preferencesRepository,
      lifecycle,
      idFactory,
      clock,
      debounceMs,
    })
  }

  async load(book) {
    const [progress, preferences, bookmarks, highlights, notes] = await Promise.all([
      this.progressRepository.get(book.id),
      this.preferencesRepository.get(book.format),
      this.bookmarkRepository.listByBook(book.id),
      this.highlightRepository.listByBook(book.id),
      this.noteRepository.listByBook(book.id),
    ])
    let locator = null
    let restoreWarning = null
    if (progress?.locator) {
      try {
        locator = validateReadingLocator(progress.locator, book.format)
      } catch {
        restoreWarning = 'The saved reading position is no longer valid. The book will open at its start.'
      }
    }
    return { progress, locator, preferences, bookmarks, highlights, notes, restoreWarning }
  }

  async start({ book, engine, loaded }) {
    const latestBook = await this.booksRepository.get(book.id)
    const openedAt = this.clock()
    await this.booksRepository.put({ ...latestBook, lastOpenedAt: openedAt })
    const session = new ReaderToolsSession({
      service: this,
      book: { ...book, lastOpenedAt: openedAt },
      engine,
      loaded,
    })
    await session.start()
    return session
  }
}

export class ReaderToolsSession {
  constructor({ service, book, engine, loaded }) {
    this.service = service
    this.book = book
    this.engine = engine
    this.bookmarks = [...loaded.bookmarks]
    this.highlights = [...loaded.highlights]
    this.notes = [...loaded.notes]
    this.preferences = { ...loaded.preferences }
    this.restoreWarning = loaded.restoreWarning
    this.currentLocator = engine.getCurrentLocator()
    this.listeners = new Set()
    this.closed = false
    this.progressWriter = new DebouncedProgressWriter({
      bookId: book.id,
      format: book.format,
      progressRepository: service.progressRepository,
      debounceMs: service.debounceMs,
      clock: service.clock,
      onError: (error) => this.emitError(error),
    })
  }

  async start() {
    this.unsubscribeEngine = this.engine.subscribe((event) => {
      if (event.type === 'location') this.recordLocation(event.locator)
    })
    this.unsubscribeLifecycle = this.service.lifecycle?.subscribeFlush(() => {
      void this.flush().catch((error) => this.emitError(error))
    }) || (() => {})
    if (this.currentLocator) this.progressWriter.schedule(this.currentLocator)
    await this.engine.setHighlights?.(this.highlights)
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getState() {
    return {
      bookmarks: [...this.bookmarks],
      highlights: [...this.highlights],
      notes: [...this.notes],
      preferences: { ...this.preferences },
      restoreWarning: this.restoreWarning,
    }
  }

  recordLocation(locator) {
    this.currentLocator = validateReadingLocator(locator, this.book.format)
    this.progressWriter.schedule(this.currentLocator)
  }

  async addBookmark(label = '') {
    const locator = this.requireCurrentLocator()
    const bookmark = createBookmark({
      id: this.service.idFactory(),
      bookId: this.book.id,
      locator,
      label,
      now: this.service.clock(),
    })
    await this.service.bookmarkRepository.add(bookmark)
    this.bookmarks = [...this.bookmarks, bookmark]
    this.emitChange()
    return bookmark
  }

  async deleteBookmark(id) {
    this.assertOwned(this.bookmarks, id, 'Bookmark')
    await this.service.bookmarkRepository.delete(id)
    this.bookmarks = this.bookmarks.filter((item) => item.id !== id)
    this.emitChange()
  }

  async addHighlight(selection, color = 'yellow') {
    const highlight = createHighlight({
      id: this.service.idFactory(),
      bookId: this.book.id,
      locator: selection?.locator,
      color,
      now: this.service.clock(),
    })
    await this.service.highlightRepository.add(highlight)
    this.highlights = [...this.highlights, highlight]
    await this.engine.setHighlights?.(this.highlights)
    this.emitChange()
    return highlight
  }

  async deleteHighlight(id) {
    const highlight = this.assertOwned(this.highlights, id, 'Highlight')
    const linkedNotes = this.notes.filter((note) => note.highlightId === id)
    for (const note of linkedNotes) {
      const detached = {
        ...note,
        highlightId: null,
        locator: note.locator || highlight.locator,
        updatedAt: this.service.clock(),
      }
      await this.service.noteRepository.put(detached)
      this.notes = this.notes.map((item) => item.id === detached.id ? detached : item)
    }
    await this.service.highlightRepository.delete(id)
    this.highlights = this.highlights.filter((item) => item.id !== id)
    await this.engine.setHighlights?.(this.highlights)
    this.emitChange()
  }

  async addNote({ body, highlightId = null, locator = null } = {}) {
    let highlight = null
    if (highlightId) highlight = this.assertOwned(this.highlights, highlightId, 'Highlight')
    const note = createNote({
      id: this.service.idFactory(),
      bookId: this.book.id,
      body,
      highlightId,
      locator: locator || highlight?.locator || null,
      now: this.service.clock(),
    })
    await this.service.noteRepository.add(note)
    this.notes = [...this.notes, note]
    this.emitChange()
    return note
  }

  async updateNote(id, body) {
    const existing = this.assertOwned(this.notes, id, 'Note')
    const note = updateNote(existing, body, this.service.clock())
    await this.service.noteRepository.put(note)
    this.notes = this.notes.map((item) => item.id === id ? note : item)
    this.emitChange()
    return note
  }

  async deleteNote(id) {
    this.assertOwned(this.notes, id, 'Note')
    await this.service.noteRepository.delete(id)
    this.notes = this.notes.filter((item) => item.id !== id)
    this.emitChange()
  }

  searchAnnotations(query) {
    const needle = normalizeSearch(query)
    if (!needle) return []
    return [
      ...this.highlights
        .filter((item) => normalizeSearch(item.quote.exact).includes(needle))
        .map((item) => ({ type: 'highlight', id: item.id, label: item.quote.exact, locator: item.locator })),
      ...this.notes
        .filter((item) => normalizeSearch(item.body).includes(needle))
        .map((item) => ({ type: 'note', id: item.id, label: item.body, locator: item.locator })),
    ]
  }

  async jumpTo(record) {
    if (!record?.locator) throw new UnresolvedReadingAnchorError()
    try {
      await this.engine.goTo(validateReadingLocator(record.locator, this.book.format))
    } catch (cause) {
      throw new UnresolvedReadingAnchorError({ cause })
    }
  }

  async updatePreferences(changes) {
    const preferences = await this.engine.setViewPreferences(changes)
    await this.service.preferencesRepository.set(this.book.format, preferences)
    this.preferences = { ...preferences }
    this.emitChange()
    return preferences
  }

  flush() {
    const locator = this.engine.getCurrentLocator() || this.currentLocator
    if (locator) this.progressWriter.schedule(locator)
    return this.progressWriter.flush()
  }

  async close() {
    if (this.closed) return
    this.closed = true
    this.unsubscribeEngine?.()
    this.unsubscribeLifecycle?.()
    await this.flush()
    this.listeners.clear()
  }

  requireCurrentLocator() {
    const locator = this.engine.getCurrentLocator() || this.currentLocator
    if (!locator) throw new UnresolvedReadingAnchorError()
    return validateReadingLocator(locator, this.book.format)
  }

  assertOwned(records, id, label) {
    const record = records.find((item) => item.id === id)
    if (!record) throw new Error(`${label} does not belong to this book.`)
    return record
  }

  emitChange() {
    const state = this.getState()
    for (const listener of this.listeners) listener({ type: 'change', state })
  }

  emitError(error) {
    for (const listener of this.listeners) listener({ type: 'error', error })
  }
}

export class UnresolvedReadingAnchorError extends Error {
  constructor(options = {}) {
    super('This saved location cannot be resolved in the current book file.', options)
    this.name = 'UnresolvedReadingAnchorError'
    this.code = 'UNRESOLVED_READING_ANCHOR'
  }
}

function normalizeSearch(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim()
}
