export function createWebReaderLifecycle(
  windowObject = globalThis.window,
  documentObject = globalThis.document,
) {
  return {
    subscribeFlush(listener) {
      const onPageHide = () => listener('pagehide')
      const onFreeze = () => listener('freeze')
      const onVisibility = () => {
        if (documentObject?.visibilityState === 'hidden') listener('hidden')
      }
      windowObject?.addEventListener('pagehide', onPageHide)
      documentObject?.addEventListener('freeze', onFreeze)
      documentObject?.addEventListener('visibilitychange', onVisibility)
      return () => {
        windowObject?.removeEventListener('pagehide', onPageHide)
        documentObject?.removeEventListener('freeze', onFreeze)
        documentObject?.removeEventListener('visibilitychange', onVisibility)
      }
    },
  }
}

export const webReaderLifecycle = createWebReaderLifecycle()
