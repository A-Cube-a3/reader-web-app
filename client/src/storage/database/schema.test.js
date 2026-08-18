import { openDB } from 'idb'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DATABASE_VERSION,
  deleteLocalDatabase,
  openLocalDatabase,
  STORES,
} from './schema.js'

const databasesToDelete = new Set()

afterEach(async () => {
  await Promise.all([...databasesToDelete].map((name) => deleteLocalDatabase(name)))
  databasesToDelete.clear()
})

describe('local database schema', () => {
  it('creates every Phase 2 store and index from a fresh database', async () => {
    const name = databaseName()
    const database = await openLocalDatabase({ name })

    expect(database.version).toBe(DATABASE_VERSION)
    expect([...database.objectStoreNames]).toEqual([
      STORES.BINARY_CLEANUP,
      STORES.BOOKS,
      STORES.PROGRESS,
      STORES.SETTINGS,
    ])

    const bookIndexes = [
      ...database.transaction(STORES.BOOKS).store.indexNames,
    ]
    expect(bookIndexes).toEqual([
      'by-favorite',
      'by-format',
      'by-imported-at',
      'by-reading-status',
      'by-updated-at',
    ])
    database.close()
  })

  it('upgrades version-one books without losing existing fields', async () => {
    const name = databaseName()
    const versionOne = await openDB(name, 1, {
      upgrade(database) {
        database.createObjectStore(STORES.BOOKS, { keyPath: 'id' })
        database.createObjectStore(STORES.PROGRESS, { keyPath: 'bookId' })
        database.createObjectStore(STORES.SETTINGS, { keyPath: 'key' })
      },
    })
    await versionOne.put(STORES.BOOKS, {
      id: 'legacy-book',
      title: 'Preserved title',
      format: 'pdf',
      binaryReference: 'opfs:v1:11111111-1111-4111-8111-111111111111',
      originalFilename: 'legacy.pdf',
      fileSize: 12,
      importedAt: '2026-01-01T00:00:00.000Z',
    })
    versionOne.close()

    const upgraded = await openLocalDatabase({ name })
    const book = await upgraded.get(STORES.BOOKS, 'legacy-book')

    expect(upgraded.version).toBe(2)
    expect(book).toMatchObject({
      id: 'legacy-book',
      title: 'Preserved title',
      readingStatus: 'want-to-read',
      favorite: false,
      author: '',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(book.metadataSource).toEqual({
      type: 'filename',
      extractedFields: [],
      userEditedFields: [],
    })
    upgraded.close()
  })
})

function databaseName() {
  const name = `reader-test-${crypto.randomUUID()}`
  databasesToDelete.add(name)
  return name
}
