export const READER_EVENTS = Object.freeze({
  STATE: 'state',
  LOCATION: 'location',
  SELECTION: 'selection',
  ERROR: 'error',
})

export class ReaderEngine {
  constructor({ format, capabilities }) {
    this.format = format
    this.capabilities = Object.freeze({ ...capabilities })
    this.listeners = new Set()
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(type, detail = {}) {
    const event = Object.freeze({ type, format: this.format, ...detail })
    for (const listener of this.listeners) listener(event)
  }

  destroySubscriptions() {
    this.listeners.clear()
  }
}

export const BASE_READER_CAPABILITIES = Object.freeze({
  tableOfContents: true,
  search: true,
  selection: true,
  paginated: true,
  scrolling: false,
  zoom: false,
  rotation: false,
})
