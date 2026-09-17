import fontkit from '@pdf-lib/fontkit'
import fontUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf?url'
import { PDFDocument, rgb } from 'pdf-lib'

const PAGE = { width: 595.28, height: 841.89, margin: 54 }

export async function createKnowledgePdf(records, { fontBytes = null } = {}) {
  const document = await PDFDocument.create()
  document.registerFontkit(fontkit)
  const bytes = fontBytes || await fetch(fontUrl).then((response) => {
    if (!response.ok) throw new Error('The bundled export font could not be loaded.')
    return response.arrayBuffer()
  })
  const font = await document.embedFont(bytes, { subset: true })
  let page
  let y

  function newPage() {
    page = document.addPage([PAGE.width, PAGE.height])
    y = PAGE.height - PAGE.margin
  }

  function write(text, { size = 10, gap = 5, color = rgb(0.12, 0.15, 0.2) } = {}) {
    const lines = wrapText(String(text || ''), font, size, PAGE.width - (PAGE.margin * 2))
    for (const line of lines.length ? lines : ['']) {
      if (y < PAGE.margin + size) newPage()
      page.drawText(line, { x: PAGE.margin, y, size, font, color })
      y -= size + 3
    }
    y -= gap
  }

  newPage()
  write('Reader knowledge export', { size: 20, gap: 10 })
  write(`${records.length} local ${records.length === 1 ? 'record' : 'records'}`, { color: rgb(0.35, 0.4, 0.46), gap: 15 })
  for (const record of records) {
    write(`${record.type === 'note' ? 'Note' : 'Highlight'} - ${record.bookTitle}`, { size: 13, gap: 4 })
    if (record.author) write(`Author: ${record.author}`, { color: rgb(0.35, 0.4, 0.46), gap: 2 })
    write(`Location: ${record.location}`, { color: rgb(0.35, 0.4, 0.46), gap: 2 })
    if (record.tags?.length) write(`Tags: ${record.tags.join(', ')}`, { color: rgb(0.35, 0.4, 0.46), gap: 4 })
    write(record.text, { gap: 14 })
  }
  return new Blob([await document.save()], { type: 'application/pdf' })
}

function wrapText(text, font, size, maxWidth) {
  const output = []
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (!words.length) {
      output.push('')
      continue
    }
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (!line || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate
      } else {
        output.push(line)
        line = word
      }
    }
    output.push(line)
  }
  return output
}
