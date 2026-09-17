import { DatabaseError } from '../../domain/books/errors.js'
import { STORES } from '../../storage/database/schema.js'

export class IndexedDbReadingActivityRepository {
  constructor(database) {
    this.database = Promise.resolve(database)
  }

  put(activity) {
    return this.run((database) => database.put(STORES.READING_ACTIVITY, activity).then(() => activity))
  }

  get(id) { return this.run((database) => database.get(STORES.READING_ACTIVITY, id)) }

  async list() {
    const records = await this.run((database) => database.getAll(STORES.READING_ACTIVITY))
    return records.sort((left, right) => right.startedAt.localeCompare(left.startedAt))
  }

  listByBook(bookId) {
    return this.run((database) => database.getAllFromIndex(STORES.READING_ACTIVITY, 'by-book-id', bookId))
  }

  delete(id) { return this.run((database) => database.delete(STORES.READING_ACTIVITY, id)) }

  async run(operation) {
    try {
      return await this.database.then(operation)
    } catch (cause) {
      throw new DatabaseError({ cause })
    }
  }
}
