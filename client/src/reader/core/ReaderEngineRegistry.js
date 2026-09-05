const SUPPORTED_FORMATS = new Set(['pdf', 'epub'])

export class ReaderEngineRegistry {
  constructor(factories = {}) {
    this.factories = new Map(Object.entries(factories))
  }

  register(format, factory) {
    if (!SUPPORTED_FORMATS.has(format) || typeof factory !== 'function') {
      throw new TypeError('Reader engines require a supported format and factory')
    }
    this.factories.set(format, factory)
    return this
  }

  async create(format) {
    const factory = this.factories.get(format)
    if (!factory) throw new UnsupportedReaderFormatError(format)
    const engine = await factory()
    if (!engine || engine.format !== format) {
      throw new TypeError(`The ${format} reader factory returned an invalid engine`)
    }
    return engine
  }
}

export class UnsupportedReaderFormatError extends Error {
  constructor(format) {
    super(`No local reader is available for ${format || 'this format'}.`)
    this.name = 'UnsupportedReaderFormatError'
    this.code = 'UNSUPPORTED_READER_FORMAT'
  }
}

export function createDefaultReaderRegistry() {
  return new ReaderEngineRegistry({
    pdf: async () => {
      const { PdfReaderEngine } = await import('../pdf/PdfReaderEngine.js')
      return new PdfReaderEngine()
    },
    epub: async () => {
      const { EpubReaderEngine } = await import('../epub/EpubReaderEngine.js')
      return new EpubReaderEngine()
    },
  })
}
