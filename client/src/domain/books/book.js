export const BOOK_FORMATS = Object.freeze({
  PDF: 'pdf',
  EPUB: 'epub',
})

export const READING_STATUSES = Object.freeze({
  WANT_TO_READ: 'want-to-read',
  CURRENTLY_READING: 'currently-reading',
  COMPLETED: 'completed',
  DROPPED: 'dropped',
})

const EDITABLE_METADATA_FIELDS = Object.freeze([
  'title',
  'author',
  'description',
  'publisher',
  'language',
  'identifier',
])

export function createBookRecord({
  id,
  format,
  binaryReference,
  coverReference = null,
  originalFilename,
  fileSize,
  metadata = {},
  now = new Date().toISOString(),
}) {
  if (!isUuid(id) || !Object.values(BOOK_FORMATS).includes(format) || !binaryReference) {
    throw new TypeError('A book requires a UUID, supported format, and binary reference')
  }

  const title = cleanText(metadata.title) || titleFromFilename(originalFilename)

  return {
    id,
    title,
    author: cleanText(metadata.author),
    description: cleanText(metadata.description),
    publisher: cleanText(metadata.publisher),
    language: cleanText(metadata.language),
    identifier: cleanText(metadata.identifier),
    format,
    coverReference,
    binaryReference,
    originalFilename: normalizeFilename(originalFilename),
    fileSize,
    importedAt: now,
    updatedAt: now,
    lastOpenedAt: null,
    readingStatus: READING_STATUSES.WANT_TO_READ,
    favorite: false,
    metadataSource: {
      type: metadata.source || 'filename',
      extractedFields: Array.isArray(metadata.extractedFields) ? metadata.extractedFields : [],
      userEditedFields: [],
    },
    pageCount: Number.isInteger(metadata.pageCount) ? metadata.pageCount : null,
    tableOfContents: normalizeTableOfContents(metadata.tableOfContents),
  }
}

function isUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function updateBookMetadata(book, changes, now = new Date().toISOString()) {
  const nextBook = { ...book }
  const editedFields = []

  for (const field of EDITABLE_METADATA_FIELDS) {
    if (!Object.hasOwn(changes, field)) continue

    const value = cleanText(changes[field])
    if (field === 'title' && !value) {
      throw new TypeError('A book title cannot be empty')
    }
    nextBook[field] = value
    editedFields.push(field)
  }

  if (editedFields.length === 0) return book

  nextBook.updatedAt = now
  nextBook.metadataSource = {
    ...(book.metadataSource || { type: 'filename', extractedFields: [] }),
    userEditedFields: [
      ...new Set([...(book.metadataSource?.userEditedFields || []), ...editedFields]),
    ],
  }
  return nextBook
}

export function titleFromFilename(filename) {
  const normalized = normalizeFilename(filename)
  const withoutExtension = normalized.replace(/\.(pdf|epub)$/i, '').trim()
  return withoutExtension || 'Untitled book'
}

export function normalizeFilename(filename) {
  if (typeof filename !== 'string') return 'book'
  const leafName = filename.replaceAll('\\', '/').split('/').pop().trim()
  return leafName || 'book'
}

function cleanText(value) {
  if (Array.isArray(value)) {
    return value.map(cleanText).filter(Boolean).join('; ')
  }
  if (value === null || value === undefined) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function normalizeTableOfContents(entries) {
  if (!Array.isArray(entries)) return []
  return entries.slice(0, 500).flatMap((entry) => {
    const label = cleanText(entry?.label)
    const href = cleanText(entry?.href)
    return label && href ? [{ label, href }] : []
  })
}
