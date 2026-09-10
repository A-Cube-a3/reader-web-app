import { IndexedDbBooksRepository } from '../repositories/books/IndexedDbBooksRepository.js'
import { IndexedDbLibraryRepository } from '../repositories/library/IndexedDbLibraryRepository.js'
import { IndexedDbProgressRepository } from '../repositories/progress/IndexedDbProgressRepository.js'
import { IndexedDbSettingsRepository } from '../repositories/settings/IndexedDbSettingsRepository.js'
import {
  IndexedDbBookmarkRepository,
  IndexedDbHighlightRepository,
  IndexedDbNoteRepository,
} from '../repositories/annotations/IndexedDbAnnotationRepositories.js'
import { ReaderPreferencesRepository } from '../repositories/preferences/ReaderPreferencesRepository.js'
import { LocalLibraryService } from '../services/library/LocalLibraryService.js'
import { ReaderService } from '../services/reader/ReaderService.js'
import { ReaderToolsService } from '../services/reader/ReaderToolsService.js'
import { BookMetadataService } from '../services/metadata/BookMetadataService.js'
import { OpfsBookBinaryStorage } from '../storage/binary/OpfsBookBinaryStorage.js'
import { openLocalDatabase } from '../storage/database/schema.js'
import { createDefaultReaderRegistry } from '../reader/core/ReaderEngineRegistry.js'
import { webReaderLifecycle } from '../platform/web/readerLifecycle.js'

export function createLocalLibrary({ database = openLocalDatabase(), binaryStorage } = {}) {
  const booksRepository = new IndexedDbBooksRepository(database)
  const libraryRepository = new IndexedDbLibraryRepository(database)
  const progressRepository = new IndexedDbProgressRepository(database)
  const settingsRepository = new IndexedDbSettingsRepository(database)
  const bookmarkRepository = new IndexedDbBookmarkRepository(database)
  const highlightRepository = new IndexedDbHighlightRepository(database)
  const noteRepository = new IndexedDbNoteRepository(database)
  const preferencesRepository = new ReaderPreferencesRepository(settingsRepository)

  const library = new LocalLibraryService({
    booksRepository,
    libraryRepository,
    progressRepository,
    binaryStorage: binaryStorage || new OpfsBookBinaryStorage(),
    metadataService: new BookMetadataService(),
  })

  return {
    library,
    reader: new ReaderService({
      libraryService: library,
      engineRegistry: createDefaultReaderRegistry(),
      toolsService: new ReaderToolsService({
        booksRepository,
        progressRepository,
        bookmarkRepository,
        highlightRepository,
        noteRepository,
        preferencesRepository,
        lifecycle: webReaderLifecycle,
      }),
    }),
    repositories: {
      books: booksRepository,
      progress: progressRepository,
      settings: settingsRepository,
      bookmarks: bookmarkRepository,
      highlights: highlightRepository,
      notes: noteRepository,
      preferences: preferencesRepository,
    },
  }
}

export const localApplication = createLocalLibrary()
