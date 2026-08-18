import { describe, expect, it } from 'vitest'
import {
  BinaryCorruptError,
  BinaryMissingError,
  StorageQuotaError,
  StorageUnsupportedError,
} from '../../domain/books/errors.js'
import { OpfsBookBinaryStorage } from './OpfsBookBinaryStorage.js'

describe('OpfsBookBinaryStorage', () => {
  it('copies, opens, checks, and deletes an application-managed binary', async () => {
    const storageManager = createStorageManager()
    const storage = new OpfsBookBinaryStorage({ storageManager, idFactory: () => 'book-id' })
    const source = new File(['%PDF-example'], 'outside.pdf', { type: 'application/pdf' })

    const reference = await storage.write(source)

    expect(reference).toBe('opfs:v1:book-id')
    expect(await readBlob(await storage.open(reference))).toBe('%PDF-example')
    expect(await storage.exists(reference)).toBe(true)

    await storage.delete(reference)
    expect(await storage.exists(reference)).toBe(false)
    await expect(storage.open(reference)).rejects.toBeInstanceOf(BinaryMissingError)
    await expect(storage.delete(reference)).resolves.toBeUndefined()
  })

  it('rejects an import before writing when the quota estimate is exhausted', async () => {
    const storageManager = createStorageManager({ usage: 95, quota: 100 })
    const storage = new OpfsBookBinaryStorage({ storageManager })

    await expect(storage.write(new Blob(['123456']))).rejects.toBeInstanceOf(StorageQuotaError)
    expect(storageManager.files.size).toBe(0)
  })

  it('maps quota failures during a write and removes the partial file', async () => {
    const storageManager = createStorageManager({ writeError: namedError('QuotaExceededError') })
    const storage = new OpfsBookBinaryStorage({ storageManager, idFactory: () => 'partial' })

    await expect(storage.write(new Blob(['book']))).rejects.toBeInstanceOf(StorageQuotaError)
    expect(storageManager.files.size).toBe(0)
  })

  it('reports an empty managed file as corrupt', async () => {
    const storageManager = createStorageManager()
    const storage = new OpfsBookBinaryStorage({ storageManager, idFactory: () => 'empty' })
    await storage.write(new Blob(['book']))
    storageManager.files.set('empty.bin', new Blob())

    await expect(storage.open('opfs:v1:empty')).rejects.toBeInstanceOf(BinaryCorruptError)
  })

  it('reports persistence and capacity without assuming persistence is available', async () => {
    const storageManager = createStorageManager({ usage: 100, quota: 1000, persisted: false })
    const storage = new OpfsBookBinaryStorage({ storageManager })

    expect(await storage.inspectCapacity()).toEqual({
      supported: true,
      persisted: false,
      usage: 100,
      quota: 1000,
      available: 900,
    })
    expect(await storage.requestPersistence()).toMatchObject({ persisted: true, requested: true })
  })

  it('returns a typed unsupported error when OPFS is unavailable', async () => {
    const storage = new OpfsBookBinaryStorage({ storageManager: {} })

    await expect(storage.inspectCapacity()).rejects.toBeInstanceOf(StorageUnsupportedError)
  })
})

function createStorageManager({
  usage = 0,
  quota = 1024 * 1024,
  persisted = false,
  writeError = null,
} = {}) {
  const files = new Map()
  const directory = {
    async getFileHandle(name, { create = false } = {}) {
      if (!files.has(name) && !create) throw namedError('NotFoundError')
      if (!files.has(name)) files.set(name, new Blob())
      return {
        async createWritable() {
          return {
            async write(blob) {
              if (writeError) throw writeError
              files.set(name, blob)
            },
            async close() {},
            async abort() {},
          }
        },
        async getFile() {
          const blob = files.get(name)
          if (!blob) throw namedError('NotFoundError')
          return new File([blob], name, { type: blob.type })
        },
      }
    },
    async removeEntry(name) {
      if (!files.delete(name)) throw namedError('NotFoundError')
    },
  }
  const root = {
    async getDirectoryHandle() {
      return directory
    },
  }

  return {
    files,
    async getDirectory() {
      return root
    },
    async estimate() {
      return { usage, quota }
    },
    async persisted() {
      return persisted
    },
    async persist() {
      persisted = true
      return true
    },
  }
}

function namedError(name) {
  const error = new Error(name)
  error.name = name
  return error
}

function readBlob(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(reader.result))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsText(blob)
  })
}
