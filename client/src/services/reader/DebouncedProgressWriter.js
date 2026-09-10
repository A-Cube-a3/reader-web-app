import { validateReadingLocator } from '../../domain/reading/locator.js'

export class DebouncedProgressWriter {
  constructor({
    bookId,
    format,
    progressRepository,
    debounceMs = 750,
    clock = () => new Date().toISOString(),
    onError = () => {},
  }) {
    this.bookId = bookId
    this.format = format
    this.progressRepository = progressRepository
    this.debounceMs = debounceMs
    this.clock = clock
    this.onError = onError
    this.writeChain = Promise.resolve()
  }

  schedule(locator) {
    this.pendingLocator = validateReadingLocator(locator, this.format)
    globalThis.clearTimeout(this.timer)
    this.timer = globalThis.setTimeout(() => {
      void this.flush().catch(this.onError)
    }, this.debounceMs)
  }

  async flush() {
    globalThis.clearTimeout(this.timer)
    this.timer = null
    if (!this.pendingLocator) return this.writeChain
    const locator = this.pendingLocator
    this.pendingLocator = null
    const record = {
      locator,
      progression: Number.isFinite(locator.progression) ? locator.progression : null,
      lastOpenedAt: this.clock(),
    }
    this.writeChain = this.writeChain.catch(() => {}).then(() => (
      this.progressRepository.set(this.bookId, record)
    ))
    return this.writeChain
  }

  cancel() {
    globalThis.clearTimeout(this.timer)
    this.timer = null
    this.pendingLocator = null
  }
}
