const MARKUP_TYPES = new Set(['application/xhtml+xml', 'text/html', 'image/svg+xml'])
const REMOVE_ELEMENTS = 'script, iframe, frame, frameset, object, embed, portal, base, meta[http-equiv], foreignObject'
const RESOURCE_ATTRIBUTES = ['src', 'poster', 'data', 'xlink:href']

export async function sanitizeEpubResource(data, type = '') {
  const value = data instanceof Blob ? await data.text() : String(data ?? '')
  const mediaType = type.split(';', 1)[0].trim().toLocaleLowerCase()
  if (mediaType === 'text/css') return sanitizeCss(value)
  if (!MARKUP_TYPES.has(mediaType)) return data

  const parserType = mediaType === 'image/svg+xml' ? 'image/svg+xml' : mediaType
  const document = new DOMParser().parseFromString(value, parserType)
  document.querySelectorAll(REMOVE_ELEMENTS).forEach((element) => element.remove())

  for (const element of document.querySelectorAll('*')) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLocaleLowerCase()
      if (name.startsWith('on') || name === 'srcdoc') element.removeAttribute(attribute.name)
    }

    if (element.hasAttribute('style')) {
      element.setAttribute('style', sanitizeCss(element.getAttribute('style')))
    }
    for (const attribute of RESOURCE_ATTRIBUTES) {
      if (element.hasAttribute(attribute) && !isSafeResourceUrl(element.getAttribute(attribute))) {
        element.removeAttribute(attribute)
      }
    }
    if (element.localName === 'link' && element.hasAttribute('href')
      && !isSafeResourceUrl(element.getAttribute('href'))) {
      element.removeAttribute('href')
    }
    if (element.localName === 'a' && element.hasAttribute('href')
      && !isSafeLinkUrl(element.getAttribute('href'))) {
      element.removeAttribute('href')
    }
  }

  for (const style of document.querySelectorAll('style')) {
    style.textContent = sanitizeCss(style.textContent)
  }
  for (const form of document.querySelectorAll('form')) form.replaceWith(...form.childNodes)

  return new XMLSerializer().serializeToString(document)
}

export function sanitizeCss(css) {
  return String(css || '')
    .replace(/@import\s+(?:url\()?\s*(['"]?)(?!blob:|data:)[^;)]*\1\s*\)?\s*;?/gi, '')
    .replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi, (match, _quote, url) => (
      isSafeResourceUrl(url) ? `url("${url}")` : 'url("")'
    ))
    .replace(/(?:expression|behavior|-moz-binding)\s*:[^;}]*/gi, '')
    .replace(/javascript\s*:/gi, '')
}

function isSafeResourceUrl(value) {
  const url = String(value || '').trim()
  return !url || url.startsWith('#') || url.startsWith('blob:') || url.startsWith('data:')
}

function isSafeLinkUrl(value) {
  const url = String(value || '').trim()
  if (!url || url.startsWith('#') || url.startsWith('blob:')) return true
  try {
    const parsed = new URL(url, 'https://reader.invalid/')
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(parsed.protocol)
  } catch {
    return false
  }
}
