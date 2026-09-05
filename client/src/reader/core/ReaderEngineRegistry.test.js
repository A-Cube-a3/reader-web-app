import { describe, expect, it, vi } from 'vitest'
import {
  ReaderEngineRegistry,
  UnsupportedReaderFormatError,
} from './ReaderEngineRegistry.js'

describe('ReaderEngineRegistry', () => {
  it('creates only the requested registered reader', async () => {
    const pdfFactory = vi.fn().mockResolvedValue({ format: 'pdf' })
    const epubFactory = vi.fn().mockResolvedValue({ format: 'epub' })
    const registry = new ReaderEngineRegistry({ pdf: pdfFactory, epub: epubFactory })

    await expect(registry.create('epub')).resolves.toEqual({ format: 'epub' })
    expect(epubFactory).toHaveBeenCalledOnce()
    expect(pdfFactory).not.toHaveBeenCalled()
  })

  it('reports unsupported local formats with a stable error', async () => {
    const registry = new ReaderEngineRegistry()

    await expect(registry.create('mobi')).rejects.toEqual(expect.objectContaining({
      name: 'UnsupportedReaderFormatError',
      code: 'UNSUPPORTED_READER_FORMAT',
    }))
    await expect(registry.create('mobi')).rejects.toBeInstanceOf(UnsupportedReaderFormatError)
  })

  it('rejects invalid registrations and mismatched engines', async () => {
    const registry = new ReaderEngineRegistry()
    expect(() => registry.register('mobi', () => ({}))).toThrow(TypeError)
    registry.register('pdf', async () => ({ format: 'epub' }))
    await expect(registry.create('pdf')).rejects.toThrow('invalid engine')
  })
})
