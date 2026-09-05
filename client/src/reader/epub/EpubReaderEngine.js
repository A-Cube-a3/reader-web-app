import { createEpubLocator, validateReadingLocator } from '../../domain/reading/locator.js'
import {
  BASE_READER_CAPABILITIES,
  READER_EVENTS,
  ReaderEngine,
} from '../core/ReaderEngine.js'
import { sanitizeEpubResource } from './sanitizeEpubResource.js'

const MAX_SEARCH_RESULTS = 200

export class EpubReaderEngine extends ReaderEngine {
  constructor({ loadEpubModule = () => import('foliate-js/view.js') } = {}) {
    super({
      format: 'epub',
      capabilities: { ...BASE_READER_CAPABILITIES, scrolling: true },
    })
    this.loadEpubModule = loadEpubModule
    this.preferences = { flow: 'paginated', fontSize: 100, lineHeight: 1.5, contentWidth: 720, theme: 'paper' }
    this.tableOfContents = []
    this.selectionListeners = new Map()
    this.selectionTimers = new Map()
  }

  async open({ source, locator = null, preferences = {} }) {
    if (!source || typeof source.size !== 'number') {
      throw new TypeError('The EPUB reader requires a local Blob or File')
    }
    await this.close()
    this.epubModule = await this.loadEpubModule()
    this.book = await this.epubModule.makeBook(source)
    this.preferences = normalizePreferences({ ...this.preferences, ...preferences })
    this.transformListener = ({ detail }) => {
      detail.data = Promise.resolve(detail.data)
        .then((data) => sanitizeEpubResource(data, detail.type))
        .catch(() => '')
    }
    this.book.transformTarget?.addEventListener('data', this.transformListener)
    this.tableOfContents = mapTableOfContents(this.book.toc || [])
    this.resumeLocator = locator ? validateReadingLocator(locator, 'epub') : null
    this.currentLocator = this.resumeLocator
    this.emit(READER_EVENTS.STATE, { state: this.getState() })
    if (this.currentLocator) this.emit(READER_EVENTS.LOCATION, { locator: this.currentLocator })
    return this.getState()
  }

  async attach(container) {
    if (!this.book) throw new Error('Open an EPUB before attaching its reader')
    if (!(container instanceof globalThis.HTMLElement)) {
      throw new TypeError('The EPUB reader requires a DOM container')
    }
    this.detach()
    this.container = container
    this.view = new this.epubModule.View()
    this.view.addEventListener('relocate', this.handleRelocate)
    this.view.addEventListener('load', this.handleLoad)
    this.view.addEventListener('external-link', this.handleExternalLink)
    container.replaceChildren(this.view)
    await this.view.open(this.book)
    this.applyLayoutPreferences()
    await this.view.init({
      lastLocation: this.resumeLocator?.epub.cfi || null,
      showTextStart: false,
    })
    this.applyStyles()
  }

  handleRelocate = ({ detail }) => {
    const index = detail.section?.current ?? 0
    const section = this.book.sections[index] || this.book.sections[0]
    if (!detail.cfi || !section) return
    this.currentLocator = createEpubLocator({
      cfi: detail.cfi,
      spineHref: section.id,
      spineIndex: index,
      progression: finiteProgress(detail.fraction),
    })
    this.emit(READER_EVENTS.LOCATION, { locator: this.currentLocator })
    this.emit(READER_EVENTS.STATE, { state: this.getState() })
  }

  handleLoad = ({ detail }) => {
    const { doc, index } = detail
    hardenLiveDocument(doc)
    const listener = () => {
      globalThis.clearTimeout(this.selectionTimers.get(doc))
      this.selectionTimers.set(doc, globalThis.setTimeout(() => this.emitSelection(doc, index), 80))
    }
    doc.addEventListener('selectionchange', listener)
    this.selectionListeners.set(doc, listener)
  }

  handleExternalLink = (event) => {
    event.preventDefault()
    this.emit('external-link', { href: event.detail?.href || '' })
  }

  detach() {
    for (const [doc, listener] of this.selectionListeners) {
      doc.removeEventListener('selectionchange', listener)
      globalThis.clearTimeout(this.selectionTimers.get(doc))
    }
    this.selectionListeners.clear()
    this.selectionTimers.clear()
    this.view?.removeEventListener('relocate', this.handleRelocate)
    this.view?.removeEventListener('load', this.handleLoad)
    this.view?.removeEventListener('external-link', this.handleExternalLink)
    this.view?.close?.()
    this.view?.remove?.()
    this.container?.replaceChildren()
    this.view = null
    this.container = null
  }

  async close() {
    this.detach()
    if (this.book?.transformTarget && this.transformListener) {
      this.book.transformTarget.removeEventListener('data', this.transformListener)
    }
    for (const section of this.book?.sections || []) section.unload?.()
    this.book = null
    this.resumeLocator = null
    this.tableOfContents = []
    this.currentLocator = null
    this.destroySubscriptions()
  }

  getState() {
    return {
      status: this.book ? 'ready' : 'idle',
      locator: this.currentLocator,
      preferences: { ...this.preferences },
      sectionCount: this.book?.sections?.length || 0,
    }
  }

  getCurrentLocator() {
    return this.currentLocator
  }

  getTableOfContents() {
    return this.tableOfContents
  }

  async goTo(target) {
    const destination = typeof target === 'string'
      ? target
      : validateReadingLocator(target, 'epub').epub.cfi
    if (!this.view) {
      if (typeof target !== 'string') this.currentLocator = target
      return this.currentLocator
    }
    await this.view.goTo(destination)
    return this.currentLocator
  }

  next() {
    return this.view?.next()
  }

  previous() {
    return this.view?.prev()
  }

  async setViewPreferences(changes = {}) {
    this.preferences = normalizePreferences({ ...this.preferences, ...changes })
    this.applyPreferences()
    this.emit(READER_EVENTS.STATE, { state: this.getState() })
    return { ...this.preferences }
  }

  applyPreferences() {
    this.applyLayoutPreferences()
    this.applyStyles()
  }

  applyLayoutPreferences() {
    const renderer = this.view?.renderer
    if (!renderer) return
    renderer.setAttribute('flow', this.preferences.flow)
    renderer.setAttribute('max-inline-size', `${this.preferences.contentWidth}px`)
  }

  applyStyles() {
    const renderer = this.view?.renderer
    if (!renderer) return
    renderer.setStyles?.(epubStyles(this.preferences))
  }

  async search(query) {
    const value = String(query || '').replace(/\s+/g, ' ').trim()
    if (!value || !this.view) return []
    const results = []
    for await (const result of this.view.search({ query: value })) {
      if (!result || typeof result === 'string' || !Array.isArray(result.subitems)) continue
      for (const item of result.subitems) {
        const resolved = await this.view.resolveNavigation(item.cfi)
        const index = resolved?.index ?? 0
        const section = this.book.sections[index]
        if (!section) continue
        results.push({
          label: displayText(result.label) || `Section ${index + 1}`,
          excerpt: formatExcerpt(item.excerpt),
          locator: createEpubLocator({
            cfi: item.cfi,
            spineHref: section.id,
            spineIndex: index,
            progression: approximateProgress(index, this.book.sections.length),
          }),
        })
        if (results.length >= MAX_SEARCH_RESULTS) return results
      }
    }
    return results
  }

  emitSelection(doc, index) {
    const selection = doc.defaultView?.getSelection?.()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    const exact = selection.toString().replace(/\s+/g, ' ').trim()
    const section = this.book?.sections[index]
    if (!exact || !section) return
    const cfi = this.view.getCFI(index, range)
    const locator = createEpubLocator({
      cfi,
      spineHref: section.id,
      spineIndex: index,
      progression: this.currentLocator?.progression ?? approximateProgress(index, this.book.sections.length),
      textQuote: quoteContext(doc, exact),
    })
    this.emit(READER_EVENTS.SELECTION, { locator, text: exact })
  }
}

function normalizePreferences(preferences) {
  return {
    flow: preferences.flow === 'scrolled' ? 'scrolled' : 'paginated',
    fontSize: clampNumber(preferences.fontSize, 70, 200, 100),
    lineHeight: clampNumber(preferences.lineHeight, 1.1, 2.2, 1.5),
    contentWidth: clampNumber(preferences.contentWidth, 420, 1100, 720),
    theme: ['paper', 'sepia', 'night'].includes(preferences.theme) ? preferences.theme : 'paper',
  }
}

function epubStyles(preferences) {
  const themes = {
    paper: { foreground: '#241f1a', background: '#fffdf8' },
    sepia: { foreground: '#3d2f20', background: '#f4e8cf' },
    night: { foreground: '#e7e2d8', background: '#171b19' },
  }
  const theme = themes[preferences.theme]
  return `
    :root { color-scheme: ${preferences.theme === 'night' ? 'dark' : 'light'}; }
    html, body { color: ${theme.foreground} !important; background: ${theme.background} !important; }
    body { font-size: ${preferences.fontSize}% !important; }
    p, li, blockquote, dd { line-height: ${preferences.lineHeight} !important; }
    pre { white-space: pre-wrap !important; }
    img, svg, video { max-width: 100% !important; height: auto !important; }
  `
}

function mapTableOfContents(items, depth = 0) {
  if (!Array.isArray(items) || depth > 8) return []
  return items.slice(0, 500).flatMap((item) => {
    const label = displayText(item?.label)
    const target = typeof item?.href === 'string' ? item.href : null
    if (!label || !target) return []
    return [{ label, target, children: mapTableOfContents(item.subitems, depth + 1) }]
  })
}

function hardenLiveDocument(doc) {
  doc.querySelectorAll('script,iframe,frame,object,embed,base,meta[http-equiv]').forEach((node) => node.remove())
  for (const element of doc.querySelectorAll('*')) {
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name.toLocaleLowerCase().startsWith('on')) element.removeAttribute(attribute.name)
    }
  }
}

function quoteContext(doc, exact) {
  const text = doc.body?.textContent?.replace(/\s+/g, ' ') || ''
  const index = text.indexOf(exact)
  return {
    exact,
    prefix: index >= 0 ? text.slice(Math.max(0, index - 50), index).trim() : '',
    suffix: index >= 0 ? text.slice(index + exact.length, index + exact.length + 50).trim() : '',
  }
}

function formatExcerpt(excerpt) {
  if (typeof excerpt === 'string') return excerpt
  if (!excerpt) return ''
  return `${excerpt.pre || ''}${excerpt.match || ''}${excerpt.post || ''}`.replace(/\s+/g, ' ').trim()
}

function displayText(value) {
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim()
  if (value && typeof value === 'object') return displayText(Object.values(value)[0])
  return ''
}

function finiteProgress(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : undefined
}

function approximateProgress(index, total) {
  return total <= 1 ? 0 : index / (total - 1)
}

function clampNumber(value, minimum, maximum, fallback) {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback
}
