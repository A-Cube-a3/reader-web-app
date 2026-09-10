import { afterEach, describe, expect, it, vi } from 'vitest'
import { DebouncedProgressWriter } from './DebouncedProgressWriter.js'

describe('DebouncedProgressWriter', () => {
  afterEach(() => vi.useRealTimers())

  it('persists only the latest locator after the debounce interval', async () => {
    vi.useFakeTimers()
    const progressRepository = { set: vi.fn().mockResolvedValue(undefined) }
    const writer = new DebouncedProgressWriter({
      bookId: 'book', format: 'pdf', progressRepository, debounceMs: 100,
      clock: () => '2026-09-10T10:00:00.000Z',
    })

    writer.schedule(pdfLocator(1))
    writer.schedule(pdfLocator(2))
    await vi.advanceTimersByTimeAsync(99)
    expect(progressRepository.set).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)

    expect(progressRepository.set).toHaveBeenCalledOnce()
    expect(progressRepository.set).toHaveBeenCalledWith('book', {
      locator: pdfLocator(2), progression: 0.5, lastOpenedAt: '2026-09-10T10:00:00.000Z',
    })
  })

  it('flushes a pending position immediately for application shutdown', async () => {
    vi.useFakeTimers()
    const progressRepository = { set: vi.fn().mockResolvedValue(undefined) }
    const writer = new DebouncedProgressWriter({ bookId: 'book', format: 'pdf', progressRepository })

    writer.schedule(pdfLocator(3))
    await writer.flush()
    await vi.runAllTimersAsync()

    expect(progressRepository.set).toHaveBeenCalledOnce()
    expect(progressRepository.set).toHaveBeenCalledWith('book', expect.objectContaining({ locator: pdfLocator(3) }))
  })
})

function pdfLocator(page) {
  return { version: 1, format: 'pdf', progression: (page - 1) / 2, pdf: { page, pageCount: 3 } }
}
