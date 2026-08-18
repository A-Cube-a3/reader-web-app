import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vitest'
import {
  BookTooLargeError,
  InvalidBookError,
  UnsupportedBookError,
} from '../../domain/books/errors.js'
import { detectBookFormat } from './detectBookFormat.js'
import { EpubMetadataExtractor } from './EpubMetadataExtractor.js'
import { PdfMetadataExtractor } from './PdfMetadataExtractor.js'

describe('book format detection', () => {
  it('recognizes content signatures rather than trusting extensions', async () => {
    expect(await detectBookFormat(file('%PDF-1.7', 'wrong.epub'))).toBe('pdf')
    expect(await detectBookFormat(file(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), 'wrong.pdf'))).toBe('epub')
  })

  it('rejects empty, disguised, unsupported, and oversized files', async () => {
    await expect(detectBookFormat(file('', 'empty.pdf'))).rejects.toBeInstanceOf(InvalidBookError)
    await expect(detectBookFormat(file('plain text', 'fake.pdf'))).rejects.toBeInstanceOf(InvalidBookError)
    await expect(detectBookFormat(file('plain text', 'notes.txt'))).rejects.toBeInstanceOf(UnsupportedBookError)
    await expect(detectBookFormat(file('%PDF-long', 'large.pdf'), { maximumBytes: 2 }))
      .rejects.toBeInstanceOf(BookTooLargeError)
  })
})

describe('PdfMetadataExtractor', () => {
  it('extracts embedded metadata and page count through PDF.js', async () => {
    const destroy = vi.fn()
    const extractor = new PdfMetadataExtractor({
      loadPdfModule: async () => ({
        GlobalWorkerOptions: { workerSrc: 'test-worker' },
        getDocument: () => ({
          promise: Promise.resolve({
            numPages: 42,
            getMetadata: async () => ({ info: { Title: 'Local PDF', Author: 'Ada' } }),
            destroy,
          }),
        }),
      }),
    })

    await expect(extractor.extract(file('%PDF-1.7', 'book.pdf'))).resolves.toMatchObject({
      title: 'Local PDF',
      author: 'Ada',
      pageCount: 42,
      source: 'pdf-embedded',
      extractedFields: expect.arrayContaining(['title', 'author', 'pageCount']),
    })
    expect(destroy).toHaveBeenCalledOnce()
  })

  it('maps unreadable PDFs to a stable domain error', async () => {
    const extractor = new PdfMetadataExtractor({
      loadPdfModule: async () => ({
        GlobalWorkerOptions: { workerSrc: 'test-worker' },
        getDocument: () => ({ promise: Promise.reject(new Error('bad xref')) }),
      }),
    })

    await expect(extractor.extract(file('%PDF-bad', 'bad.pdf'))).rejects.toMatchObject({
      code: 'INVALID_BOOK',
    })
  })
})

describe('EpubMetadataExtractor', () => {
  it('extracts package metadata, cover, and navigation without executing content', async () => {
    const extractor = new EpubMetadataExtractor()
    const publication = await epubFile()

    const metadata = await extractor.extract(publication)

    expect(metadata).toMatchObject({
      title: 'Offline Reader',
      author: 'A. Author',
      publisher: 'Local Press',
      language: 'en',
      identifier: 'urn:isbn:123',
      source: 'epub-package',
      tableOfContents: [{ label: 'Chapter One', href: 'EPUB/chapter.xhtml#start' }],
      cover: { mediaType: 'image/png' },
    })
    expect(metadata.cover.blob.size).toBe(4)
  })

  it('rejects invalid mimetype and container traversal', async () => {
    const extractor = new EpubMetadataExtractor()
    const invalidMime = await epubFile({ mimetype: 'application/zip' })
    const traversal = await epubFile({ packagePath: '../outside.opf' })

    await expect(extractor.extract(invalidMime)).rejects.toBeInstanceOf(InvalidBookError)
    await expect(extractor.extract(traversal)).rejects.toBeInstanceOf(InvalidBookError)
  })

  it('rejects oversized metadata before decompression', async () => {
    const extractor = new EpubMetadataExtractor()
    const zip = new JSZip()
    zip.file('mimetype', 'application/epub+zip')
    zip.file('META-INF/container.xml', 'x'.repeat(2 * 1024 * 1024 + 1))
    const bytes = await zip.generateAsync({ type: 'uint8array' })

    await expect(extractor.extract(file(bytes, 'oversized.epub')))
      .rejects.toBeInstanceOf(InvalidBookError)
  })
})

async function epubFile({ mimetype = 'application/epub+zip', packagePath = 'EPUB/package.opf' } = {}) {
  const zip = new JSZip()
  zip.file('mimetype', mimetype, { compression: 'STORE' })
  zip.file('META-INF/container.xml', `<?xml version="1.0"?>
    <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
      <rootfiles><rootfile full-path="${packagePath}" media-type="application/oebps-package+xml"/></rootfiles>
    </container>`)
  zip.file('EPUB/package.opf', `<?xml version="1.0"?>
    <package xmlns="http://www.idpf.org/2007/opf" version="3.0">
      <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:title>Offline Reader</dc:title><dc:creator>A. Author</dc:creator>
        <dc:publisher>Local Press</dc:publisher><dc:language>en</dc:language>
        <dc:identifier>urn:isbn:123</dc:identifier>
      </metadata>
      <manifest>
        <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
        <item id="cover" href="cover.png" media-type="image/png" properties="cover-image"/>
      </manifest><spine/>
    </package>`)
  zip.file('EPUB/nav.xhtml', `<html xmlns="http://www.w3.org/1999/xhtml">
    <body><nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops">
      <a href="chapter.xhtml#start">Chapter One</a>
      <script>globalThis.EPUB_SCRIPT_RAN = true</script>
    </nav></body></html>`)
  zip.file('EPUB/cover.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
  const bytes = await zip.generateAsync({ type: 'uint8array' })
  return file(bytes, 'book.epub', 'application/epub+zip')
}

function file(contents, name, type = '') {
  return new File([contents], name, { type })
}
