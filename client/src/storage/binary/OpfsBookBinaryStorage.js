import {
  BinaryCorruptError,
  BinaryMissingError,
  StorageIoError,
  StoragePermissionError,
  StorageQuotaError,
  StorageUnsupportedError,
} from '../../domain/books/errors.js'

const REFERENCE_PREFIX = 'opfs:v1:'
const DIRECTORY_NAME = 'reader-books-v1'
const CAPACITY_RESERVE_BYTES = 5 * 1024 * 1024

export class OpfsBookBinaryStorage {
  constructor({
    storageManager = globalThis.navigator?.storage,
    idFactory = () => globalThis.crypto.randomUUID(),
  } = {}) {
    this.storageManager = storageManager
    this.idFactory = idFactory
  }

  async write(blob) {
    if (!blob || typeof blob.size !== 'number') {
      throw new TypeError('Binary storage requires a Blob or File')
    }

    await this.ensureCapacity(blob.size)
    const id = this.idFactory()
    const reference = `${REFERENCE_PREFIX}${id}`
    let directory

    try {
      directory = await this.getDirectory()
      const handle = await directory.getFileHandle(fileName(id), { create: true })
      const writable = await handle.createWritable()
      try {
        await writable.write(blob)
        await writable.close()
      } catch (cause) {
        await abortQuietly(writable)
        await removeQuietly(directory, fileName(id))
        throw cause
      }
      return reference
    } catch (cause) {
      if (directory) await removeQuietly(directory, fileName(id))
      throw mapStorageError(cause)
    }
  }

  async open(reference) {
    const id = parseReference(reference)
    try {
      const directory = await this.getDirectory()
      const handle = await directory.getFileHandle(fileName(id))
      const file = await handle.getFile()
      if (file.size === 0) throw new BinaryCorruptError()
      return file
    } catch (cause) {
      throw mapStorageError(cause, { missingIsError: true })
    }
  }

  async delete(reference) {
    const id = parseReference(reference)
    try {
      const directory = await this.getDirectory()
      await directory.removeEntry(fileName(id))
    } catch (cause) {
      if (isNamedError(cause, 'NotFoundError')) return
      throw mapStorageError(cause)
    }
  }

  async exists(reference) {
    try {
      await this.open(reference)
      return true
    } catch (error) {
      if (error instanceof BinaryMissingError) return false
      throw error
    }
  }

  async inspectCapacity() {
    this.assertSupported()
    try {
      const estimate = typeof this.storageManager.estimate === 'function'
        ? await this.storageManager.estimate()
        : {}
      const persisted = typeof this.storageManager.persisted === 'function'
        ? await this.storageManager.persisted()
        : null
      const usage = finiteOrNull(estimate.usage)
      const quota = finiteOrNull(estimate.quota)

      return {
        supported: true,
        persisted,
        usage,
        quota,
        available: usage !== null && quota !== null ? Math.max(0, quota - usage) : null,
      }
    } catch (cause) {
      throw mapStorageError(cause)
    }
  }

  async requestPersistence() {
    this.assertSupported()
    if (typeof this.storageManager.persist !== 'function') {
      return { ...(await this.inspectCapacity()), requested: false }
    }

    try {
      const persisted = await this.storageManager.persist()
      return { ...(await this.inspectCapacity()), persisted, requested: true }
    } catch (cause) {
      throw mapStorageError(cause)
    }
  }

  async ensureCapacity(bytes) {
    const capacity = await this.inspectCapacity()
    if (
      capacity.available !== null
      && capacity.available < bytes + Math.min(bytes, CAPACITY_RESERVE_BYTES)
    ) {
      throw new StorageQuotaError()
    }
    return capacity
  }

  async getDirectory() {
    this.assertSupported()
    try {
      const root = await this.storageManager.getDirectory()
      return await root.getDirectoryHandle(DIRECTORY_NAME, { create: true })
    } catch (cause) {
      throw mapStorageError(cause)
    }
  }

  assertSupported() {
    if (!this.storageManager || typeof this.storageManager.getDirectory !== 'function') {
      throw new StorageUnsupportedError()
    }
  }
}

function parseReference(reference) {
  if (typeof reference !== 'string' || !reference.startsWith(REFERENCE_PREFIX)) {
    throw new StorageIoError()
  }
  const id = reference.slice(REFERENCE_PREFIX.length)
  if (!/^[a-zA-Z0-9-]{1,128}$/.test(id)) {
    throw new StorageIoError()
  }
  return id
}

function fileName(id) {
  return `${id}.bin`
}

function mapStorageError(cause, { missingIsError = false } = {}) {
  if (cause instanceof StorageUnsupportedError
    || cause instanceof StorageQuotaError
    || cause instanceof StoragePermissionError
    || cause instanceof BinaryMissingError
    || cause instanceof BinaryCorruptError
    || cause instanceof StorageIoError) {
    return cause
  }
  if (isNamedError(cause, 'QuotaExceededError')) return new StorageQuotaError({ cause })
  if (isNamedError(cause, 'NotAllowedError') || isNamedError(cause, 'SecurityError')) {
    return new StoragePermissionError({ cause })
  }
  if (missingIsError && isNamedError(cause, 'NotFoundError')) {
    return new BinaryMissingError({ cause })
  }
  return new StorageIoError({ cause })
}

function isNamedError(error, name) {
  return error?.name === name
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null
}

async function abortQuietly(writable) {
  if (typeof writable?.abort !== 'function') return
  try {
    await writable.abort()
  } catch {
    // The original write failure is more useful than an abort failure.
  }
}

async function removeQuietly(directory, name) {
  try {
    await directory.removeEntry(name)
  } catch {
    // A failed import is already reported; cleanup is best effort here.
  }
}
