const MAX_COLLECTION_NAME = 120

export function createCollection({ id, name, now, bookIds = [] }) {
  assertUuid(id, 'A collection requires a UUID')
  const timestamp = validTimestamp(now)
  return {
    id,
    name: validName(name),
    bookIds: validBookIds(bookIds),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function renameCollection(collection, name, now) {
  return { ...collection, name: validName(name), updatedAt: validTimestamp(now) }
}

export function addBookToCollection(collection, bookId, now) {
  assertUuid(bookId, 'A collection book reference must be a UUID')
  if (collection.bookIds.includes(bookId)) return collection
  return {
    ...collection,
    bookIds: [...collection.bookIds, bookId],
    updatedAt: validTimestamp(now),
  }
}

export function removeBookFromCollection(collection, bookId, now) {
  if (!collection.bookIds.includes(bookId)) return collection
  return {
    ...collection,
    bookIds: collection.bookIds.filter((id) => id !== bookId),
    updatedAt: validTimestamp(now),
  }
}

function validName(value) {
  const name = String(value || '').replace(/\s+/g, ' ').trim().slice(0, MAX_COLLECTION_NAME)
  if (!name) throw new TypeError('A collection name cannot be empty')
  return name
}

function validBookIds(values) {
  if (!Array.isArray(values)) throw new TypeError('Collection book references must be an array')
  for (const value of values) assertUuid(value, 'A collection book reference must be a UUID')
  return [...new Set(values)]
}

function assertUuid(value, message) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new TypeError(message)
  }
}

function validTimestamp(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new TypeError('A collection requires a timestamp')
  }
  return value
}
