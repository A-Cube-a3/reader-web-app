import { describe, expect, it, vi } from 'vitest'
import { PdfReaderEngine } from './PdfReaderEngine.js'

describe('PdfReaderEngine', () => {
  it('opens a local PDF lazily and emits normalized page locations', async () => {
    const { module, document } = fakePdfModule()
    const engine = new PdfReaderEngine({ loadPdfModule: async () => module })
    await engine.open({
      source: new Blob(['%PDF']),
      locator: {
        version: 1,
        format: 'pdf',
        progression: 0.5,
        pdf: { page: 2, pageCount: 3 },
      },
    })
    const events = []
    engine.subscribe((event) => events.push(event))

    expect(document.getPage).not.toHaveBeenCalled()
    expect(engine.getCurrentLocator()).toMatchObject({ format: 'pdf', pdf: { page: 2, pageCount: 3 } })
    await engine.next()
    expect(document.getPage).not.toHaveBeenCalled()
    expect(events.at(-1).locator.pdf.page).toBe(3)
    await engine.close()
    expect(document.destroy).toHaveBeenCalledOnce()
    expect(engine.getState()).toMatchObject({ status: 'idle', page: 1, pageCount: 0 })
  })

  it('searches text page-by-page without rendering every page', async () => {
    const { module, document, pages } = fakePdfModule()
    const engine = new PdfReaderEngine({ loadPdfModule: async () => module })
    await engine.open({ source: new Blob(['%PDF']) })

    const results = await engine.search('local phrase')
    expect(results).toHaveLength(3)
    expect(results[0].locator.pdf.page).toBe(1)
    expect(document.getPage).toHaveBeenCalledTimes(3)
    expect(pages.every((page) => page.render.mock.calls.length === 0)).toBe(true)
  })

  it('clamps zoom and normalizes rotation preferences', async () => {
    const { module } = fakePdfModule()
    const engine = new PdfReaderEngine({ loadPdfModule: async () => module })
    await engine.open({ source: new Blob(['%PDF']) })

    await expect(engine.setViewPreferences({ fit: 'custom', zoom: 8, rotation: -90 }))
      .resolves.toEqual({ fit: 'custom', zoom: 4, rotation: 270 })
  })
})

function fakePdfModule() {
  const pages = Array.from({ length: 3 }, (_, index) => ({
    getTextContent: vi.fn().mockResolvedValue({
      items: [{ str: `Page ${index + 1} has a local phrase for search.` }],
    }),
    getViewport: vi.fn(({ scale }) => ({ width: 600 * scale, height: 800 * scale, scale })),
    render: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
    cleanup: vi.fn(),
  }))
  const document = {
    numPages: 3,
    getPage: vi.fn((page) => Promise.resolve(pages[page - 1])),
    getOutline: vi.fn().mockResolvedValue([]),
    destroy: vi.fn(),
  }
  return {
    pages,
    document,
    module: {
      GlobalWorkerOptions: {},
      getDocument: vi.fn(() => ({ promise: Promise.resolve(document), destroy: vi.fn() })),
      TextLayer: vi.fn(),
    },
  }
}
