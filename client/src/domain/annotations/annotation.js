import { validateReadingLocator } from '../reading/locator.js'

export const HIGHLIGHT_COLORS = Object.freeze(['yellow', 'green', 'blue', 'pink'])

export function createBookmark({ id, bookId, locator, label, now }) {
  validateIdentity(id, bookId)
  const validLocator = validateReadingLocator(locator)
  const timestamp = validTimestamp(now)
  return {
    id,
    bookId,
    locator: validLocator,
    label: boundedText(label, 200) || locationLabel(validLocator),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function createHighlight({ id, bookId, locator, color = 'yellow', now }) {
  validateIdentity(id, bookId)
  const validLocator = validateReadingLocator(locator)
  const quote = quoteFromLocator(validLocator)
  if (!quote?.exact) throw new TypeError('A highlight requires an anchored text selection')
  if (!HIGHLIGHT_COLORS.includes(color)) throw new TypeError('Highlight color is unsupported')
  const timestamp = validTimestamp(now)
  return {
    id,
    bookId,
    locator: validLocator,
    quote,
    color,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function createNote({ id, bookId, body, highlightId = null, locator = null, now }) {
  validateIdentity(id, bookId)
  if (highlightId !== null && !isUuid(highlightId)) throw new TypeError('A note highlight reference must be a UUID')
  const timestamp = validTimestamp(now)
  return {
    id,
    bookId,
    body: requiredBody(body),
    highlightId,
    locator: locator ? validateReadingLocator(locator) : null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function updateNote(note, body, now) {
  return {
    ...note,
    body: requiredBody(body),
    updatedAt: validTimestamp(now),
  }
}

export function quoteFromLocator(locator) {
  return locator?.format === 'pdf' ? locator.pdf?.textQuote : locator?.epub?.textQuote
}

export function locationLabel(locator) {
  if (locator.format === 'pdf') return `Page ${locator.pdf.page}`
  const quote = quoteFromLocator(locator)?.exact
  return quote ? boundedText(quote, 60) : `EPUB location ${Math.round((locator.progression || 0) * 100)}%`
}

function validateIdentity(id, bookId) {
  if (!isUuid(id) || !isUuid(bookId)) throw new TypeError('Local reading records require UUID identities')
}

function isUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function validTimestamp(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new TypeError('Local reading records require a timestamp')
  }
  return value
}

function requiredBody(value) {
  const text = String(value || '').replace(/\r\n?/g, '\n').trim().slice(0, 100_000)
  if (!text) throw new TypeError('A note cannot be empty')
  return text
}

function boundedText(value, limit) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit)
}
