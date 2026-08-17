import { apiBaseUrl } from '../config/runtimeConfig.js'

export class ApiRequestError extends Error {
  constructor(message, { status = null, code = null, cause } = {}) {
    super(message, { cause })
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
  }
}

export async function uploadLegacyBook(file, fetchImplementation = fetch) {
  const formData = new FormData()
  formData.append('file', file)

  let response
  try {
    response = await fetchImplementation(`${apiBaseUrl}/books/upload`, {
      method: 'POST',
      body: formData,
    })
  } catch (cause) {
    throw new ApiRequestError('Could not reach the optional legacy backend.', { cause })
  }

  const data = await parseResponse(response)
  if (!response.ok) {
    throw new ApiRequestError(
      data?.message || data?.error || `Upload failed with status ${response.status}.`,
      { status: response.status, code: data?.code || null },
    )
  }

  return data
}

async function parseResponse(response) {
  const responseText = await response.text()
  if (!responseText) return null

  try {
    return JSON.parse(responseText)
  } catch {
    throw new ApiRequestError('The backend returned an unreadable response.', {
      status: response.status,
    })
  }
}
