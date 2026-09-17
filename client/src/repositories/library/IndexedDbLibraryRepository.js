import { DatabaseError } from '../../domain/books/errors.js'
import { STORES } from '../../storage/database/schema.js'

export class IndexedDbLibraryRepository {
  constructor(database, clock = () => new Date().toISOString()) {
    this.database = Promise.resolve(database)
    this.clock = clock
  }

  async addBook(book) {
    try {
      const database = await this.database
      await database.add(STORES.BOOKS, book)
      return book
    } catch (cause) {
      throw new DatabaseError({ cause })
    }
  }

  async deleteBookAndQueueBinaries(bookId, binaryReferences) {
    try {
      const database = await this.database
      const transaction = database.transaction(
        [
          STORES.BOOKS,
          STORES.PROGRESS,
          STORES.BOOKMARKS,
          STORES.HIGHLIGHTS,
          STORES.NOTES,
          STORES.COLLECTIONS,
          STORES.READING_ACTIVITY,
          STORES.BINARY_CLEANUP,
        ],
        'readwrite',
      )
      const timestamp = this.clock()

      for (const reference of binaryReferences.filter(Boolean)) {
        await transaction.objectStore(STORES.BINARY_CLEANUP).put({
          reference,
          bookId,
          createdAt: timestamp,
          attempts: 0,
          lastError: null,
        })
      }
      await deleteBookRecords(transaction.objectStore(STORES.BOOKMARKS), bookId)
      await deleteBookRecords(transaction.objectStore(STORES.HIGHLIGHTS), bookId)
      await deleteBookRecords(transaction.objectStore(STORES.NOTES), bookId)
      await deleteBookRecords(transaction.objectStore(STORES.READING_ACTIVITY), bookId)
      await removeBookFromCollections(transaction.objectStore(STORES.COLLECTIONS), bookId, timestamp)
      await transaction.objectStore(STORES.PROGRESS).delete(bookId)
      await transaction.objectStore(STORES.BOOKS).delete(bookId)
      await transaction.done
    } catch (cause) {
      throw new DatabaseError({ cause })
    }
  }

  async enqueueBinaryCleanup(bookId, binaryReferences) {
    try {
      const database = await this.database
      const transaction = database.transaction(STORES.BINARY_CLEANUP, 'readwrite')
      const timestamp = this.clock()
      await Promise.all([
        ...binaryReferences.filter(Boolean).map((reference) => transaction.store.put({
          reference,
          bookId,
          createdAt: timestamp,
          attempts: 0,
          lastError: null,
        })),
        transaction.done,
      ])
    } catch (cause) {
      throw new DatabaseError({ cause })
    }
  }

  async listBinaryCleanup() {
    try {
      const database = await this.database
      return database.getAll(STORES.BINARY_CLEANUP)
    } catch (cause) {
      throw new DatabaseError({ cause })
    }
  }

  async completeBinaryCleanup(reference) {
    try {
      const database = await this.database
      await database.delete(STORES.BINARY_CLEANUP, reference)
    } catch (cause) {
      throw new DatabaseError({ cause })
    }
  }

  async recordBinaryCleanupFailure(record, errorCode) {
    try {
      const database = await this.database
      await database.put(STORES.BINARY_CLEANUP, {
        ...record,
        attempts: record.attempts + 1,
        lastAttemptAt: this.clock(),
        lastError: errorCode,
      })
    } catch (cause) {
      throw new DatabaseError({ cause })
    }
  }
}

async function deleteBookRecords(store, bookId) {
  let cursor = await store.index('by-book-id').openKeyCursor(bookId)
  while (cursor) {
    await store.delete(cursor.primaryKey)
    cursor = await cursor.continue()
  }
}

async function removeBookFromCollections(store, bookId, timestamp) {
  let cursor = await store.openCursor()
  while (cursor) {
    const collection = cursor.value
    if (collection.bookIds.includes(bookId)) {
      await cursor.update({
        ...collection,
        bookIds: collection.bookIds.filter((id) => id !== bookId),
        updatedAt: timestamp,
      })
    }
    cursor = await cursor.continue()
  }
}
