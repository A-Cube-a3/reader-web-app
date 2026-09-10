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
    fireEvent.change(screen.getByLabelText('Find book text, notes, and highlights'), { target: { value: 'offline' } })
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

  it('exposes offline bookmarks, selected-text highlights, notes, and preferences', async () => {
    const engine = fakeEngine()
    const tools = fakeTools()
    const close = vi.fn()
    render(<ReaderRoute
      bookId="book-id"
      readerService={{ open: vi.fn().mockResolvedValue({ book: book(), engine, tools, close }) }}
      navigation={{ openLibrary: vi.fn() }}
    />)

    expect(await screen.findByText('Local Book')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Bookmark' }))
    await waitFor(() => expect(tools.addBookmark).toHaveBeenCalledOnce())

    fireEvent.click(screen.getByRole('button', { name: 'Reading tools' }))
    expect(screen.getByRole('heading', { name: 'Bookmarks' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('New book note'), { target: { value: 'Offline thought' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }))
    await waitFor(() => expect(tools.addNote).toHaveBeenCalledWith({ body: 'Offline thought', locator: null }))

    engine.emit({ type: 'selection', text: 'Selected locally', locator: engine.locator })
    expect(await screen.findByText('Selected locally')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save highlight' }))
    await waitFor(() => expect(tools.addHighlight).toHaveBeenCalledWith(expect.objectContaining({ text: 'Selected locally' }), 'yellow'))

    fireEvent.click(screen.getByRole('button', { name: 'Preferences' }))
    fireEvent.change(screen.getByLabelText('Reader surround'), { target: { value: 'sepia' } })
    await waitFor(() => expect(tools.updatePreferences).toHaveBeenCalledWith({ theme: 'sepia' }))
  })
})

function fakeEngine() {
  const locator = { version: 1, format: 'pdf', progression: 0, pdf: { page: 1, pageCount: 2 } }
  const listeners = new Set()
  return {
    locator,
    format: 'pdf',
    subscribe: vi.fn((listener) => { listeners.add(listener); return () => listeners.delete(listener) }),
    emit(event) { for (const listener of listeners) listener(event) },
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

function fakeTools() {
  return {
    getState: vi.fn(() => ({ bookmarks: [], highlights: [], notes: [], preferences: {}, restoreWarning: null })),
    subscribe: vi.fn(() => () => {}),
    addBookmark: vi.fn().mockResolvedValue({ id: 'bookmark' }),
    addHighlight: vi.fn().mockResolvedValue({ id: 'highlight' }),
    addNote: vi.fn().mockResolvedValue({ id: 'note' }),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
    deleteBookmark: vi.fn(),
    deleteHighlight: vi.fn(),
    jumpTo: vi.fn(),
    searchAnnotations: vi.fn(() => []),
    updatePreferences: vi.fn().mockResolvedValue({ theme: 'sepia' }),
  }
}

function book() {
  return { id: 'book-id', title: 'Local Book', author: 'Reader', originalFilename: 'local.pdf', format: 'pdf' }
}
