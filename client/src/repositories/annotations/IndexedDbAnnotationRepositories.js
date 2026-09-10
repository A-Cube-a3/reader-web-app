import { DatabaseError } from '../../domain/books/errors.js'
import { STORES } from '../../storage/database/schema.js'

class IndexedDbBookRecordRepository {
  constructor(database, storeName) {
    this.database = Promise.resolve(database)
    this.storeName = storeName
  }

  add(record) {
    return this.run((database) => database.add(this.storeName, record).then(() => record))
  }

  put(record) {
    return this.run((database) => database.put(this.storeName, record).then(() => record))
  }

  get(id) {
    return this.run((database) => database.get(this.storeName, id))
  }

  async listByBook(bookId) {
    const records = await this.run((database) => (
      database.getAllFromIndex(this.storeName, 'by-book-id', bookId)
    ))
    return records.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  }

  delete(id) {
    return this.run((database) => database.delete(this.storeName, id))
  }

  async run(operation) {
    try {
      return await this.database.then(operation)
    } catch (cause) {
      throw new DatabaseError({ cause })
    }
  }
}

export class IndexedDbBookmarkRepository extends IndexedDbBookRecordRepository {
  constructor(database) {
    super(database, STORES.BOOKMARKS)
  }
}

export class IndexedDbHighlightRepository extends IndexedDbBookRecordRepository {
  constructor(database) {
    super(database, STORES.HIGHLIGHTS)
  }
}

export class IndexedDbNoteRepository extends IndexedDbBookRecordRepository {
  constructor(database) {
    super(database, STORES.NOTES)
  }

  listByHighlight(highlightId) {
    return this.run((database) => (
      database.getAllFromIndex(this.storeName, 'by-highlight-id', highlightId)
    ))
  }
}
