import { describe, expect, it, vi } from 'vitest'
import { createWebReaderLifecycle } from './readerLifecycle.js'

describe('web reader lifecycle', () => {
  it('requests an immediate flush when a page is hidden or unloaded', () => {
    const flush = vi.fn()
    const unsubscribe = createWebReaderLifecycle().subscribeFlush(flush)

    window.dispatchEvent(new Event('pagehide'))
    document.dispatchEvent(new Event('freeze'))
    expect(flush).toHaveBeenCalledTimes(2)

    unsubscribe()
    window.dispatchEvent(new Event('pagehide'))
    expect(flush).toHaveBeenCalledTimes(2)
  })
})
