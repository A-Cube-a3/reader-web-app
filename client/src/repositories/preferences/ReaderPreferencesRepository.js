const FORMATS = new Set(['pdf', 'epub'])

export class ReaderPreferencesRepository {
  constructor(settingsRepository) {
    this.settingsRepository = settingsRepository
  }

  get(format) {
    assertFormat(format)
    return this.settingsRepository.get(keyFor(format), {})
  }

  set(format, preferences) {
    assertFormat(format)
    return this.settingsRepository.set(keyFor(format), { ...preferences })
  }
}

function keyFor(format) {
  return `reader.preferences.${format}`
}

function assertFormat(format) {
  if (!FORMATS.has(format)) throw new TypeError('Reader preferences require a supported format')
}
