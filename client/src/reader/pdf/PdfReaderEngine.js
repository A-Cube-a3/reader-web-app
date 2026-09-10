import { createPdfLocator, validateReadingLocator } from '../../domain/reading/locator.js'
import { readBlobAsArrayBuffer } from '../../services/metadata/blob.js'
import {
  BASE_READER_CAPABILITIES,
  READER_EVENTS,
  ReaderEngine,
} from '../core/ReaderEngine.js'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
const MAX_SEARCH_RESULTS = 200

export class PdfReaderEngine extends ReaderEngine {
  constructor({
    loadPdfModule = () => import('pdfjs-dist/build/pdf.mjs'),
    devicePixelRatio = () => globalThis.devicePixelRatio || 1,
  } = {}) {
    super({
      format: 'pdf',
      capabilities: {
        ...BASE_READER_CAPABILITIES,
        zoom: true,
        rotation: true,
      },
    })
    this.loadPdfModule = loadPdfModule
    this.devicePixelRatio = devicePixelRatio
    this.preferences = { fit: 'fit-width', zoom: 1, rotation: 0, theme: 'dark' }
    this.highlights = []
    this.pageNumber = 1
    this.pageCount = 0
    this.tableOfContents = []
    this.restoreWarning = null
    this.renderVersion = 0
  }

  async open({ source, locator = null, preferences = {} }) {
    if (!source || typeof source.size !== 'number') {
      throw new TypeError('The PDF reader requires a local Blob or File')
    }
    await this.close()
    this.pdfjs = await this.loadPdfModule()
    configureWorker(this.pdfjs)
    this.preferences = normalizePreferences({ ...this.preferences, ...preferences })
    const data = new Uint8Array(await readBlobAsArrayBuffer(source))
    this.loadingTask = this.pdfjs.getDocument({
      data,
      isEvalSupported: false,
      enableXfa: false,
    })
    this.document = await this.loadingTask.promise
    this.pageCount = this.document.numPages
    const savedPage = locator ? validateReadingLocator(locator, 'pdf').pdf.page : 1
    this.restoreWarning = savedPage > this.pageCount
      ? 'The saved PDF page is outside this copy of the book. Opened at page 1.'
      : null
    this.pageNumber = this.restoreWarning ? 1 : savedPage
    this.tableOfContents = await resolveOutline(this.document, this.pageCount)
    this.emit(READER_EVENTS.STATE, { state: this.getState() })
    this.emitLocation()
    return this.getState()
  }

  async attach(container) {
    if (!this.document) throw new Error('Open a PDF before attaching its reader')
    if (!(container instanceof globalThis.HTMLElement)) {
      throw new TypeError('The PDF reader requires a DOM container')
    }
    this.detach()
    this.container = container
    const doc = container.ownerDocument
    this.pageElement = doc.createElement('div')
    this.pageElement.className = 'pdfReaderPage'
    this.canvas = doc.createElement('canvas')
    this.canvas.setAttribute('aria-label', `PDF page ${this.pageNumber}`)
    this.textLayerElement = doc.createElement('div')
    this.textLayerElement.className = 'textLayer'
    this.highlightLayerElement = doc.createElement('div')
    this.highlightLayerElement.className = 'pdfHighlightLayer'
    this.pageElement.append(this.canvas, this.highlightLayerElement, this.textLayerElement)
    container.replaceChildren(this.pageElement)
    this.captureSelection = () => this.emitSelection()
    this.textLayerElement.addEventListener('pointerup', this.captureSelection)
    this.textLayerElement.addEventListener('keyup', this.captureSelection)
    if (typeof globalThis.ResizeObserver === 'function') {
      this.resizeObserver = new globalThis.ResizeObserver(() => {
        void this.renderCurrentPage()
      })
      this.resizeObserver.observe(container)
    }
    await this.renderCurrentPage()
  }

  detach() {
    this.renderVersion += 1
    this.renderTask?.cancel?.()
    this.textLayer?.cancel?.()
    this.textLayerElement?.removeEventListener('pointerup', this.captureSelection)
    this.textLayerElement?.removeEventListener('keyup', this.captureSelection)
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.container?.replaceChildren()
    this.container = null
    this.pageElement = null
    this.canvas = null
    this.textLayerElement = null
    this.highlightLayerElement = null
  }

  async close() {
    this.detach()
    const document = this.document
    const loadingTask = this.loadingTask
    this.document = null
    this.loadingTask = null
    this.pageNumber = 1
    this.pageCount = 0
    this.tableOfContents = []
    this.restoreWarning = null
    if (document?.destroy) await document.destroy()
    else if (loadingTask?.destroy) await loadingTask.destroy()
    this.destroySubscriptions()
  }

  getState() {
    return {
      status: this.document ? 'ready' : 'idle',
      page: this.pageNumber,
      pageCount: this.pageCount,
      preferences: { ...this.preferences },
      locator: this.pageCount ? this.getCurrentLocator() : null,
      restoreWarning: this.restoreWarning,
    }
  }

  getCurrentLocator() {
    if (!this.pageCount) return null
    return createPdfLocator({
      page: this.pageNumber,
      pageCount: this.pageCount,
      rotation: this.preferences.rotation,
    })
  }

  getTableOfContents() {
    return this.tableOfContents
  }

  async goTo(target) {
    const page = typeof target === 'number'
      ? target
      : validateReadingLocator(target, 'pdf').pdf.page
    if (!Number.isInteger(page) || page < 1 || page > this.pageCount) {
      throw new RangeError(`PDF page must be between 1 and ${this.pageCount}`)
    }
    this.pageNumber = page
    await this.renderCurrentPage()
    this.emitLocation()
    return this.getCurrentLocator()
  }

  next() {
    return this.goTo(Math.min(this.pageCount, this.pageNumber + 1))
  }

  previous() {
    return this.goTo(Math.max(1, this.pageNumber - 1))
  }

  async setViewPreferences(changes = {}) {
    this.preferences = normalizePreferences({ ...this.preferences, ...changes })
    await this.renderCurrentPage()
    this.emit(READER_EVENTS.STATE, { state: this.getState() })
    return { ...this.preferences }
  }

  async search(query) {
    const needle = cleanQuery(query)
    if (!needle || !this.document) return []
    const results = []
    for (let pageNumber = 1; pageNumber <= this.pageCount; pageNumber += 1) {
      const page = await this.document.getPage(pageNumber)
      const textContent = await page.getTextContent()
      const text = textContent.items.map((item) => item.str || '').join(' ').replace(/\s+/g, ' ')
      const lowerText = text.toLocaleLowerCase()
      let offset = lowerText.indexOf(needle)
      while (offset >= 0 && results.length < MAX_SEARCH_RESULTS) {
        results.push({
          label: `Page ${pageNumber}`,
          excerpt: excerptAround(text, offset, needle.length),
          locator: createPdfLocator({ page: pageNumber, pageCount: this.pageCount }),
        })
        offset = lowerText.indexOf(needle, offset + needle.length)
      }
      page.cleanup?.()
      if (results.length >= MAX_SEARCH_RESULTS) break
    }
    return results
  }

  async setHighlights(highlights = []) {
    this.highlights = highlights.filter((highlight) => highlight?.locator?.format === 'pdf')
    this.renderHighlights()
  }

  async renderCurrentPage() {
    if (!this.container || !this.document) return
    const version = ++this.renderVersion
    this.renderTask?.cancel?.()
    this.textLayer?.cancel?.()
    this.textLayerElement.replaceChildren()
    this.emit(READER_EVENTS.STATE, { state: { ...this.getState(), status: 'rendering' } })

    try {
      const page = await this.document.getPage(this.pageNumber)
      if (version !== this.renderVersion) return
      const baseViewport = page.getViewport({ scale: 1, rotation: this.preferences.rotation })
      const scale = scaleFor(this.preferences, baseViewport, this.container)
      const viewport = page.getViewport({ scale, rotation: this.preferences.rotation })
      const outputScale = Math.max(1, this.devicePixelRatio())
      const context = this.canvas.getContext('2d', { alpha: false })
      if (!context) throw new Error('Canvas rendering is unavailable in this browser')

      this.canvas.width = Math.floor(viewport.width * outputScale)
      this.canvas.height = Math.floor(viewport.height * outputScale)
      this.canvas.style.width = `${Math.floor(viewport.width)}px`
      this.canvas.style.height = `${Math.floor(viewport.height)}px`
      this.canvas.setAttribute('aria-label', `PDF page ${this.pageNumber} of ${this.pageCount}`)
      this.pageElement.style.width = this.canvas.style.width
      this.pageElement.style.height = this.canvas.style.height
      this.textLayerElement.style.setProperty('--scale-factor', String(viewport.scale))
      this.textLayerElement.style.setProperty('--total-scale-factor', String(viewport.scale))
      this.textLayerElement.style.width = this.canvas.style.width
      this.textLayerElement.style.height = this.canvas.style.height
      this.highlightLayerElement.style.width = this.canvas.style.width
      this.highlightLayerElement.style.height = this.canvas.style.height
      this.renderHighlights()

      this.renderTask = page.render({
        canvasContext: context,
        viewport,
        transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
      })
      await this.renderTask.promise
      if (version !== this.renderVersion) return
      const textContent = await page.getTextContent()
      this.textLayer = new this.pdfjs.TextLayer({
        textContentSource: textContent,
        container: this.textLayerElement,
        viewport,
      })
      await this.textLayer.render()
      page.cleanup?.()
      this.emit(READER_EVENTS.STATE, { state: this.getState() })
    } catch (error) {
      if (error?.name === 'RenderingCancelledException' || version !== this.renderVersion) return
      this.emit(READER_EVENTS.ERROR, { error })
      throw error
    }
  }

  emitLocation() {
    this.emit(READER_EVENTS.LOCATION, { locator: this.getCurrentLocator() })
  }

  emitSelection() {
    const selection = this.container?.ownerDocument?.getSelection?.()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    if (!this.textLayerElement?.contains(range.commonAncestorContainer)) return
    const exact = selection.toString().replace(/\s+/g, ' ').trim()
    if (!exact) return
    const canvasRect = this.canvas.getBoundingClientRect()
    const geometry = canvasRect.width > 0 && canvasRect.height > 0
      ? Array.from(range.getClientRects()).slice(0, 100).map((rect) => ({
          x: clamp((rect.left - canvasRect.left) / canvasRect.width),
          y: clamp((rect.top - canvasRect.top) / canvasRect.height),
          width: clamp(rect.width / canvasRect.width),
          height: clamp(rect.height / canvasRect.height),
        })).filter((rect) => rect.width > 0 && rect.height > 0)
      : []
    this.emit(READER_EVENTS.SELECTION, {
      locator: createPdfLocator({
        page: this.pageNumber,
        pageCount: this.pageCount,
        textQuote: { exact },
        geometry: geometry.length ? geometry : undefined,
        rotation: this.preferences.rotation,
      }),
      text: exact,
    })
  }

  renderHighlights() {
    if (!this.highlightLayerElement) return
    this.highlightLayerElement.replaceChildren()
    const doc = this.highlightLayerElement.ownerDocument
    for (const highlight of this.highlights) {
      const locator = highlight.locator
      if (locator.pdf?.page !== this.pageNumber || !Array.isArray(locator.pdf.geometry)) continue
      const rotation = locator.pdf.rotation || 0
      for (const rectangle of locator.pdf.geometry) {
        const transformed = rotateRectangle(rectangle, this.preferences.rotation - rotation)
        const marker = doc.createElement('span')
        marker.dataset.highlightId = highlight.id
        marker.dataset.color = highlight.color || 'yellow'
        marker.style.left = `${transformed.x * 100}%`
        marker.style.top = `${transformed.y * 100}%`
        marker.style.width = `${transformed.width * 100}%`
        marker.style.height = `${transformed.height * 100}%`
        this.highlightLayerElement.append(marker)
      }
    }
  }
}

function configureWorker(pdfjs) {
  if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).href
  }
}

function normalizePreferences(preferences) {
  const fit = ['fit-width', 'fit-page', 'custom'].includes(preferences.fit)
    ? preferences.fit
    : 'fit-width'
  const zoom = Number.isFinite(preferences.zoom)
    ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, preferences.zoom))
    : 1
  const rotation = Number.isFinite(preferences.rotation)
    ? ((Math.round(preferences.rotation / 90) * 90) % 360 + 360) % 360
    : 0
  const theme = ['dark', 'light', 'sepia'].includes(preferences.theme) ? preferences.theme : 'dark'
  return { fit, zoom, rotation, theme }
}

function scaleFor(preferences, viewport, container) {
  const availableWidth = Math.max(320, container.clientWidth || 800) - 32
  const availableHeight = Math.max(320, container.clientHeight || 900) - 32
  if (preferences.fit === 'fit-page') {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(availableWidth / viewport.width, availableHeight / viewport.height)))
  }
  if (preferences.fit === 'fit-width') {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, availableWidth / viewport.width))
  }
  return preferences.zoom
}

async function resolveOutline(document, pageCount) {
  let outline
  try {
    outline = await document.getOutline()
  } catch {
    return []
  }
  if (!Array.isArray(outline)) return []

  async function mapItems(items, depth = 0) {
    if (depth > 8) return []
    const mapped = []
    for (const item of items.slice(0, 500)) {
      const page = await destinationPage(document, item.dest)
      const children = await mapItems(item.items || [], depth + 1)
      if (page || children.length) {
        mapped.push({
          label: String(item.title || `Page ${page || 1}`).trim(),
          ...(page ? { locator: createPdfLocator({ page, pageCount }) } : {}),
          children,
        })
      }
    }
    return mapped
  }
  return mapItems(outline)
}

async function destinationPage(document, destination) {
  try {
    const resolved = typeof destination === 'string'
      ? await document.getDestination(destination)
      : destination
    const reference = resolved?.[0]
    if (Number.isInteger(reference)) return reference + 1
    if (reference) return (await document.getPageIndex(reference)) + 1
  } catch {
    return null
  }
  return null
}

function cleanQuery(query) {
  return String(query || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

function excerptAround(text, offset, length) {
  const start = Math.max(0, offset - 55)
  const end = Math.min(text.length, offset + length + 55)
  return `${start ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`
}

function clamp(value) {
  return Math.max(0, Math.min(1, value))
}

function rotateRectangle(rectangle, rotation) {
  const normalized = ((rotation % 360) + 360) % 360
  if (normalized === 90) return {
    x: 1 - rectangle.y - rectangle.height,
    y: rectangle.x,
    width: rectangle.height,
    height: rectangle.width,
  }
  if (normalized === 180) return {
    x: 1 - rectangle.x - rectangle.width,
    y: 1 - rectangle.y - rectangle.height,
    width: rectangle.width,
    height: rectangle.height,
  }
  if (normalized === 270) return {
    x: rectangle.y,
    y: 1 - rectangle.x - rectangle.width,
    width: rectangle.height,
    height: rectangle.width,
  }
  return rectangle
}
