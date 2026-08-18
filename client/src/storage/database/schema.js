import { deleteDB, openDB } from 'idb'

export const DATABASE_NAME = 'reader-local-library'
export const DATABASE_VERSION = 2

export const STORES = Object.freeze({
  BOOKS: 'books',
  PROGRESS: 'progress',
  SETTINGS: 'settings',
  BINARY_CLEANUP: 'binary-cleanup',
})

export function openLocalDatabase({ name = DATABASE_NAME, version = DATABASE_VERSION } = {}) {
  return openDB(name, version, {
    upgrade(database, oldVersion, newVersion, transaction) {
      return runMigrations(database, oldVersion, newVersion, transaction)
    },
    blocking(_currentVersion, _blockedVersion, event) {
      event.target.close()
    },
  })
}

export function deleteLocalDatabase(name = DATABASE_NAME) {
  return deleteDB(name)
}

export async function runMigrations(database, oldVersion, newVersion, transaction) {
  const targetVersion = newVersion ?? DATABASE_VERSION

  if (oldVersion < 1 && targetVersion >= 1) {
    database.createObjectStore(STORES.BOOKS, { keyPath: 'id' })
    database.createObjectStore(STORES.PROGRESS, { keyPath: 'bookId' })
    database.createObjectStore(STORES.SETTINGS, { keyPath: 'key' })
  }

  if (oldVersion < 2 && targetVersion >= 2) {
    const books = transaction.objectStore(STORES.BOOKS)
    books.createIndex('by-updated-at', 'updatedAt')
    books.createIndex('by-imported-at', 'importedAt')
    books.createIndex('by-format', 'format')
    books.createIndex('by-reading-status', 'readingStatus')
    books.createIndex('by-favorite', 'favorite')

    database.createObjectStore(STORES.BINARY_CLEANUP, { keyPath: 'reference' })
    await migrateVersionOneBooks(books)
  }
}

async function migrateVersionOneBooks(store) {
  let cursor = await store.openCursor()
  while (cursor) {
    const book = cursor.value
    const importedAt = book.importedAt || new Date(0).toISOString()
    await cursor.update({
      author: '',
      description: '',
      publisher: '',
      language: '',
      identifier: '',
      coverReference: null,
      lastOpenedAt: null,
      readingStatus: 'want-to-read',
      favorite: false,
      metadataSource: {
        type: 'filename',
        extractedFields: [],
        userEditedFields: [],
      },
      pageCount: null,
      tableOfContents: [],
      ...book,
      importedAt,
      updatedAt: book.updatedAt || importedAt,
    })
    cursor = await cursor.continue()
  }
}
