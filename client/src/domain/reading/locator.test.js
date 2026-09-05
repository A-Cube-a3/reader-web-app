import { describe, expect, it } from 'vitest'
import {
  createEpubLocator,
  createPdfLocator,
  validateReadingLocator,
} from './locator.js'

describe('application reading locators', () => {
  it('creates resumable one-based PDF locations with normalized geometry', () => {
    expect(createPdfLocator({
      page: 3,
      pageCount: 5,
      textQuote: { exact: ' selected   words ', prefix: 'before', suffix: 'after' },
      geometry: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.04 }],
    })).toEqual({
      version: 1,
      format: 'pdf',
      progression: 0.5,
      pdf: {
        page: 3,
        pageCount: 5,
        textQuote: { exact: 'selected words', prefix: 'before', suffix: 'after' },
        geometry: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.04 }],
      },
    })
  })

  it('creates stable EPUB locations using CFI plus spine context', () => {
    expect(createEpubLocator({
      cfi: 'epubcfi(/6/4!/4/2/2)',
      spineHref: 'text/chapter-1.xhtml',
      spineIndex: 1,
      progression: 0.25,
      progressionInResource: 0.5,
    })).toMatchObject({
      version: 1,
      format: 'epub',
      progression: 0.25,
      epub: { spineIndex: 1, progressionInResource: 0.5 },
    })
  })

  it('rejects vague, malformed, and cross-format locations', () => {
    expect(() => validateReadingLocator({ version: 1, format: 'pdf', progression: 0.34 }))
      .toThrow(/page number/)
    expect(() => createEpubLocator({ cfi: 'chapter-1', spineHref: 'chapter.xhtml' }))
      .toThrow(/CFI/)
    expect(() => createEpubLocator({ cfi: 'epubcfi(/6/2)', spineHref: 'chapter.xhtml' }))
      .toThrow(/content-document CFI/)
    expect(() => validateReadingLocator(createPdfLocator({ page: 1, pageCount: 2 }), 'epub'))
      .toThrow(/format/)
  })
})
