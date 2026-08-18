import {
  BookTooLargeError,
  InvalidBookError,
  UnsupportedBookError,
} from '../../domain/books/errors.js'
import { readBlobAsArrayBuffer } from './blob.js'

export const MAX_BOOK_BYTES = 512 * 1024 * 1024

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]

export async function detectBookFormat(file, { maximumBytes = MAX_BOOK_BYTES } = {}) {
  if (!file || typeof file.size !== 'number' || file.size === 0) {
    throw new InvalidBookError('The selected book is empty or unreadable.')
  }
  if (file.size > maximumBytes) throw new BookTooLargeError(maximumBytes)

  const header = new Uint8Array(await readBlobAsArrayBuffer(file.slice(0, 1024)))
  if (findSignature(header, PDF_SIGNATURE) >= 0) return 'pdf'
  if (isZipSignature(header)) return 'epub'

  const extension = String(file.name || '').split('.').pop()?.toLowerCase()
  if (extension === 'pdf' || extension === 'epub') {
    throw new InvalidBookError(`This .${extension} file does not have a valid file signature.`)
  }
  throw new UnsupportedBookError()
}

function findSignature(bytes, signature) {
  const lastStart = bytes.length - signature.length
  for (let index = 0; index <= lastStart; index += 1) {
    if (signature.every((byte, offset) => bytes[index + offset] === byte)) return index
  }
  return -1
}

function isZipSignature(bytes) {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && (
    (bytes[2] === 0x03 && bytes[3] === 0x04)
    || (bytes[2] === 0x05 && bytes[3] === 0x06)
    || (bytes[2] === 0x07 && bytes[3] === 0x08)
  )
}
