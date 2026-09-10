import { describe, expect, it, vi } from 'vitest'
import { ReaderPreferencesRepository } from './ReaderPreferencesRepository.js'

describe('ReaderPreferencesRepository', () => {
  it('keeps PDF and EPUB preferences in separate local settings', async () => {
    const settings = { get: vi.fn(async (_key, fallback) => fallback), set: vi.fn().mockResolvedValue(undefined) }
    const repository = new ReaderPreferencesRepository(settings)

    await expect(repository.get('pdf')).resolves.toEqual({})
    await repository.set('epub', { theme: 'night' })
    expect(settings.get).toHaveBeenCalledWith('reader.preferences.pdf', {})
    expect(settings.set).toHaveBeenCalledWith('reader.preferences.epub', { theme: 'night' })
    expect(() => repository.get('txt')).toThrow(/format/)
  })
})
