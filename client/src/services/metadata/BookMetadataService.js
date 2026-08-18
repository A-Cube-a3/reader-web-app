import { EpubMetadataExtractor } from './EpubMetadataExtractor.js'
import { PdfMetadataExtractor } from './PdfMetadataExtractor.js'

export class BookMetadataService {
  constructor({
    pdfExtractor = new PdfMetadataExtractor(),
    epubExtractor = new EpubMetadataExtractor(),
  } = {}) {
    this.extractors = { pdf: pdfExtractor, epub: epubExtractor }
  }

  extract(file, format) {
    return this.extractors[format].extract(file)
  }
}
