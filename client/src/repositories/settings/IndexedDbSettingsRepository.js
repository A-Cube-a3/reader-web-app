import { DatabaseError } from '../../domain/books/errors.js'
import { STORES } from '../../storage/database/schema.js'

export class IndexedDbSettingsRepository {
  constructor(database, clock = () => new Date().toISOString()) {
    this.database = Promise.resolve(database)
    this.clock = clock
  }

  async get(key, fallback = undefined) {
    const record = await this.#run(() =>
      this.database.then((database) => database.get(STORES.SETTINGS, key)),
    )
    return record ? record.value : fallback
  }

  async set(key, value) {
    const record = { key, value, updatedAt: this.clock() }
    await this.#run(() => this.database.then((database) => database.put(STORES.SETTINGS, record)))
    return value
  }

  async delete(key) {
    return this.#run(() => this.database.then((database) => database.delete(STORES.SETTINGS, key)))
  }

  async #run(operation) {
    try {
      return await operation()
    } catch (cause) {
      throw new DatabaseError({ cause })
    }
  }
}
