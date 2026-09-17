export function downloadLocalFile({ blob, filename }, documentObject = globalThis.document) {
  const url = URL.createObjectURL(blob)
  const link = documentObject.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
