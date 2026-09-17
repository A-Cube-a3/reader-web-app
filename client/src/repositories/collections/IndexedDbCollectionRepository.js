import { DatabaseError } from '../../domain/books/errors.js'
import { STORES } from '../../storage/database/schema.js'

export class IndexedDbCollectionRepository {
  constructor(database) {
    this.database = Promise.resolve(database)
  }

  add(collection) { return this.run((database) => database.add(STORES.COLLECTIONS, collection).then(() => collection)) }
  put(collection) { return this.run((database) => database.put(STORES.COLLECTIONS, collection).then(() => collection)) }
  get(id) { return this.run((database) => database.get(STORES.COLLECTIONS, id)) }
  delete(id) { return this.run((database) => database.delete(STORES.COLLECTIONS, id)) }

  async list() {
    const records = await this.run((database) => database.getAll(STORES.COLLECTIONS))
    return records.sort((left, right) => left.name.localeCompare(right.name))
  }

  async run(operation) {
    try {
      return await this.database.then(operation)
    } catch (cause) {
      throw new DatabaseError({ cause })
    }
  }
}
