import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { getApiBaseUrl, validateClientEnvironment } from './src/config/runtimeConfig.js'

export const pwaOptions = {
  registerType: 'prompt',
  injectRegister: null,
  manifest: {
    id: '/',
    name: 'Reader — Local PDF & EPUB Library',
    short_name: 'Reader',
    description: 'Import and manage a private PDF and EPUB library on this device.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f2eee6',
    theme_color: '#1f382f',
    categories: ['books', 'education', 'productivity'],
    icons: [
      {
        src: '/icons/reader-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/reader-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/reader-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{html,js,mjs,css,png,svg}'],
    globIgnores: [
      'icons/reader-192.png',
      'icons/reader-512.png',
      'icons/reader-maskable-512.png',
    ],
    navigateFallback: 'index.html',
    navigateFallbackDenylist: [/^\/api(?:\/|$)/],
    cleanupOutdatedCaches: true,
    clientsClaim: false,
    skipWaiting: false,
    maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
  },
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')
  validateClientEnvironment(environment)
  getApiBaseUrl(environment)

  return {
    plugins: [react(), VitePWA(pwaOptions)],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: environment.VITE_BACKEND_PROXY_TARGET || 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
      css: true,
    },
  }
})
