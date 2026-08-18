import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'

describe('offline local library App', () => {
  let libraryService
  let pwaService

  beforeEach(() => {
    libraryService = createLibraryService()
    pwaService = createPwaService()
  })

  it('boots dashboard and catalog views from local state without a cloud API', async () => {
    libraryService.initialize.mockResolvedValue([book({ progress: {
      progression: 0.35,
      updatedAt: '2026-03-03T00:00:00.000Z',
    } })])
    renderApp()

    const catalog = await screen.findByRole('region', { name: 'My Library' })
    expect(within(catalog).getByRole('button', { name: /Existing Book/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Continue Reading' })).toHaveTextContent('35%')
    expect(screen.getByRole('region', { name: 'Recent Books' })).toHaveTextContent('Existing Book')
    expect(screen.getByText('Private books, ready without an account or server.')).toBeInTheDocument()
    expect(libraryService.initialize).toHaveBeenCalledOnce()
  })

  it('searches local metadata and filters the catalog by format', async () => {
    libraryService.initialize.mockResolvedValue([
      book({ id: 'pdf', title: 'PDF Manual', format: 'pdf', author: 'Ada' }),
      book({ id: 'epub', title: 'EPUB Guide', format: 'epub', author: 'Grace' }),
    ])
    renderApp()
    const catalog = await screen.findByRole('region', { name: 'My Library' })

    fireEvent.change(within(catalog).getByLabelText('Search local metadata'), {
      target: { value: 'epub guide' },
    })
    expect(within(catalog).getByRole('button', { name: /EPUB Guide/ })).toBeInTheDocument()
    expect(within(catalog).queryByRole('button', { name: /PDF Manual/ })).not.toBeInTheDocument()

    fireEvent.change(within(catalog).getByLabelText('Search local metadata'), {
      target: { value: '' },
    })
    fireEvent.click(within(catalog).getByRole('button', { name: 'PDF' }))
    expect(within(catalog).getByRole('button', { name: /PDF Manual/ })).toBeInTheDocument()
    expect(within(catalog).queryByRole('button', { name: /EPUB Guide/ })).not.toBeInTheDocument()
  })

  it('imports a selected file locally and displays its details', async () => {
    const imported = book({ id: 'imported', title: 'Imported Book', originalFilename: 'local.pdf' })
    libraryService.importBook.mockResolvedValue(imported)
    renderApp()
    await screen.findByText('Your shelf is ready')
    const source = new File(['%PDF-1.7'], 'local.pdf', { type: 'application/pdf' })

    fireEvent.change(screen.getByLabelText('Import a local book'), { target: { files: [source] } })
    fireEvent.click(screen.getByRole('button', { name: 'Import Book' }))

    await waitFor(() => expect(libraryService.importBook).toHaveBeenCalledWith(source))
    expect(await screen.findByText('Imported “Imported Book” into this device.')).toBeInTheDocument()
    const details = screen.getByLabelText('Book details')
    expect(within(details).getByRole('heading', { name: 'Imported Book' })).toBeInTheDocument()
    expect(within(details).getByText('local.pdf')).toBeInTheDocument()
  })

  it('edits metadata and deletes the book through local services', async () => {
    const existing = book()
    const updated = book({ title: 'Renamed Book', updatedAt: '2026-03-02T00:00:00.000Z' })
    libraryService.initialize.mockResolvedValue([existing])
    libraryService.updateBook.mockResolvedValue(updated)
    libraryService.deleteBook.mockResolvedValue({ bookId: existing.id, cleanupPending: false })
    renderApp()

    const catalog = await screen.findByRole('region', { name: 'My Library' })
    fireEvent.click(within(catalog).getByRole('button', { name: /Existing Book/ }))
    const details = screen.getByLabelText('Book details')
    fireEvent.change(within(details).getByLabelText('Title'), { target: { value: 'Renamed Book' } })
    fireEvent.click(within(details).getByRole('button', { name: 'Save details' }))

    await waitFor(() => expect(libraryService.updateBook).toHaveBeenCalledWith(
      existing.id,
      expect.objectContaining({ title: 'Renamed Book' }),
    ))
    expect(screen.getByText('Book details saved locally.')).toBeInTheDocument()

    fireEvent.click(within(details).getByRole('button', { name: 'Delete local book' }))
    await waitFor(() => expect(libraryService.deleteBook).toHaveBeenCalledWith(existing.id))
    expect(screen.getByText('Your shelf is ready')).toBeInTheDocument()
  })

  it('keeps storage and import failures recoverable without losing the catalog', async () => {
    libraryService.initialize.mockResolvedValue([book()])
    libraryService.inspectStorage.mockRejectedValue(new Error('Storage estimate failed.'))
    libraryService.importBook.mockRejectedValue(new Error('This PDF is damaged.'))
    renderApp()

    const catalog = await screen.findByRole('region', { name: 'My Library' })
    expect(within(catalog).getByRole('button', { name: /Existing Book/ })).toBeInTheDocument()
    expect(screen.getByText(/Storage estimate failed/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Import a local book'), {
      target: { files: [new File(['bad'], 'bad.pdf')] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Import Book' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This PDF is damaged.')
  })

  it('presents offline, install, and update states as scoped application actions', async () => {
    pwaService = createPwaService({
      online: false,
      installAvailable: true,
      updateAvailable: true,
    })
    renderApp()
    await screen.findByText('Your shelf is ready')

    expect(screen.getByText('Offline · local library ready')).toHaveAttribute('role', 'status')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Install app' }))
    expect(pwaService.install).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Update now' }))
    expect(pwaService.applyUpdate).toHaveBeenCalledOnce()
  })

  function renderApp() {
    return render(<App libraryService={libraryService} pwaService={pwaService} />)
  }
})

function createLibraryService() {
  return {
    initialize: vi.fn().mockResolvedValue([]),
    inspectStorage: vi.fn().mockResolvedValue(storage()),
    requestPersistentStorage: vi.fn(),
    importBook: vi.fn(),
    updateBook: vi.fn(),
    deleteBook: vi.fn(),
  }
}

function createPwaService(overrides = {}) {
  const snapshot = {
    online: true,
    offlineReady: false,
    updateAvailable: false,
    installAvailable: false,
    installed: false,
    registrationError: null,
    ...overrides,
  }
  return {
    subscribe: vi.fn(() => () => {}),
    getSnapshot: vi.fn(() => snapshot),
    install: vi.fn().mockResolvedValue(true),
    applyUpdate: vi.fn().mockResolvedValue(undefined),
    dismissUpdate: vi.fn(),
    dismissOfflineReady: vi.fn(),
    dismissRegistrationError: vi.fn(),
  }
}

function storage(overrides = {}) {
  return { supported: true, persisted: false, usage: 120, quota: 1000, available: 880, ...overrides }
}

function book(overrides = {}) {
  return {
    id: 'book-1',
    title: 'Existing Book',
    author: 'Local Author',
    description: '',
    publisher: '',
    language: '',
    identifier: '',
    format: 'pdf',
    binaryReference: 'opfs:v1:book-1',
    coverReference: null,
    originalFilename: 'existing.pdf',
    fileSize: 1000,
    importedAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    lastOpenedAt: null,
    pageCount: 10,
    metadataSource: { type: 'pdf-embedded', extractedFields: [], userEditedFields: [] },
    ...overrides,
  }
}
