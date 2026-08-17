import { describe, expect, it } from 'vitest'
import { getApiBaseUrl, validateClientEnvironment } from './runtimeConfig.js'

describe('runtime configuration', () => {
  it('defaults the backend API to the same-origin proxy', () => {
    expect(getApiBaseUrl({})).toBe('/api')
  })

  it('normalizes configured API URLs', () => {
    expect(getApiBaseUrl({ VITE_API_BASE_URL: 'https://api.example.com/v1/' }))
      .toBe('https://api.example.com/v1')
  })

  it('rejects credential-bearing API URLs', () => {
    expect(() => getApiBaseUrl({ VITE_API_BASE_URL: 'https://user:pass@example.com' }))
      .toThrow('credential-free')
  })

  it('rejects secret-like Vite variables', () => {
    expect(() => validateClientEnvironment({ VITE_MONGODB_PASSWORD: 'unsafe' }))
      .toThrow('VITE_MONGODB_PASSWORD')
  })
})
