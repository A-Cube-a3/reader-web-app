import { validateReadingLocator } from '../../domain/reading/locator.js'

const DEFAULT_IDLE_LIMIT_MS = 5 * 60 * 1000

export class ReadingActivityTracker {
  constructor({
    repository,
    idFactory = () => globalThis.crypto.randomUUID(),
    clock = () => new Date(),
    idleLimitMs = DEFAULT_IDLE_LIMIT_MS,
  }) {
    Object.assign(this, { repository, idFactory, clock, idleLimitMs })
  }

  async start({ book, locator = null }) {
    const session = new ReadingActivitySession({ tracker: this, book, locator })
    await session.start()
    return session
  }
}

class ReadingActivitySession {
  constructor({ tracker, book, locator }) {
    const now = validDate(tracker.clock())
    this.tracker = tracker
    this.book = book
    this.lastTick = now
    this.paused = false
    this.closed = false
    this.pages = new Set()
    this.lastEpubLocation = null
    this.record = {
      id: tracker.idFactory(),
      bookId: book.id,
      format: book.format,
      startedAt: now.toISOString(),
      endedAt: now.toISOString(),
      localDate: localDateKey(now),
      durationMs: 0,
      pdfPagesVisited: 0,
      epubLocationChanges: 0,
      startLocator: locator ? validateReadingLocator(locator, book.format) : null,
      endLocator: locator ? validateReadingLocator(locator, book.format) : null,
    }
    this.captureLocation(locator, false)
  }

  async start() {
    await this.tracker.repository.put(this.record)
  }

  recordLocation(locator) {
    if (this.closed || !locator) return
    this.accrue()
    this.captureLocation(locator, true)
  }

  async flush({ pause = false } = {}) {
    if (this.closed) return
    this.accrue()
    if (pause) this.paused = true
    await this.tracker.repository.put({ ...this.record })
  }

  async close() {
    if (this.closed) return
    this.accrue()
    this.closed = true
    await this.tracker.repository.put({ ...this.record })
  }

  accrue() {
    const now = validDate(this.tracker.clock())
    if (!this.paused) {
      const elapsed = Math.max(0, now.getTime() - this.lastTick.getTime())
      this.record.durationMs += Math.min(elapsed, this.tracker.idleLimitMs)
    }
    this.paused = false
    this.lastTick = now
    this.record.endedAt = now.toISOString()
  }

  captureLocation(locator, countChange) {
    if (!locator) return
    const valid = validateReadingLocator(locator, this.book.format)
    this.record.endLocator = valid
    if (valid.format === 'pdf') {
      this.pages.add(valid.pdf.page)
      this.record.pdfPagesVisited = this.pages.size
      return
    }
    const key = valid.epub.cfi || valid.epub.spineItem || JSON.stringify(valid.epub)
    if (countChange && this.lastEpubLocation && key !== this.lastEpubLocation) {
      this.record.epubLocationChanges += 1
    }
    this.lastEpubLocation = key
  }
}

export function localDateKey(date) {
  const valid = validDate(date)
  const year = valid.getFullYear()
  const month = String(valid.getMonth() + 1).padStart(2, '0')
  const day = String(valid.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) throw new TypeError('Reading activity requires a valid clock')
  return date
}
