import { IndexedDbBooksRepository } from '../repositories/books/IndexedDbBooksRepository.js'
import { IndexedDbLibraryRepository } from '../repositories/library/IndexedDbLibraryRepository.js'
import { IndexedDbProgressRepository } from '../repositories/progress/IndexedDbProgressRepository.js'
import { IndexedDbSettingsRepository } from '../repositories/settings/IndexedDbSettingsRepository.js'
import { LocalLibraryService } from '../services/library/LocalLibraryService.js'
import { ReaderService } from '../services/reader/ReaderService.js'
import { BookMetadataService } from '../services/metadata/BookMetadataService.js'
import { OpfsBookBinaryStorage } from '../storage/binary/OpfsBookBinaryStorage.js'
import { openLocalDatabase } from '../storage/database/schema.js'
import { createDefaultReaderRegistry } from '../reader/core/ReaderEngineRegistry.js'

export function createLocalLibrary({ database = openLocalDatabase(), binaryStorage } = {}) {
  const booksRepository = new IndexedDbBooksRepository(database)
  const libraryRepository = new IndexedDbLibraryRepository(database)
  const progressRepository = new IndexedDbProgressRepository(database)
  const settingsRepository = new IndexedDbSettingsRepository(database)

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
    }),
    repositories: {
      books: booksRepository,
      progress: progressRepository,
      settings: settingsRepository,
    },
  }
}

export const localApplication = createLocalLibrary()
