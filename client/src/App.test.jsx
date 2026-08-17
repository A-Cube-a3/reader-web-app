import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { uploadLegacyBook } from './services/legacyBooksApi.js'

vi.mock('./services/legacyBooksApi.js', () => ({
  uploadLegacyBook: vi.fn(),
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unsupported files before calling the backend', () => {
    render(<App />)
    const input = screen.getByLabelText('Select a book to upload')

    fireEvent.change(input, { target: { files: [new File(['text'], 'notes.txt')] } })
    fireEvent.click(screen.getByRole('button', { name: 'Upload to Legacy Backend' }))

    expect(screen.getByText('Only PDF and EPUB files are supported.')).toBeInTheDocument()
    expect(uploadLegacyBook).not.toHaveBeenCalled()
  })

  it('shows successful metadata from the legacy service', async () => {
    uploadLegacyBook.mockResolvedValue({ id: 'book-id', title: 'Book' })
    render(<App />)
    const file = new File(['pdf'], 'book.pdf', { type: 'application/pdf' })

    fireEvent.change(screen.getByLabelText('Select a book to upload'), {
      target: { files: [file] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Upload to Legacy Backend' }))

    await waitFor(() => expect(uploadLegacyBook).toHaveBeenCalledWith(file))
    expect(screen.getByText(/Upload Successful/)).toBeInTheDocument()
    expect(screen.getByText(/book-id/)).toBeInTheDocument()
  })

  it('shows a useful service error', async () => {
    uploadLegacyBook.mockRejectedValue(new Error('Could not reach the optional legacy backend.'))
    render(<App />)

    fireEvent.change(screen.getByLabelText('Select a book to upload'), {
      target: { files: [new File(['pdf'], 'book.pdf')] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Upload to Legacy Backend' }))

    expect(await screen.findByText('Could not reach the optional legacy backend.')).toBeInTheDocument()
  })
})
