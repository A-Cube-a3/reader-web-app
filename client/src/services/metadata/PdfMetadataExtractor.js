import { InvalidBookError } from '../../domain/books/errors.js'
import { readBlobAsArrayBuffer } from './blob.js'

export class PdfMetadataExtractor {
  constructor({ loadPdfModule = () => import('pdfjs-dist/build/pdf.mjs') } = {}) {
    this.loadPdfModule = loadPdfModule
  }

  async extract(file) {
    let document
    let loadingTask
    try {
      const pdfjs = await this.loadPdfModule()
      if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).href
      }
      const data = new Uint8Array(await readBlobAsArrayBuffer(file))
      loadingTask = pdfjs.getDocument({ data, isEvalSupported: false })
      document = await loadingTask.promise

      let metadata = {}
      try {
        metadata = await document.getMetadata()
      } catch {
        // A readable PDF may have missing or malformed optional metadata.
      }

      const info = metadata.info || {}
      const xmp = metadata.metadata
      const values = {
        title: info.Title || xmp?.get?.('dc:title'),
        author: info.Author || xmp?.get?.('dc:creator'),
        description: info.Subject || xmp?.get?.('dc:description'),
        publisher: xmp?.get?.('dc:publisher'),
        language: xmp?.get?.('dc:language'),
        identifier: xmp?.get?.('dc:identifier'),
      }

      return metadataResult({ ...values, pageCount: document.numPages })
    } catch (cause) {
      throw new InvalidBookError('The PDF is damaged, encrypted, or cannot be read.', { cause })
    } finally {
      if (document?.destroy) await document.destroy()
      else if (loadingTask?.destroy) await loadingTask.destroy()
    }
  }
}

function metadataResult(values) {
  const result = { source: 'pdf-embedded', extractedFields: [] }
  for (const [field, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === '') continue
    result[field] = value
    result.extractedFields.push(field)
  }
  return result
}
