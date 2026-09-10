import { validateReadingLocator } from '../../domain/reading/locator.js'

export class ReaderService {
  constructor({ libraryService, engineRegistry, toolsService = null }) {
    this.libraryService = libraryService
    this.engineRegistry = engineRegistry
    this.toolsService = toolsService
  }

  async open(bookId, { locator = null, preferences = {} } = {}) {
    const book = await this.libraryService.getBook(bookId)
    if (locator) validateReadingLocator(locator, book.format)
    const loadedTools = this.toolsService ? await this.toolsService.load(book) : null
    const source = await this.libraryService.openBookBinary(book.id)
    const engine = await this.engineRegistry.create(book.format)
    let tools = null

    try {
      await engine.open({
        book,
        source,
        locator: locator || loadedTools?.locator || null,
        preferences: { ...(loadedTools?.preferences || {}), ...preferences },
      })
      tools = this.toolsService
        ? await this.toolsService.start({ book, engine, loaded: loadedTools })
        : null
      let closed = false
      const session = {
        book: tools?.book || book,
        engine,
        tools,
        async close() {
          if (closed) return
          closed = true
          await tools?.close()
          await engine.close()
        },
      }
      return session
    } catch (error) {
      await tools?.close?.()
      await engine.close?.()
      throw error
    }
  }
}
