import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { getApiBaseUrl, validateClientEnvironment } from './src/config/runtimeConfig.js'

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')
  validateClientEnvironment(environment)
  getApiBaseUrl(environment)

  return {
    plugins: [react()],
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
