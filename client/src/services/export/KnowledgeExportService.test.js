import { describe, expect, it, vi } from 'vitest'
import { KnowledgeExportService, markdownFor, textFor } from './KnowledgeExportService.js'

const records = [{ type: 'highlight', bookTitle: 'Local Book', author: 'Ada', location: 'Page 2', text: 'Selected text', tags: ['idea'], updatedAt: '2026-09-17T00:00:00.000Z' }]

describe('local knowledge export', () => {
  it('formats portable Markdown and plain text without a server', () => {
    expect(markdownFor(records)).toContain('> Selected text')
    expect(markdownFor(records)).toContain('**Tags:** idea')
    expect(textFor(records)).toContain('HIGHLIGHT — Local Book')
  })

  it('delegates PDF generation lazily and returns a downloadable file', async () => {
    const pdfExporter = vi.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }))
    const service = new KnowledgeExportService({ clock: () => new Date('2026-09-17T00:00:00Z'), pdfExporter })
    const file = await service.create('pdf', { books: [], notes: [], highlights: [] })
    expect(file).toMatchObject({ filename: 'reader-knowledge-2026-09-17.pdf' })
    expect(file.blob.type).toBe('application/pdf')
    expect(pdfExporter).toHaveBeenCalledOnce()
  })
})
