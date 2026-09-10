import { describe, expect, it, vi } from 'vitest'
import { EpubReaderEngine } from './EpubReaderEngine.js'

describe('EpubReaderEngine', () => {
  it('opens a local Blob and maps TOC entries without inventing a content CFI', async () => {
    const { module } = fakeEpubModule()
    const engine = createEngine(module)
    await engine.open({ source: new Blob(['epub']) })

    expect(module.makeBook).toHaveBeenCalled()
    expect(engine.getTableOfContents()).toEqual([
      { label: 'Chapter one', target: 'text/one.xhtml', children: [] },
    ])
    expect(engine.getCurrentLocator()).toBeNull()
  })

  it('attaches one reflowable section, searches lazily, and blocks automatic external navigation', async () => {
    const { module, book, view } = fakeEpubModule()
    const engine = createEngine(module)
    const events = []
    await engine.open({ source: new Blob(['epub']) })
    engine.subscribe((event) => events.push(event))
    await engine.attach(document.createElement('div'))

    expect(view.open).toHaveBeenCalledOnce()
    expect(view.init).toHaveBeenCalledWith({ lastLocation: null, showTextStart: false })
    expect(view.renderer.setAttribute).toHaveBeenCalledWith('flow', 'paginated')
    expect(engine.getCurrentLocator()).toMatchObject({
      format: 'epub',
      epub: { cfi: 'epubcfi(/6/2!/4/2)', spineHref: 'text/one.xhtml' },
    })
    await expect(engine.search('local')).resolves.toEqual([
      expect.objectContaining({
        label: 'Chapter one',
        locator: expect.objectContaining({ format: 'epub' }),
      }),
    ])

    const external = new CustomEvent('external-link', {
      cancelable: true,
      detail: { href: 'https://example.com' },
    })
    view.dispatchEvent(external)
    expect(external.defaultPrevented).toBe(true)
    expect(events.at(-1)).toMatchObject({ type: 'external-link', href: 'https://example.com' })
    await engine.close()
    expect(view.close).toHaveBeenCalledOnce()
    expect(book.sections.every((section) => section.unload.mock.calls.length === 1)).toBe(true)
  })

  it('passes a complete saved CFI to the renderer when resuming', async () => {
    const { module, view } = fakeEpubModule()
    const engine = createEngine(module)
    const locator = {
      version: 1,
      format: 'epub',
      progression: 0.5,
      epub: {
        cfi: 'epubcfi(/6/4!/4/2)',
        spineHref: 'text/two.xhtml',
        spineIndex: 1,
      },
    }

    await engine.open({ source: new Blob(['epub']), locator })
    await engine.attach(document.createElement('div'))

    expect(view.init).toHaveBeenCalledWith({
      lastLocation: locator.epub.cfi,
      showTextStart: false,
    })
  })

  it('recovers honestly when a saved CFI no longer resolves', async () => {
    const { module, view } = fakeEpubModule()
    view.resolveNavigation.mockResolvedValueOnce(null)
    const engine = createEngine(module)
    const locator = epubLocator()

    await engine.open({ source: new Blob(['epub']), locator })
    await engine.attach(document.createElement('div'))

    expect(view.init).toHaveBeenCalledWith({ lastLocation: null, showTextStart: false })
    expect(engine.getState().restoreWarning).toMatch(/beginning/)
  })

  it('passes CFI highlights through the Foliate annotation layer', async () => {
    const { module, view } = fakeEpubModule()
    const engine = createEngine(module)
    await engine.open({ source: new Blob(['epub']) })
    await engine.attach(document.createElement('div'))

    await engine.setHighlights([{ id: 'highlight-id', color: 'blue', locator: epubLocator() }])
    expect(view.addAnnotation).toHaveBeenCalledWith(expect.objectContaining({ value: epubLocator().epub.cfi, color: 'blue' }))
  })
})

function createEngine(module) {
  return new EpubReaderEngine({
    loadEpubModule: async () => module,
    loadOverlayerModule: async () => ({ Overlayer: { highlight: vi.fn() } }),
  })
}

function fakeEpubModule() {
  const transformTarget = new EventTarget()
  const book = {
    transformTarget,
    sections: [
      { id: 'text/one.xhtml', cfi: 'epubcfi(/6/2)', size: 100, linear: 'yes', unload: vi.fn() },
      { id: 'text/two.xhtml', cfi: 'epubcfi(/6/4)', size: 100, linear: 'yes', unload: vi.fn() },
    ],
    toc: [{ label: 'Chapter one', href: 'text/one.xhtml' }],
  }
  const view = document.createElement('div')
  view.renderer = {
    setAttribute: vi.fn(),
    setStyles: vi.fn(),
  }
  view.open = vi.fn().mockResolvedValue(undefined)
  view.init = vi.fn(async () => {
    view.dispatchEvent(new CustomEvent('relocate', { detail: {
      cfi: 'epubcfi(/6/2!/4/2)',
      fraction: 0.1,
      section: { current: 0, total: 2 },
    } }))
  })
  view.goTo = vi.fn()
  view.next = vi.fn()
  view.prev = vi.fn()
  view.close = vi.fn()
  view.resolveNavigation = vi.fn().mockResolvedValue({ index: 0 })
  view.search = async function* () {
    yield {
      label: { en: 'Chapter one' },
      subitems: [{
        cfi: 'epubcfi(/6/2!/4/2)',
        excerpt: { pre: 'A ', match: 'local', post: ' result' },
      }],
    }
    yield 'done'
  }
  view.getCFI = vi.fn().mockReturnValue('epubcfi(/6/2!/4/2)')
  view.addAnnotation = vi.fn().mockResolvedValue(undefined)
  view.deleteAnnotation = vi.fn().mockResolvedValue(undefined)
  class View {
    constructor() { return view }
  }
  return {
    book,
    view,
    module: { makeBook: vi.fn().mockResolvedValue(book), View },
  }
}

function epubLocator() {
  return {
    version: 1, format: 'epub', progression: 0.5,
    epub: { cfi: 'epubcfi(/6/4!/4/2)', spineHref: 'text/two.xhtml', spineIndex: 1, textQuote: { exact: 'local', prefix: '', suffix: '' } },
  }
}
