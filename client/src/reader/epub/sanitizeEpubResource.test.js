import { describe, expect, it } from 'vitest'
import { sanitizeCss, sanitizeEpubResource } from './sanitizeEpubResource.js'

describe('EPUB active-content sanitization', () => {
  it('removes scripts, executable attributes, embedded documents, and remote resources', async () => {
    const unsafe = `<!doctype html><html><head>
      <script>parent.pwned = true</script>
      <style>body{background:url(https://tracker.invalid/pixel)}</style>
      </head><body onload="steal()">
      <p id="safe">Keep this text</p>
      <img src="https://tracker.invalid/cover" onerror="steal()">
      <img id="local" src="blob:https://reader.invalid/local">
      <iframe srcdoc="<script>steal()</script>"></iframe>
      <a id="bad" href="javascript:steal()">bad</a>
      <a id="external" href="https://example.com">external</a>
      </body></html>`

    const sanitized = await sanitizeEpubResource(unsafe, 'text/html')
    const document = new DOMParser().parseFromString(sanitized, 'text/html')
    expect(document.querySelector('script,iframe')).toBeNull()
    expect(document.body.hasAttribute('onload')).toBe(false)
    expect(document.querySelector('img:not(#local)').hasAttribute('src')).toBe(false)
    expect(document.querySelector('#local').getAttribute('src')).toMatch(/^blob:/)
    expect(document.querySelector('#bad').hasAttribute('href')).toBe(false)
    expect(document.querySelector('#external').getAttribute('href')).toBe('https://example.com')
    expect(document.body.textContent).toContain('Keep this text')
    expect(sanitized).not.toContain('tracker.invalid')
  })

  it('blocks remote CSS fetches while retaining app-generated blob resources', () => {
    const css = sanitizeCss(`
      @import "https://tracker.invalid/theme.css";
      .remote { background: url(https://tracker.invalid/a.png) }
      .local { background: url('blob:https://reader.invalid/asset') }
    `)
    expect(css).not.toContain('tracker.invalid')
    expect(css).toContain('blob:https://reader.invalid/asset')
  })
})
