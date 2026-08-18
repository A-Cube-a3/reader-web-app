import JSZip from 'jszip'
import { InvalidBookError } from '../../domain/books/errors.js'
import { readBlobAsArrayBuffer } from './blob.js'

const EPUB_MIMETYPE = 'application/epub+zip'
const MAX_ARCHIVE_ENTRIES = 10_000
const MAX_XML_BYTES = 2 * 1024 * 1024
const MAX_COVER_BYTES = 10 * 1024 * 1024

export class EpubMetadataExtractor {
  async extract(file) {
    try {
      const zip = await JSZip.loadAsync(await readBlobAsArrayBuffer(file), { createFolders: false })
      validateArchiveEntries(zip)

      const mimetype = zip.file('mimetype')
      if (!mimetype || await boundedText(mimetype, 256) !== EPUB_MIMETYPE) {
        throw new InvalidBookError('The EPUB container has an invalid mimetype entry.')
      }

      const container = parseXml(
        await boundedText(requiredEntry(zip, 'META-INF/container.xml'), MAX_XML_BYTES),
        'EPUB container',
      )
      const rootfile = [...container.getElementsByTagNameNS('*', 'rootfile')][0]
      const packagePath = safeArchivePath(rootfile?.getAttribute('full-path'))
      if (!packagePath) throw new InvalidBookError('The EPUB does not identify a package document.')

      const packageDocument = parseXml(
        await boundedText(requiredEntry(zip, packagePath), MAX_XML_BYTES),
        'EPUB package document',
      )
      const packageDirectory = directoryOf(packagePath)
      const result = extractPackageMetadata(packageDocument)
      result.tableOfContents = await extractTableOfContents(zip, packageDocument, packageDirectory)
      result.cover = await extractCover(zip, packageDocument, packageDirectory)
      return result
    } catch (cause) {
      if (cause instanceof InvalidBookError) throw cause
      throw new InvalidBookError('The EPUB is damaged or cannot be read safely.', { cause })
    }
  }
}

function validateArchiveEntries(zip) {
  const entries = Object.values(zip.files)
  if (entries.length > MAX_ARCHIVE_ENTRIES) {
    throw new InvalidBookError('The EPUB contains too many archive entries.')
  }
  for (const entry of entries) {
    const original = entry.unsafeOriginalName
    if (original && original !== entry.name) {
      throw new InvalidBookError('The EPUB contains an unsafe archive path.')
    }
    if (!entry.dir) safeArchivePath(entry.name)
  }
}

function extractPackageMetadata(document) {
  const values = {
    title: firstElementText(document, 'title'),
    author: allElementText(document, 'creator').join('; '),
    description: firstElementText(document, 'description'),
    publisher: firstElementText(document, 'publisher'),
    language: firstElementText(document, 'language'),
    identifier: firstElementText(document, 'identifier'),
  }
  const result = { source: 'epub-package', extractedFields: [] }
  for (const [field, value] of Object.entries(values)) {
    if (!value) continue
    result[field] = value
    result.extractedFields.push(field)
  }
  return result
}

async function extractCover(zip, document, packageDirectory) {
  const items = manifestItems(document)
  let item = items.find(({ properties }) => properties.split(/\s+/).includes('cover-image'))
  if (!item) {
    const coverId = [...document.getElementsByTagNameNS('*', 'meta')]
      .find((meta) => meta.getAttribute('name')?.toLowerCase() === 'cover')
      ?.getAttribute('content')
    item = items.find(({ id }) => id === coverId)
  }
  if (!item) return null

  const entry = zip.file(resolveArchivePath(packageDirectory, item.href))
  if (!entry) return null
  assertEntrySize(entry, MAX_COVER_BYTES)
  const bytes = await entry.async('uint8array')
  if (bytes.byteLength > MAX_COVER_BYTES) {
    throw new InvalidBookError('The EPUB cover exceeds the safe extraction limit.')
  }
  return {
    blob: new Blob([bytes], { type: safeImageType(item.mediaType) }),
    mediaType: safeImageType(item.mediaType),
  }
}

async function extractTableOfContents(zip, document, packageDirectory) {
  const items = manifestItems(document)
  const navItem = items.find(({ properties }) => properties.split(/\s+/).includes('nav'))
  if (navItem) {
    const navPath = resolveArchivePath(packageDirectory, navItem.href)
    const navEntry = zip.file(navPath)
    if (navEntry) {
      const html = new DOMParser().parseFromString(
        await boundedText(navEntry, MAX_XML_BYTES),
        'text/html',
      )
      const nav = [...html.querySelectorAll('nav')].find((element) => (
        element.getAttribute('epub:type')?.split(/\s+/).includes('toc')
        || element.getAttribute('role') === 'doc-toc'
      ))
      if (nav) return linkEntries(nav, packageDirectory)
    }
  }

  const spine = [...document.getElementsByTagNameNS('*', 'spine')][0]
  const ncxId = spine?.getAttribute('toc')
  const ncxItem = items.find(({ id, mediaType }) => (
    id === ncxId || mediaType === 'application/x-dtbncx+xml'
  ))
  if (!ncxItem) return []
  const ncxPath = resolveArchivePath(packageDirectory, ncxItem.href)
  const ncx = parseXml(await boundedText(requiredEntry(zip, ncxPath), MAX_XML_BYTES), 'EPUB NCX')
  return [...ncx.getElementsByTagNameNS('*', 'navPoint')].slice(0, 500).flatMap((point) => {
    const label = firstElementText(point, 'text')
    const source = [...point.getElementsByTagNameNS('*', 'content')][0]?.getAttribute('src')
    return label && source ? [{ label, href: resolveArchivePath(packageDirectory, source) }] : []
  })
}

function manifestItems(document) {
  return [...document.getElementsByTagNameNS('*', 'item')].map((item) => ({
    id: item.getAttribute('id') || '',
    href: item.getAttribute('href') || '',
    mediaType: item.getAttribute('media-type') || '',
    properties: item.getAttribute('properties') || '',
  }))
}

function linkEntries(root, packageDirectory) {
  return [...root.querySelectorAll('a[href]')].slice(0, 500).flatMap((link) => {
    const label = cleanText(link.textContent)
    const href = link.getAttribute('href')
    return label && href
      ? [{ label, href: resolveArchivePath(packageDirectory, href) }]
      : []
  })
}

function parseXml(text, label) {
  const document = new DOMParser().parseFromString(text, 'application/xml')
  if (document.querySelector('parsererror')) {
    throw new InvalidBookError(`${label} is malformed.`)
  }
  return document
}

function requiredEntry(zip, path) {
  const entry = zip.file(path)
  if (!entry) throw new InvalidBookError(`The EPUB is missing ${path}.`)
  return entry
}

async function boundedText(entry, maximumBytes) {
  assertEntrySize(entry, maximumBytes)
  const bytes = await entry.async('uint8array')
  if (bytes.byteLength > maximumBytes) {
    throw new InvalidBookError('An EPUB metadata entry exceeds the safe extraction limit.')
  }
  return new TextDecoder().decode(bytes)
}

function assertEntrySize(entry, maximumBytes) {
  const size = entry?._data?.uncompressedSize
  if (Number.isFinite(size) && size > maximumBytes) {
    throw new InvalidBookError('An EPUB metadata entry exceeds the safe extraction limit.')
  }
}

function safeArchivePath(path) {
  if (!path || typeof path !== 'string' || path.includes('\\') || path.startsWith('/')) {
    throw new InvalidBookError('The EPUB contains an unsafe archive path.')
  }
  const [pathname] = path.split(/[?#]/, 1)
  const segments = pathname.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new InvalidBookError('The EPUB contains an unsafe archive path.')
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(pathname)) {
    throw new InvalidBookError('The EPUB contains an external archive path.')
  }
  return pathname
}

function resolveArchivePath(base, relative) {
  const [pathname, suffix = ''] = String(relative || '').split(/(?=[?#])/, 2)
  if (/^[a-z][a-z0-9+.-]*:/i.test(pathname) || pathname.startsWith('/')) {
    throw new InvalidBookError('The EPUB contains an external content reference.')
  }
  const segments = `${base}${pathname}`.split('/')
  const normalized = []
  for (const segment of segments) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      if (normalized.length === 0) throw new InvalidBookError('The EPUB path escapes its container.')
      normalized.pop()
    } else {
      normalized.push(segment)
    }
  }
  return `${safeArchivePath(normalized.join('/'))}${suffix}`
}

function directoryOf(path) {
  const lastSlash = path.lastIndexOf('/')
  return lastSlash < 0 ? '' : path.slice(0, lastSlash + 1)
}

function firstElementText(root, localName) {
  return cleanText([...root.getElementsByTagNameNS('*', localName)][0]?.textContent)
}

function allElementText(root, localName) {
  return [...root.getElementsByTagNameNS('*', localName)].map(({ textContent }) => cleanText(textContent)).filter(Boolean)
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function safeImageType(mediaType) {
  return ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'].includes(mediaType)
    ? mediaType
    : 'application/octet-stream'
}
