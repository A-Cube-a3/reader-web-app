import { describe, expect, it } from 'vitest'
import { pwaOptions } from './vite.config.js'

describe('PWA build configuration', () => {
  it('defines an installable standalone manifest with required raster icons', () => {
    expect(pwaOptions.manifest).toMatchObject({
      id: '/',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: '#1f382f',
    })
    expect(pwaOptions.manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192', type: 'image/png' }),
      expect.objectContaining({ sizes: '512x512', type: 'image/png' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
    ]))
  })

  it('precaches the complete shell and uses a prompt-based update lifecycle', () => {
    expect(pwaOptions).toMatchObject({ registerType: 'prompt', injectRegister: null })
    expect(pwaOptions.workbox.globPatterns).toContain('**/*.{html,js,mjs,css,png,svg}')
    expect(pwaOptions.workbox.globIgnores).toContain('icons/reader-maskable-512.png')
    expect(pwaOptions.workbox.navigateFallback).toBe('index.html')
    expect(pwaOptions.workbox.skipWaiting).toBe(false)
    expect(pwaOptions.workbox.clientsClaim).toBe(false)
    expect(pwaOptions.workbox.navigateFallbackDenylist[0].test('/api/books')).toBe(true)
    expect(pwaOptions.workbox.navigateFallbackDenylist[0].test('/api')).toBe(true)
  })
})
