export const READING_LOCATOR_VERSION = 1

export function createPdfLocator({
  page,
  pageCount,
  progression,
  textQuote,
  geometry,
} = {}) {
  const locator = {
    version: READING_LOCATOR_VERSION,
    format: 'pdf',
    progression: progression ?? progressionForPage(page, pageCount),
    pdf: {
      page,
      pageCount,
      ...(textQuote ? { textQuote: normalizeTextQuote(textQuote) } : {}),
      ...(geometry ? { geometry: normalizeGeometry(geometry) } : {}),
    },
  }
  return validateReadingLocator(locator)
}

export function createEpubLocator({
  cfi,
  spineHref,
  spineIndex,
  progression,
  progressionInResource,
  textQuote,
} = {}) {
  const locator = {
    version: READING_LOCATOR_VERSION,
    format: 'epub',
    progression,
    epub: {
      cfi,
      spineHref,
      ...(Number.isInteger(spineIndex) ? { spineIndex } : {}),
      ...(Number.isFinite(progressionInResource) ? { progressionInResource } : {}),
      ...(textQuote ? { textQuote: normalizeTextQuote(textQuote) } : {}),
    },
  }
  return validateReadingLocator(locator)
}

export function validateReadingLocator(locator, expectedFormat) {
  if (!locator || locator.version !== READING_LOCATOR_VERSION) {
    throw new TypeError('Reading locator version is unsupported')
  }
  if (!['pdf', 'epub'].includes(locator.format) || (expectedFormat && locator.format !== expectedFormat)) {
    throw new TypeError('Reading locator format does not match the book')
  }
  assertProgression(locator.progression)

  if (locator.format === 'pdf') validatePdf(locator.pdf)
  else validateEpub(locator.epub)

  return locator
}

function validatePdf(pdf) {
  if (!Number.isInteger(pdf?.page) || pdf.page < 1) {
    throw new TypeError('A PDF locator requires a one-based page number')
  }
  if (!Number.isInteger(pdf.pageCount) || pdf.pageCount < 1 || pdf.page > pdf.pageCount) {
    throw new TypeError('A PDF locator requires a valid page count')
  }
  if (pdf.textQuote) normalizeTextQuote(pdf.textQuote)
  if (pdf.geometry) normalizeGeometry(pdf.geometry)
}

function validateEpub(epub) {
  if (typeof epub?.cfi !== 'string' || !/^epubcfi\(.+!.+\)$/.test(epub.cfi.trim())) {
    throw new TypeError('An EPUB locator requires a content-document CFI')
  }
  if (typeof epub.spineHref !== 'string' || !epub.spineHref.trim()) {
    throw new TypeError('An EPUB locator requires a spine reference')
  }
  if (epub.spineIndex !== undefined && (!Number.isInteger(epub.spineIndex) || epub.spineIndex < 0)) {
    throw new TypeError('An EPUB spine index must be zero-based')
  }
  assertProgression(epub.progressionInResource)
  if (epub.textQuote) normalizeTextQuote(epub.textQuote)
}

function normalizeTextQuote(quote) {
  const exact = cleanText(quote?.exact)
  if (!exact) throw new TypeError('A text quote requires selected text')
  return {
    exact,
    prefix: cleanText(quote.prefix),
    suffix: cleanText(quote.suffix),
  }
}

function normalizeGeometry(rectangles) {
  if (!Array.isArray(rectangles) || rectangles.length === 0 || rectangles.length > 100) {
    throw new TypeError('Annotation geometry must contain bounded rectangles')
  }
  return rectangles.map((rect) => {
    const normalized = {}
    for (const key of ['x', 'y', 'width', 'height']) {
      if (!Number.isFinite(rect?.[key]) || rect[key] < 0 || rect[key] > 1) {
        throw new TypeError('Annotation geometry must use normalized coordinates')
      }
      normalized[key] = rect[key]
    }
    return normalized
  })
}

function progressionForPage(page, pageCount) {
  if (!Number.isInteger(page) || !Number.isInteger(pageCount) || pageCount < 1) return undefined
  if (pageCount === 1) return 1
  return (page - 1) / (pageCount - 1)
}

function assertProgression(value) {
  if (value === undefined || value === null) return
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new TypeError('Reading progression must be between zero and one')
  }
}

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}
