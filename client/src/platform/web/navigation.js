const READER_PATH = /^\/read\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i

export function createWebNavigation(windowObject = globalThis.window) {
  const listeners = new Set()
  let snapshot = readBookId(windowObject?.location?.pathname)

  function update() {
    const next = readBookId(windowObject?.location?.pathname)
    if (snapshot === next) return
    snapshot = next
    for (const listener of listeners) listener()
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      windowObject?.addEventListener('popstate', update)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) windowObject?.removeEventListener('popstate', update)
      }
    },
    openReader(bookId) {
      windowObject?.history?.pushState({}, '', `/read/${encodeURIComponent(bookId)}`)
      update()
    },
    openLibrary() {
      windowObject?.history?.pushState({}, '', '/')
      update()
    },
  }
}

export function readBookId(pathname = '') {
  return READER_PATH.exec(pathname)?.[1] || null
}

export const webNavigation = createWebNavigation()
