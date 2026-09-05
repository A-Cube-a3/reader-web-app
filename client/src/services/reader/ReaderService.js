import { validateReadingLocator } from '../../domain/reading/locator.js'

export class ReaderService {
  constructor({ libraryService, engineRegistry }) {
    this.libraryService = libraryService
    this.engineRegistry = engineRegistry
  }

  async open(bookId, { locator = null, preferences = {} } = {}) {
    const book = await this.libraryService.getBook(bookId)
    if (locator) validateReadingLocator(locator, book.format)
    const source = await this.libraryService.openBookBinary(book.id)
    const engine = await this.engineRegistry.create(book.format)

    try {
      await engine.open({ book, source, locator, preferences })
      return { book, engine }
    } catch (error) {
      await engine.close?.()
      throw error
    }
  }
}
