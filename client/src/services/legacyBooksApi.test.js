import { describe, expect, it, vi } from 'vitest'
import { ApiRequestError, uploadLegacyBook } from './legacyBooksApi.js'

describe('legacy book API', () => {
  const file = new File(['pdf'], 'book.pdf', { type: 'application/pdf' })

  it('returns parsed metadata for a successful upload', async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'book-id', title: 'Book' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(uploadLegacyBook(file, fetchImplementation))
      .resolves.toEqual({ id: 'book-id', title: 'Book' })
    expect(fetchImplementation).toHaveBeenCalledWith(
      '/api/books/upload',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    )
  })

  it('uses the server error contract', async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 'INVALID_BOOK_UPLOAD', message: 'Invalid book' }), {
        status: 400,
      }),
    )

    await expect(uploadLegacyBook(file, fetchImplementation)).rejects.toMatchObject({
      name: 'ApiRequestError',
      message: 'Invalid book',
      status: 400,
      code: 'INVALID_BOOK_UPLOAD',
    })
  })

  it('reports connectivity failures without a localhost assumption', async () => {
    const fetchImplementation = vi.fn().mockRejectedValue(new TypeError('offline'))

    await expect(uploadLegacyBook(file, fetchImplementation)).rejects.toEqual(
      expect.objectContaining({
        constructor: ApiRequestError,
        message: 'Could not reach the optional legacy backend.',
      }),
    )
  })

  it('rejects malformed success bodies', async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(new Response('not-json', { status: 200 }))

    await expect(uploadLegacyBook(file, fetchImplementation)).rejects.toThrow(
      'The backend returned an unreadable response.',
    )
  })
})
