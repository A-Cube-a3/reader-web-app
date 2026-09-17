import { locationLabel } from '../../domain/annotations/annotation.js'

export class KnowledgeExportService {
  constructor({ clock = () => new Date(), pdfExporter = defaultPdfExporter } = {}) {
    Object.assign(this, { clock, pdfExporter })
  }

  async create(format, { books = [], notes = [], highlights = [] } = {}) {
    const records = buildKnowledgeRecords({ books, notes, highlights })
    const date = this.clock().toISOString().slice(0, 10)
    if (format === 'markdown') {
      return fileResult(markdownFor(records), `reader-knowledge-${date}.md`, 'text/markdown;charset=utf-8')
    }
    if (format === 'text') {
      return fileResult(textFor(records), `reader-knowledge-${date}.txt`, 'text/plain;charset=utf-8')
    }
    if (format === 'pdf') {
      return {
        blob: await this.pdfExporter(records),
        filename: `reader-knowledge-${date}.pdf`,
        warnings: [],
      }
    }
    throw new TypeError('Export format is unsupported')
  }
}

export function buildKnowledgeRecords({ books = [], notes = [], highlights = [] }) {
  const booksById = new Map(books.map((book) => [book.id, book]))
  return [
    ...notes.map((note) => ({ ...note, type: 'note', text: note.body })),
    ...highlights.map((highlight) => ({ ...highlight, type: 'highlight', text: highlight.quote?.exact || '' })),
  ].map((record) => ({
    ...record,
    bookTitle: booksById.get(record.bookId)?.title || 'Unknown book',
    author: booksById.get(record.bookId)?.author || '',
    location: record.locator ? locationLabel(record.locator) : 'Book-level note',
  })).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export function markdownFor(records) {
  const lines = ['# Reader knowledge export', '', `Exported ${records.length} local ${records.length === 1 ? 'record' : 'records'}.`, '']
  for (const record of records) {
    lines.push(`## ${record.type === 'note' ? 'Note' : 'Highlight'} — ${record.bookTitle}`)
    if (record.author) lines.push('', `**Author:** ${record.author}`)
    lines.push('', `**Location:** ${record.location}`)
    if (record.tags?.length) lines.push('', `**Tags:** ${record.tags.join(', ')}`)
    lines.push('', record.type === 'highlight' ? quoteMarkdown(record.text) : record.text, '')
  }
  return `${lines.join('\n').trim()}\n`
}

export function textFor(records) {
  const lines = ['READER KNOWLEDGE EXPORT', `${records.length} local ${records.length === 1 ? 'record' : 'records'}`, '']
  for (const record of records) {
    lines.push(`${record.type.toUpperCase()} — ${record.bookTitle}`)
    if (record.author) lines.push(`Author: ${record.author}`)
    lines.push(`Location: ${record.location}`)
    if (record.tags?.length) lines.push(`Tags: ${record.tags.join(', ')}`)
    lines.push(record.text, '', '---', '')
  }
  return `${lines.join('\n').trim()}\n`
}

function quoteMarkdown(text) {
  return String(text).split('\n').map((line) => `> ${line}`).join('\n')
}

function fileResult(content, filename, type) {
  return { blob: new Blob([content], { type }), filename, warnings: [] }
}

async function defaultPdfExporter(records) {
  const { createKnowledgePdf } = await import('./PdfKnowledgeExporter.js')
  return createKnowledgePdf(records)
}
