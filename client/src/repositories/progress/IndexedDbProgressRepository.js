import { DatabaseError } from '../../domain/books/errors.js'
import { STORES } from '../../storage/database/schema.js'

export class IndexedDbProgressRepository {
  constructor(database, clock = () => new Date().toISOString()) {
    this.database = Promise.resolve(database)
    this.clock = clock
  }

  async get(bookId) {
    return this.#run(() => this.database.then((database) => database.get(STORES.PROGRESS, bookId)))
  }

  async set(bookId, progress) {
    const record = { ...progress, bookId, updatedAt: this.clock() }
    await this.#run(() => this.database.then((database) => database.put(STORES.PROGRESS, record)))
    return record
  }

  async delete(bookId) {
    return this.#run(() => this.database.then((database) => database.delete(STORES.PROGRESS, bookId)))
  }

  async #run(operation) {
    try {
      return await operation()
    } catch (cause) {
      throw new DatabaseError({ cause })
    }
  }
}
