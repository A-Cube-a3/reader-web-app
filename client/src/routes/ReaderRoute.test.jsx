import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ReaderRoute from './ReaderRoute.jsx'

describe('ReaderRoute', () => {
  it('opens the local engine, navigates, searches, and closes without owning progress persistence', async () => {
    const engine = fakeEngine()
    const readerService = { open: vi.fn().mockResolvedValue({ book: book(), engine }) }
    const navigation = { openLibrary: vi.fn() }
    const { unmount } = render(<ReaderRoute bookId="book-id" readerService={readerService} navigation={navigation} />)

    expect(await screen.findByText('Local Book')).toBeInTheDocument()
    await waitFor(() => expect(engine.attach).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(engine.next).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    fireEvent.change(screen.getByLabelText('Find text in this book'), { target: { value: 'offline' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find' }))
    expect(await screen.findByText('Offline result')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Offline result'))
    expect(engine.goTo).toHaveBeenCalledWith(expect.objectContaining({ format: 'pdf' }))

    fireEvent.click(screen.getByRole('button', { name: /Library/ }))
    expect(navigation.openLibrary).toHaveBeenCalledOnce()
    unmount()
    expect(engine.close).toHaveBeenCalledOnce()
  })

  it('contains engine failures to the reader route', async () => {
    render(<ReaderRoute
      bookId="missing"
      readerService={{ open: vi.fn().mockRejectedValue(new Error('Local binary is missing.')) }}
      navigation={{ openLibrary: vi.fn() }}
    />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Local binary is missing.')
    expect(screen.getByRole('button', { name: /Library/ })).toBeInTheDocument()
  })
})

function fakeEngine() {
  const locator = { version: 1, format: 'pdf', progression: 0, pdf: { page: 1, pageCount: 2 } }
  return {
    format: 'pdf',
    subscribe: vi.fn(() => () => {}),
    attach: vi.fn(),
    close: vi.fn(),
    getState: vi.fn(() => ({ page: 1, pageCount: 2, locator, preferences: { fit: 'fit-width', zoom: 1, rotation: 0 } })),
    getTableOfContents: vi.fn(() => [{ label: 'Start', locator, children: [] }]),
    next: vi.fn(),
    previous: vi.fn(),
    goTo: vi.fn(),
    setViewPreferences: vi.fn(),
    search: vi.fn().mockResolvedValue([{ label: 'Page 1', excerpt: 'Offline result', locator }]),
  }
}

function book() {
  return { id: 'book-id', title: 'Local Book', author: 'Reader', originalFilename: 'local.pdf', format: 'pdf' }
}
