import { describe, expect, it, vi } from 'vitest'
import { ReaderService } from './ReaderService.js'

describe('ReaderService', () => {
  it('resolves local binary data and opens the format engine without a network API', async () => {
    const source = new File(['book'], 'book.pdf')
    const book = { id: 'local-id', format: 'pdf' }
    const engine = { format: 'pdf', open: vi.fn(), close: vi.fn() }
    const libraryService = {
      getBook: vi.fn().mockResolvedValue(book),
      openBookBinary: vi.fn().mockResolvedValue(source),
    }
    const engineRegistry = { create: vi.fn().mockResolvedValue(engine) }
    const service = new ReaderService({ libraryService, engineRegistry })

    await expect(service.open(book.id)).resolves.toEqual({ book, engine })
    expect(engine.open).toHaveBeenCalledWith({ book, source, locator: null, preferences: {} })
    expect(libraryService.openBookBinary).toHaveBeenCalledWith(book.id)
  })

  it('closes a partially opened engine when initialization fails', async () => {
    const failure = new Error('Unreadable')
    const engine = { format: 'epub', open: vi.fn().mockRejectedValue(failure), close: vi.fn() }
    const service = new ReaderService({
      libraryService: {
        getBook: vi.fn().mockResolvedValue({ id: 'book', format: 'epub' }),
        openBookBinary: vi.fn().mockResolvedValue(new Blob(['book'])),
      },
      engineRegistry: { create: vi.fn().mockResolvedValue(engine) },
    })

    await expect(service.open('book')).rejects.toBe(failure)
    expect(engine.close).toHaveBeenCalledOnce()
  })
})
