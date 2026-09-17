import { describe, expect, it } from 'vitest'
import { addBookToCollection, createCollection, removeBookFromCollection, renameCollection } from './collection.js'

const collectionId = '11111111-1111-4111-8111-111111111111'
const bookId = '22222222-2222-4222-8222-222222222222'

describe('collection records', () => {
  it('creates, renames, and manages unique book membership', () => {
    const created = createCollection({ id: collectionId, name: '  Research   shelf ', now: '2026-09-17T00:00:00.000Z' })
    expect(created).toMatchObject({ name: 'Research shelf', bookIds: [] })
    const populated = addBookToCollection(created, bookId, '2026-09-17T01:00:00.000Z')
    expect(addBookToCollection(populated, bookId, '2026-09-17T02:00:00.000Z')).toBe(populated)
    expect(renameCollection(populated, 'Reference', '2026-09-17T03:00:00.000Z').name).toBe('Reference')
    expect(removeBookFromCollection(populated, bookId, '2026-09-17T04:00:00.000Z').bookIds).toEqual([])
  })

  it('rejects empty names and unstable identities', () => {
    expect(() => createCollection({ id: 'local', name: 'Shelf', now: '2026-09-17T00:00:00.000Z' })).toThrow(/UUID/)
    expect(() => createCollection({ id: collectionId, name: ' ', now: '2026-09-17T00:00:00.000Z' })).toThrow(/empty/)
  })
})
