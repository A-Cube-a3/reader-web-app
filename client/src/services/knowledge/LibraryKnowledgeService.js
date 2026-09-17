import { updateAnnotationTags, updateNote } from '../../domain/annotations/annotation.js'
import { updateBookOrganization } from '../../domain/books/book.js'
import {
  addBookToCollection,
  createCollection,
  removeBookFromCollection,
  renameCollection,
} from '../../domain/collections/collection.js'
import { calculateLibraryStatistics } from '../statistics/libraryStatistics.js'

export class LibraryKnowledgeService {
  constructor({
    booksRepository,
    collectionRepository,
    highlightRepository,
    noteRepository,
    activityRepository,
    idFactory = () => globalThis.crypto.randomUUID(),
    clock = () => new Date().toISOString(),
  }) {
    Object.assign(this, {
      booksRepository,
      collectionRepository,
      highlightRepository,
      noteRepository,
      activityRepository,
      idFactory,
      clock,
    })
  }

  async load(books = null) {
    const [localBooks, collections, highlights, notes, activities] = await Promise.all([
      books || this.booksRepository.list(),
      this.collectionRepository.list(),
      this.highlightRepository.listAll(),
      this.noteRepository.listAll(),
      this.activityRepository.list(),
    ])
    const tags = [...new Set([...highlights, ...notes].flatMap((item) => item.tags || []))].sort()
    return {
      books: localBooks,
      collections,
      highlights,
      notes,
      tags,
      statistics: calculateLibraryStatistics({ books: localBooks, activities }),
    }
  }

  async createCollection(name) {
    const collection = createCollection({ id: this.idFactory(), name, now: this.clock() })
    await this.collectionRepository.add(collection)
    return collection
  }

  async renameCollection(id, name) {
    const collection = await this.requireCollection(id)
    const updated = renameCollection(collection, name, this.clock())
    await this.collectionRepository.put(updated)
    return updated
  }

  async deleteCollection(id) {
    await this.requireCollection(id)
    await this.collectionRepository.delete(id)
  }

  async setBookInCollection(collectionId, bookId, included) {
    const [collection, book] = await Promise.all([
      this.requireCollection(collectionId),
      this.booksRepository.get(bookId),
    ])
    if (!book) throw new Error('Book was not found in this local library.')
    const updated = included
      ? addBookToCollection(collection, bookId, this.clock())
      : removeBookFromCollection(collection, bookId, this.clock())
    await this.collectionRepository.put(updated)
    return updated
  }

  async updateBookOrganization(bookId, changes) {
    const book = await this.booksRepository.get(bookId)
    if (!book) throw new Error('Book was not found in this local library.')
    const updated = updateBookOrganization(book, changes, this.clock())
    if (updated !== book) await this.booksRepository.put(updated)
    return updated
  }

  async updateNote(id, body) {
    const existing = await this.noteRepository.get(id)
    if (!existing) throw new Error('Note was not found.')
    const updated = updateNote(existing, body, this.clock())
    await this.noteRepository.put(updated)
    return updated
  }

  async updateTags(type, id, tags) {
    const repository = this.annotationRepository(type)
    const existing = await repository.get(id)
    if (!existing) throw new Error(`${type === 'note' ? 'Note' : 'Highlight'} was not found.`)
    const updated = updateAnnotationTags(existing, tags, this.clock())
    await repository.put(updated)
    return updated
  }

  async deleteNote(id) {
    if (!await this.noteRepository.get(id)) throw new Error('Note was not found.')
    await this.noteRepository.delete(id)
  }

  async deleteHighlight(id) {
    const highlight = await this.highlightRepository.get(id)
    if (!highlight) throw new Error('Highlight was not found.')
    const linkedNotes = await this.noteRepository.listByHighlight(id)
    for (const note of linkedNotes) {
      await this.noteRepository.put({
        ...note,
        highlightId: null,
        locator: note.locator || highlight.locator,
        updatedAt: this.clock(),
      })
    }
    await this.highlightRepository.delete(id)
  }

  annotationRepository(type) {
    if (type === 'note') return this.noteRepository
    if (type === 'highlight') return this.highlightRepository
    throw new TypeError('Annotation type is unsupported')
  }

  async requireCollection(id) {
    const collection = await this.collectionRepository.get(id)
    if (!collection) throw new Error('Collection was not found.')
    return collection
  }
}
