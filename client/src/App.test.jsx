import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'

describe('local library App', () => {
  let libraryService

  beforeEach(() => {
    libraryService = createLibraryService()
  })

  it('boots from the local library and does not require a cloud API', async () => {
    libraryService.initialize.mockResolvedValue([book()])
    render(<App libraryService={libraryService} />)

    expect(await screen.findByRole('button', { name: /Existing Book/ })).toBeInTheDocument()
    expect(screen.getByText('Your books live on this device and open without an account or server.'))
      .toBeInTheDocument()
    expect(libraryService.initialize).toHaveBeenCalledOnce()
  })

  it('imports a selected file locally and displays its details', async () => {
    const imported = book({ id: 'imported', title: 'Imported Book', originalFilename: 'local.pdf' })
    libraryService.importBook.mockResolvedValue(imported)
    render(<App libraryService={libraryService} />)
    await screen.findByText('Your shelf is ready')
    const source = new File(['%PDF-1.7'], 'local.pdf', { type: 'application/pdf' })

    fireEvent.change(screen.getByLabelText('Import a local book'), { target: { files: [source] } })
    fireEvent.click(screen.getByRole('button', { name: 'Import Book' }))

    await waitFor(() => expect(libraryService.importBook).toHaveBeenCalledWith(source))
    expect(await screen.findByText('Imported “Imported Book” into this device.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Imported Book', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('local.pdf')).toBeInTheDocument()
  })

  it('edits metadata and deletes the book through local services', async () => {
    const existing = book()
    const updated = book({ title: 'Renamed Book', updatedAt: '2026-03-02T00:00:00.000Z' })
    libraryService.initialize.mockResolvedValue([existing])
    libraryService.updateBook.mockResolvedValue(updated)
    libraryService.deleteBook.mockResolvedValue({ bookId: existing.id, cleanupPending: false })
    render(<App libraryService={libraryService} />)

    fireEvent.click(await screen.findByRole('button', { name: /Existing Book/ }))
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

  it('shows durable-storage denial and import errors without losing the library', async () => {
    libraryService.requestPersistentStorage.mockResolvedValue(storage({ persisted: false }))
    libraryService.importBook.mockRejectedValue(new Error('This PDF is damaged.'))
    render(<App libraryService={libraryService} />)
    await screen.findByText('Your shelf is ready')

    fireEvent.click(screen.getByRole('button', { name: 'Protect local books' }))
    expect(await screen.findByText(/Durable storage was not granted/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Import a local book'), {
      target: { files: [new File(['bad'], 'bad.pdf')] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Import Book' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This PDF is damaged.')
  })
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
    pageCount: 10,
    metadataSource: { type: 'pdf-embedded', extractedFields: [], userEditedFields: [] },
    ...overrides,
  }
}
