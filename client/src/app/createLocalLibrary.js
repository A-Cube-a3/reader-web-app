import { IndexedDbBooksRepository } from '../repositories/books/IndexedDbBooksRepository.js'
import { IndexedDbLibraryRepository } from '../repositories/library/IndexedDbLibraryRepository.js'
import { IndexedDbProgressRepository } from '../repositories/progress/IndexedDbProgressRepository.js'
import { IndexedDbSettingsRepository } from '../repositories/settings/IndexedDbSettingsRepository.js'
import { LocalLibraryService } from '../services/library/LocalLibraryService.js'
import { BookMetadataService } from '../services/metadata/BookMetadataService.js'
import { OpfsBookBinaryStorage } from '../storage/binary/OpfsBookBinaryStorage.js'
import { openLocalDatabase } from '../storage/database/schema.js'

export function createLocalLibrary({ database = openLocalDatabase(), binaryStorage } = {}) {
  const booksRepository = new IndexedDbBooksRepository(database)
  const libraryRepository = new IndexedDbLibraryRepository(database)

  return {
    library: new LocalLibraryService({
      booksRepository,
      libraryRepository,
      binaryStorage: binaryStorage || new OpfsBookBinaryStorage(),
      metadataService: new BookMetadataService(),
    }),
    repositories: {
      books: booksRepository,
      progress: new IndexedDbProgressRepository(database),
      settings: new IndexedDbSettingsRepository(database),
    },
  }
}

export const localApplication = createLocalLibrary()
