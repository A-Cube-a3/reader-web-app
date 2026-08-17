const PROHIBITED_CLIENT_KEY = /(secret|password|private[_-]?key|api[_-]?key|jwt|mongo|database|credential|access[_-]?token|refresh[_-]?token)/i

export function validateClientEnvironment(environment) {
  const prohibitedKeys = Object.keys(environment).filter(
    (key) => key.startsWith('VITE_') && PROHIBITED_CLIENT_KEY.test(key),
  )

  if (prohibitedKeys.length > 0) {
    throw new Error(
      `Secret-like client configuration is prohibited: ${prohibitedKeys.join(', ')}`,
    )
  }
}

export function getApiBaseUrl(environment = import.meta.env ?? {}) {
  validateClientEnvironment(environment)

  const configuredValue = environment.VITE_API_BASE_URL?.trim() || '/api'
  const normalizedValue = configuredValue === '/' ? '/' : configuredValue.replace(/\/+$/, '')

  if (normalizedValue.startsWith('/')) {
    return normalizedValue
  }

  let parsedUrl
  try {
    parsedUrl = new URL(normalizedValue)
  } catch {
    throw new Error('VITE_API_BASE_URL must be a root-relative path or an HTTP(S) URL')
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw new Error('VITE_API_BASE_URL must be a credential-free HTTP(S) URL')
  }

  return normalizedValue
}

export const apiBaseUrl = getApiBaseUrl()
