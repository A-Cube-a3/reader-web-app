import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { IndexedDbBooksRepository } from './books/IndexedDbBooksRepository.js'
import { IndexedDbLibraryRepository } from './library/IndexedDbLibraryRepository.js'
import { IndexedDbProgressRepository } from './progress/IndexedDbProgressRepository.js'
import { IndexedDbSettingsRepository } from './settings/IndexedDbSettingsRepository.js'
import { deleteLocalDatabase, openLocalDatabase } from '../storage/database/schema.js'

describe('IndexedDB repositories', () => {
  let database
  let databaseName
  let books
  let progress
  let settings
  let library

  beforeEach(async () => {
    databaseName = `reader-repositories-${crypto.randomUUID()}`
    database = await openLocalDatabase({ name: databaseName })
    books = new IndexedDbBooksRepository(database)
    progress = new IndexedDbProgressRepository(database, () => '2026-02-02T00:00:00.000Z')
    settings = new IndexedDbSettingsRepository(database, () => '2026-02-02T00:00:00.000Z')
    library = new IndexedDbLibraryRepository(database, () => '2026-02-02T00:00:00.000Z')
  })

  afterEach(async () => {
    database.close()
    await deleteLocalDatabase(databaseName)
  })

  it('creates, orders, updates, and deletes books', async () => {
    await books.add(book('one', '2026-01-01T00:00:00.000Z'))
    await books.add(book('two', '2026-01-02T00:00:00.000Z'))

    expect((await books.list()).map(({ id }) => id)).toEqual(['two', 'one'])

    const updated = { ...(await books.get('one')), title: 'Updated' }
    await books.put(updated)
    expect((await books.get('one')).title).toBe('Updated')

    await books.delete('one')
    expect(await books.get('one')).toBeUndefined()
  })

  it('persists progress and settings through their repositories', async () => {
    await progress.set('one', { progression: 0.25, locator: { page: 4 } })
    await settings.set('theme', 'sepia')

    expect(await progress.get('one')).toEqual({
      bookId: 'one',
      progression: 0.25,
      locator: { page: 4 },
      updatedAt: '2026-02-02T00:00:00.000Z',
    })
    expect(await settings.get('theme')).toBe('sepia')
    expect(await settings.get('missing', 'fallback')).toBe('fallback')
  })

  it('deletes a book and progress atomically while queuing binary cleanup', async () => {
    await library.addBook(book('one', '2026-01-01T00:00:00.000Z'))
    await progress.set('one', { progression: 0.5 })

    await library.deleteBookAndQueueBinaries('one', ['opfs:v1:book', 'opfs:v1:cover'])

    expect(await books.get('one')).toBeUndefined()
    expect(await progress.get('one')).toBeUndefined()
    expect(await library.listBinaryCleanup()).toEqual([
      expect.objectContaining({ reference: 'opfs:v1:book', bookId: 'one', attempts: 0 }),
      expect.objectContaining({ reference: 'opfs:v1:cover', bookId: 'one', attempts: 0 }),
    ])
  })
})

function book(id, updatedAt) {
  return {
    id,
    title: id,
    format: 'pdf',
    binaryReference: `opfs:v1:${id}`,
    importedAt: updatedAt,
    updatedAt,
  }
}
