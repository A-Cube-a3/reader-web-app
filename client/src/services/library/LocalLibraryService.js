import { createBookRecord, updateBookMetadata } from '../../domain/books/book.js'
import { BookNotFoundError } from '../../domain/books/errors.js'
import { detectBookFormat } from '../metadata/detectBookFormat.js'

export class LocalLibraryService {
  constructor({
    booksRepository,
    libraryRepository,
    binaryStorage,
    metadataService,
    idFactory = () => globalThis.crypto.randomUUID(),
    clock = () => new Date().toISOString(),
  }) {
    this.booksRepository = booksRepository
    this.libraryRepository = libraryRepository
    this.binaryStorage = binaryStorage
    this.metadataService = metadataService
    this.idFactory = idFactory
    this.clock = clock
  }

  async initialize() {
    await this.retryPendingBinaryCleanup()
    return this.listBooks()
  }

  listBooks() {
    return this.booksRepository.list()
  }

  async getBook(bookId) {
    const book = await this.booksRepository.get(bookId)
    if (!book) throw new BookNotFoundError()
    return book
  }

  async importBook(file) {
    const format = await detectBookFormat(file)
    const metadata = await this.metadataService.extract(file, format)
    const writtenReferences = []

    try {
      const binaryReference = await this.binaryStorage.write(file)
      writtenReferences.push(binaryReference)
      let coverReference = null
      if (metadata.cover?.blob) {
        coverReference = await this.binaryStorage.write(metadata.cover.blob)
        writtenReferences.push(coverReference)
      }

      const book = createBookRecord({
        id: this.idFactory(),
        format,
        binaryReference,
        coverReference,
        originalFilename: file.name,
        fileSize: file.size,
        metadata,
        now: this.clock(),
      })
      await this.libraryRepository.addBook(book)
      return book
    } catch (error) {
      await this.cleanupFailedImport(writtenReferences)
      throw error
    }
  }

  async updateBook(bookId, changes) {
    const book = await this.getBook(bookId)
    const updated = updateBookMetadata(book, changes, this.clock())
    if (updated === book) return book
    await this.booksRepository.put(updated)
    return updated
  }

  async deleteBook(bookId) {
    const book = await this.getBook(bookId)
    const references = [book.binaryReference, book.coverReference].filter(Boolean)
    await this.libraryRepository.deleteBookAndQueueBinaries(book.id, references)
    const cleanup = await this.retryPendingBinaryCleanup()
    return { bookId, cleanupPending: cleanup.failed > 0 }
  }

  async openBookBinary(bookId) {
    const book = await this.getBook(bookId)
    return this.binaryStorage.open(book.binaryReference)
  }

  inspectStorage() {
    return this.binaryStorage.inspectCapacity()
  }

  requestPersistentStorage() {
    return this.binaryStorage.requestPersistence()
  }

  async retryPendingBinaryCleanup() {
    const pending = await this.libraryRepository.listBinaryCleanup()
    let completed = 0
    let failed = 0

    for (const record of pending) {
      try {
        await this.binaryStorage.delete(record.reference)
        await this.libraryRepository.completeBinaryCleanup(record.reference)
        completed += 1
      } catch (error) {
        await this.libraryRepository.recordBinaryCleanupFailure(
          record,
          error.code || 'STORAGE_IO_ERROR',
        )
        failed += 1
      }
    }
    return { completed, failed }
  }

  async cleanupFailedImport(references) {
    const failedReferences = []
    for (const reference of references) {
      try {
        await this.binaryStorage.delete(reference)
      } catch {
        failedReferences.push(reference)
      }
    }
    if (failedReferences.length > 0) {
      await this.libraryRepository.enqueueBinaryCleanup('failed-import', failedReferences)
    }
  }
}
