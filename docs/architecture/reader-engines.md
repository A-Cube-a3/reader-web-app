# Local reading engines

## Implemented boundary

Phase 4 adds a real offline reader without changing local storage authority:

```text
ReaderRoute
  -> ReaderService
      -> LocalLibraryService.openBookBinary(bookId)
          -> BookBinaryStorage.open(opaque reference)
      -> ReaderEngineRegistry.create(format)
          -> PdfReaderEngine (PDF.js)
          -> EpubReaderEngine (Foliate JS)
```

No reader path calls Spring Boot. `ReaderService` resolves the local book record and OPFS `File`, validates an optional application locator, selects the format engine, and closes partial sessions on failure. Engine modules are dynamic imports so opening the library does not execute renderer code.

## `ReaderEngine` lifecycle

Concrete engines expose the same application-facing operations:

```text
open({ book, source, locator?, preferences? })
attach(container)
getState()
getCurrentLocator()
getTableOfContents()
goTo(locator | engine-independent TOC target)
next()
previous()
search(query)
setViewPreferences(changes)
subscribe(eventListener)
close()
```

Events have stable application meanings: `state`, `location`, `selection`, and `error`. An `external-link` event is a safe notification; it does not navigate. React owns transient screen state and renders controls, but it never stores PDF.js/Foliate objects. Phase 5's `ReaderToolsSession` consumes `location` events, debounces them into the local progress repository, flushes at lifecycle/close boundaries, and restores the last committed locator through `ReaderService`.

`close()` cancels rendering, removes DOM/event handlers, unloads publication sections, revokes engine-managed blob resources, destroys the PDF document/worker, and drops subscriptions. Reader failures are contained to the reader route; the library remains available.

## Application locator version 1

The locator is owned by `domain/reading/locator.js`. A percentage is an optional display/sort aid, never the only anchor.

PDF example:

```json
{
  "version": 1,
  "format": "pdf",
  "progression": 0.5,
  "pdf": {
    "page": 51,
    "pageCount": 101,
    "textQuote": { "exact": "selected text", "prefix": "", "suffix": "" },
    "geometry": [{ "x": 0.1, "y": 0.2, "width": 0.3, "height": 0.04 }]
  }
}
```

PDF pages are one-based. Annotation rectangles are normalized to the rendered page (zero through one), so viewport pixels are not persisted.

EPUB example:

```json
{
  "version": 1,
  "format": "epub",
  "progression": 0.25,
  "epub": {
    "cfi": "epubcfi(/6/4!/4/2/2)",
    "spineHref": "text/chapter-1.xhtml",
    "spineIndex": 1,
    "progressionInResource": 0.5,
    "textQuote": { "exact": "selected text", "prefix": "before", "suffix": "after" }
  }
}
```

A content-document CFI (including the package-to-content `!` indirection) is required. Spine href/index and progression provide context and recovery hints; they do not replace the CFI. Locators reject unsupported versions, cross-format use, invalid pages/progression, missing or package-only CFIs, empty quotes, and non-normalized geometry.

## PDF implementation

`PdfReaderEngine` uses the existing `pdfjs-dist` dependency and a bundled module worker. It passes local bytes directly to PDF.js with dynamic evaluation and XFA disabled.

- Only the current page is fetched and rendered into a canvas.
- The corresponding PDF.js text layer remains selectable.
- Fit-width, fit-page, bounded custom zoom, and quarter-turn rotation rerender only the current page.
- Page jump/next/previous emit normalized PDF locators.
- Outline destinations are resolved lazily into application locators.
- Search requests text page-by-page without rendering canvases and return at most 200 results.
- Selection reports exact text plus normalized page rectangles and capture rotation; Phase 5 persists those stable anchors and paints current-page highlights below the selectable text layer.
- `ResizeObserver` refits the current page when the reading viewport changes.

The engine currently reads the OPFS `File` into a typed array before handing it to PDF.js. It does not keep those bytes in React state and does not render all pages. True range streaming from OPFS is deferred until measurements show it is necessary.

## EPUB implementation

The choice and comparison are recorded in [ADR-002](adr-002-epub-renderer.md). `EpubReaderEngine` parses the local file with Foliate, renders one spine section at a time, and translates relocation/selection/search results to CFI-backed application locators.

Supported Phase 4 behavior:

- reflowable and fixed-layout publication dispatch through Foliate;
- nested table of contents and internal navigation;
- paginated mode and a user-selectable scrolling mode;
- CFI resume/jump/location reporting;
- selected text with quote context;
- incremental section search capped at 200 matches;
- bounded, locally persisted theme/typography preferences;
- CFI-backed highlights through Foliate's annotation overlayer, with unresolved CFIs skipped rather than blocking the reader.

EPUB HTML, SVG, CSS, links, and assets are untrusted. See ADR-002 for the pre-blob sanitizer, CSP, live-document pass, external-link interception, and remaining Phase 10 audit work. Scripted EPUB is deliberately unsupported.

## Reader route and controls

The web platform adapter maps `/read/<book UUID>` to a reader session without exposing the browser history API to domain code. The route provides:

- library return, title/author, progression, TOC, and local search;
- next/previous buttons and Arrow/Page/Space keyboard navigation;
- PDF page jump, zoom, fit, and rotate controls;
- EPUB paginated/scrolling flow;
- bookmark, highlight, note, annotation search, and format-specific preference panels;
- responsive side panel, loading, scoped error, stale-anchor recovery, and blocked-external-link states.

Direct offline navigation is covered by the Phase 3 shell fallback. A valid direct reader URL still resolves its book and binary only from IndexedDB/OPFS.

## Manual production check

Use a production build because the development server does not exercise the generated service worker:

```bash
cd client
pnpm build
pnpm preview
```

Keep Spring Boot and MongoDB stopped, then:

1. Open the preview once and wait for it to be service-worker controlled.
2. Import a two-or-more-page text PDF. Open it and verify the first canvas and selectable text layer, next/previous and page jump, search result navigation, zoom, both fit modes, and rotation.
3. Return to the library, import a reflowable EPUB, and verify chapter/TOC navigation, next/previous, both reading flows, text selection, and search.
4. Use a deliberately hostile test EPUB and confirm embedded scripts do not execute, remote publication resources make no requests, and external links do not open automatically.
5. Copy the current `/read/<book UUID>` URL, disable networking, reload that URL, and confirm the title and reader render without an alert or `/api` request.
6. Confirm the imported binaries exist in application-managed storage and that React does not hold every PDF page or EPUB chapter in the DOM.

Phase 4 was exercised in a clean headless Chromium profile with generated two-page PDF and two-chapter EPUB fixtures. The run observed PDF canvas/text/search/page navigation, EPUB rendering/TOC/search, two OPFS files, a service-worker-controlled offline direct-route reopen, no publication-script marker, no remote publication request, and no `/api` request. Selection, visual layout, zoom/fit/rotation appearance, and assistive-technology behavior still require human inspection because DOM assertions cannot establish their visual quality.

## Current reader limits

- PDF search is literal case-insensitive matching with a result cap; it does not yet index stemming or OCR image-only pages.
- EPUB search is section-based and may take noticeable time on large publications.
- PDF link/annotation layers, password prompts, forms, signatures, and advanced two-page layout are not implemented.
- DRM/LCP publications and EPUB scripted content are unsupported.
- Exact device/WebView support will be established with Capacitor in Phase 7; Foliate requires modern ES2022 browser primitives.
