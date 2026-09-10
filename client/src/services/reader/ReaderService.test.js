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

    await expect(service.open(book.id)).resolves.toMatchObject({ book, engine, tools: null })
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

  it('loads saved locator and preferences before starting local reading tools', async () => {
    const book = { id: 'book', format: 'pdf' }
    const source = new Blob(['book'])
    const locator = { version: 1, format: 'pdf', progression: 0, pdf: { page: 1, pageCount: 2 } }
    const engine = { format: 'pdf', open: vi.fn(), close: vi.fn() }
    const tools = { book, close: vi.fn() }
    const loaded = { locator, preferences: { fit: 'fit-page' } }
    const toolsService = {
      load: vi.fn().mockResolvedValue(loaded),
      start: vi.fn().mockResolvedValue(tools),
    }
    const service = new ReaderService({
      libraryService: {
        getBook: vi.fn().mockResolvedValue(book),
        openBookBinary: vi.fn().mockResolvedValue(source),
      },
      engineRegistry: { create: vi.fn().mockResolvedValue(engine) },
      toolsService,
    })

    const session = await service.open(book.id)
    expect(engine.open).toHaveBeenCalledWith({ book, source, locator, preferences: { fit: 'fit-page' } })
    expect(toolsService.start).toHaveBeenCalledWith({ book, engine, loaded })
    await session.close()
    await session.close()
    expect(tools.close).toHaveBeenCalledOnce()
    expect(engine.close).toHaveBeenCalledOnce()
  })
})
