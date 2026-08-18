export class LibraryError extends Error {
  constructor(message, { code = 'LIBRARY_ERROR', cause = undefined } = {}) {
    super(message, { cause })
    this.name = this.constructor.name
    this.code = code
  }
}

export class InvalidBookError extends LibraryError {
  constructor(message = 'This file is not a valid PDF or EPUB.', options = {}) {
    super(message, { ...options, code: 'INVALID_BOOK' })
  }
}

export class UnsupportedBookError extends LibraryError {
  constructor(message = 'Only PDF and EPUB books are supported.', options = {}) {
    super(message, { ...options, code: 'UNSUPPORTED_BOOK' })
  }
}

export class BookTooLargeError extends LibraryError {
  constructor(maximumBytes, options = {}) {
    super(`This book exceeds the ${formatBytes(maximumBytes)} import limit.`, {
      ...options,
      code: 'BOOK_TOO_LARGE',
    })
    this.maximumBytes = maximumBytes
  }
}

export class BookNotFoundError extends LibraryError {
  constructor(options = {}) {
    super('The requested local book no longer exists.', { ...options, code: 'BOOK_NOT_FOUND' })
  }
}

export class StorageError extends LibraryError {}

export class StorageUnsupportedError extends StorageError {
  constructor(options = {}) {
    super('This browser does not provide the required private file storage.', {
      ...options,
      code: 'STORAGE_UNSUPPORTED',
    })
  }
}

export class StorageQuotaError extends StorageError {
  constructor(options = {}) {
    super('There is not enough browser storage available to import this book.', {
      ...options,
      code: 'STORAGE_QUOTA_EXCEEDED',
    })
  }
}

export class BinaryMissingError extends StorageError {
  constructor(options = {}) {
    super('The locally stored book file is missing.', {
      ...options,
      code: 'BINARY_MISSING',
    })
  }
}

export class BinaryCorruptError extends StorageError {
  constructor(options = {}) {
    super('The locally stored book file is empty or corrupt.', {
      ...options,
      code: 'BINARY_CORRUPT',
    })
  }
}

export class StoragePermissionError extends StorageError {
  constructor(options = {}) {
    super('The browser denied access to private book storage.', {
      ...options,
      code: 'STORAGE_PERMISSION_DENIED',
    })
  }
}

export class StorageIoError extends StorageError {
  constructor(options = {}) {
    super('The browser could not complete the local storage operation.', {
      ...options,
      code: 'STORAGE_IO_ERROR',
    })
  }
}

export class DatabaseError extends LibraryError {
  constructor(options = {}) {
    super('The local library database could not complete the operation.', {
      ...options,
      code: 'DATABASE_ERROR',
    })
  }
}

function formatBytes(bytes) {
  return `${Math.round(bytes / (1024 * 1024))} MB`
}
