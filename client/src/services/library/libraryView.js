const SEARCH_FIELDS = [
  'title',
  'author',
  'publisher',
  'language',
  'identifier',
  'description',
  'originalFilename',
]

export function filterLibrary(books, { query = '', format = 'all' } = {}) {
  const normalizedQuery = normalizeSearch(query)
  return books.filter((book) => {
    if (format !== 'all' && book.format !== format) return false
    if (!normalizedQuery) return true
    return SEARCH_FIELDS.some((field) => normalizeSearch(book[field]).includes(normalizedQuery))
  })
}

export function getContinueReading(books, limit = 4) {
  return books
    .filter((book) => {
      const progression = book.progress?.progression
      if (book.readingStatus === 'completed' || book.readingStatus === 'dropped') return false
      if (Number.isFinite(progression)) return progression > 0 && progression < 1
      return Boolean(book.lastOpenedAt)
    })
    .sort((left, right) => recentTimestamp(right) - recentTimestamp(left))
    .slice(0, limit)
}

export function getRecentBooks(books, limit = 4) {
  return [...books]
    .sort((left, right) => recentTimestamp(right) - recentTimestamp(left))
    .slice(0, limit)
}

function recentTimestamp(book) {
  return Math.max(
    parseTimestamp(book.progress?.updatedAt),
    parseTimestamp(book.lastOpenedAt),
    parseTimestamp(book.importedAt),
    parseTimestamp(book.updatedAt),
  )
}

function parseTimestamp(value) {
  return Date.parse(value) || 0
}

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim()
}
