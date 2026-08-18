import { DatabaseError } from '../../domain/books/errors.js'
import { STORES } from '../../storage/database/schema.js'

export class IndexedDbBooksRepository {
  constructor(database) {
    this.database = Promise.resolve(database)
  }

  async add(book) {
    return this.#run(() => this.database.then((database) => database.add(STORES.BOOKS, book)))
  }

  async put(book) {
    return this.#run(() => this.database.then((database) => database.put(STORES.BOOKS, book)))
  }

  async get(id) {
    return this.#run(() => this.database.then((database) => database.get(STORES.BOOKS, id)))
  }

  async list() {
    const books = await this.#run(() =>
      this.database.then((database) => database.getAll(STORES.BOOKS)),
    )
    return books.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  async delete(id) {
    return this.#run(() => this.database.then((database) => database.delete(STORES.BOOKS, id)))
  }

  async #run(operation) {
    try {
      return await operation()
    } catch (cause) {
      throw new DatabaseError({ cause })
    }
  }
}
