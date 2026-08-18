import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IndexedDbBooksRepository } from '../../repositories/books/IndexedDbBooksRepository.js'
import { IndexedDbLibraryRepository } from '../../repositories/library/IndexedDbLibraryRepository.js'
import { IndexedDbProgressRepository } from '../../repositories/progress/IndexedDbProgressRepository.js'
import { deleteLocalDatabase, openLocalDatabase } from '../../storage/database/schema.js'
import { LocalLibraryService } from './LocalLibraryService.js'

describe('LocalLibraryService', () => {
  let database
  let databaseName
  let books
  let libraryRepository
  let progress
  let binaryStorage
  let service

  beforeEach(async () => {
    databaseName = `reader-library-service-${crypto.randomUUID()}`
    database = await openLocalDatabase({ name: databaseName })
    books = new IndexedDbBooksRepository(database)
    libraryRepository = new IndexedDbLibraryRepository(database, () => '2026-03-01T00:00:00.000Z')
    progress = new IndexedDbProgressRepository(database)
    binaryStorage = createBinaryStorage()
    service = createService()
  })

  afterEach(async () => {
    database.close()
    await deleteLocalDatabase(databaseName)
  })

  it('imports locally, survives a new service instance, edits metadata, and opens the copy', async () => {
    const imported = await service.importBook(file('%PDF-1.7 local', 'manual.pdf'))

    expect(imported).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Embedded title',
      author: 'Local author',
      format: 'pdf',
      binaryReference: 'opfs:v1:1',
      originalFilename: 'manual.pdf',
      pageCount: 12,
    })
    expect(binaryStorage.write).toHaveBeenCalledOnce()

    const reopenedService = createService()
    expect(await reopenedService.initialize()).toEqual([imported])
    expect((await reopenedService.openBookBinary(imported.id)).name).toBe('manual.pdf')

    const edited = await reopenedService.updateBook(imported.id, {
      title: 'My manual',
      author: 'Me',
    })
    expect(edited).toMatchObject({ title: 'My manual', author: 'Me' })
    expect(edited.metadataSource.userEditedFields).toEqual(['title', 'author'])
  })

  it('does not leave a record or binary when the structured commit fails', async () => {
    vi.spyOn(libraryRepository, 'addBook').mockRejectedValueOnce(new Error('database unavailable'))

    await expect(service.importBook(file('%PDF-1.7 local', 'manual.pdf'))).rejects.toThrow(
      'database unavailable',
    )
    expect(await books.list()).toEqual([])
    expect(binaryStorage.delete).toHaveBeenCalledWith('opfs:v1:1')
    expect(binaryStorage.files.size).toBe(0)
  })

  it('hydrates locally saved progress for the Continue Reading view', async () => {
    const imported = await service.importBook(file('%PDF-1.7 local', 'manual.pdf'))
    await progress.set(imported.id, { progression: 0.4, locator: { page: 5 } })

    expect(await service.initialize()).toEqual([
      expect.objectContaining({
        id: imported.id,
        progress: expect.objectContaining({ progression: 0.4, locator: { page: 5 } }),
      }),
    ])
  })

  it('deletes structured data immediately and keeps failed binary cleanup retryable', async () => {
    const imported = await service.importBook(file('%PDF-1.7 local', 'manual.pdf'))
    await progress.set(imported.id, { progression: 0.5 })
    binaryStorage.delete.mockRejectedValueOnce(Object.assign(new Error('busy'), { code: 'STORAGE_IO_ERROR' }))

    await expect(service.deleteBook(imported.id)).resolves.toEqual({
      bookId: imported.id,
      cleanupPending: true,
    })
    expect(await books.get(imported.id)).toBeUndefined()
    expect(await progress.get(imported.id)).toBeUndefined()
    expect(await libraryRepository.listBinaryCleanup()).toEqual([
      expect.objectContaining({ reference: 'opfs:v1:1', attempts: 1, lastError: 'STORAGE_IO_ERROR' }),
    ])

    await expect(service.retryPendingBinaryCleanup()).resolves.toEqual({ completed: 1, failed: 0 })
    expect(await libraryRepository.listBinaryCleanup()).toEqual([])
  })

  function createService() {
    return new LocalLibraryService({
      booksRepository: books,
      libraryRepository,
      progressRepository: progress,
      binaryStorage,
      metadataService: {
        extract: vi.fn().mockResolvedValue({
          title: 'Embedded title',
          author: 'Local author',
          pageCount: 12,
          source: 'pdf-embedded',
          extractedFields: ['title', 'author', 'pageCount'],
        }),
      },
      idFactory: () => '11111111-1111-4111-8111-111111111111',
      clock: () => '2026-03-01T00:00:00.000Z',
    })
  }
})

function createBinaryStorage() {
  const files = new Map()
  let nextReference = 1
  return {
    files,
    write: vi.fn(async (blob) => {
      const reference = `opfs:v1:${nextReference}`
      nextReference += 1
      files.set(reference, blob)
      return reference
    }),
    open: vi.fn(async (reference) => files.get(reference)),
    delete: vi.fn(async (reference) => {
      files.delete(reference)
    }),
    inspectCapacity: vi.fn(),
    requestPersistence: vi.fn(),
  }
}

function file(contents, name) {
  return new File([contents], name, { type: 'application/pdf' })
}
