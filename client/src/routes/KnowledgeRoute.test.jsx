import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import KnowledgeRoute from './KnowledgeRoute.jsx'

const locator = { version: 1, format: 'pdf', progression: 0, pdf: { page: 1, pageCount: 2 } }

describe('KnowledgeRoute', () => {
  it('filters, edits, tags, removes, jumps, and exports local records', async () => {
    const service = { updateNote: vi.fn(), updateTags: vi.fn(), deleteNote: vi.fn(), deleteHighlight: vi.fn() }
    const exportService = { create: vi.fn().mockResolvedValue({ blob: new Blob(['local']), filename: 'knowledge.md' }) }
    const navigation = { openReader: vi.fn() }
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const createObjectURL = vi.fn().mockReturnValue('blob:local')
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    render(<KnowledgeRoute
      snapshot={{
        books: [{ id: 'book', title: 'Offline Book', author: 'Ada' }],
        notes: [{ id: 'note', bookId: 'book', body: 'Initial thought', tags: ['idea'], locator, updatedAt: '2026-09-17T00:00:00.000Z' }],
        highlights: [{ id: 'highlight', bookId: 'book', quote: { exact: 'Selected passage' }, tags: [], locator, updatedAt: '2026-09-16T00:00:00.000Z' }],
        tags: ['idea'],
      }}
      service={service}
      exportService={exportService}
      navigation={navigation}
      onRefresh={vi.fn()}
      onError={vi.fn()}
      onNotice={vi.fn()}
    />)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), { target: { value: 'thought' } })
    expect(screen.getByText('1 local record')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Edit note from Offline Book'), { target: { value: 'Edited thought' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }))
    await waitFor(() => expect(service.updateNote).toHaveBeenCalledWith('note', 'Edited thought'))
    fireEvent.click(screen.getByRole('button', { name: 'Open source' }))
    expect(navigation.openReader).toHaveBeenCalledWith('book', locator)
    fireEvent.click(screen.getByRole('button', { name: 'Markdown' }))
    await waitFor(() => expect(exportService.create).toHaveBeenCalledWith('markdown', expect.objectContaining({ notes: expect.any(Array) })))
    expect(createObjectURL).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()
  })
})
