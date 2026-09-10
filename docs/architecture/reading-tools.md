# Offline reading tools

## Local-first boundary

Phase 5 persists reading activity through local application services only:

```text
ReaderRoute
  -> ReaderService
      -> ReaderToolsService / ReaderToolsSession
          -> books, progress, bookmark, highlight, note repositories
          -> per-format preferences repository
      -> PdfReaderEngine / EpubReaderEngine
```

The UI never opens IndexedDB, and no service in this path calls Spring Boot. `ReaderService` loads committed local progress and preferences before opening an engine, then starts a tools session that owns persistence. A session closes by flushing progress before closing the engine.

## Progress and resume

Every engine location event contains the full versioned application locator. `DebouncedProgressWriter` keeps the latest valid locator and writes after 750 ms of inactivity. Writes are serialized so a slower older write cannot overtake a newer one. Each progress record contains the locator, its honest engine-reported progression when available, and timestamps; percentage is only a display derivative.

The web lifecycle adapter requests an immediate flush on `pagehide`, document freeze, and transition to a hidden document. Explicit reader close also flushes. Browser termination can always occur before asynchronous storage completes, so the most recently committed location—not an uncommitted UI value—is the recovery guarantee.

Opening a book updates `lastOpenedAt` locally. Returning from the reader reloads the local library view, which makes the committed record available to Continue Reading. Structurally invalid saved locators are ignored with a warning. If a structurally valid PDF page or EPUB CFI no longer exists in a replaced publication copy, the corresponding engine opens at the beginning and exposes an honest recovery warning.

## Annotation records and anchors

Bookmarks, highlights, and notes use application-owned UUIDs and timestamps. They are book-scoped and stored separately from renderer objects.

- A bookmark contains a user/fallback label and normalized locator.
- A highlight contains its normalized locator, exact quote plus nearby context, and bounded color.
- A PDF highlight anchor may additionally contain normalized page rectangles and the capture rotation. Rectangles are relative values, not raw viewport pixels or DOM node references; rendering transforms them for later page rotation.
- An EPUB highlight uses a content-document CFI plus spine reference/index and quote context. Foliate CFIs never become the identity of the local record.
- A note can be book-level, carry a reading locator, or reference a highlight. Note text is locally editable and preserves line breaks.

Deleting a highlight keeps linked notes: each is detached from the highlight and retains the highlight locator. Deleting a book removes progress and all three annotation record types in the same IndexedDB transaction that queues binary cleanup.

An annotation jump revalidates the application locator. If the engine cannot resolve it, the record is preserved and the UI reports that its source cannot be resolved. EPUB highlight rendering similarly skips stale CFIs without blocking the book or other annotations and reports how many could not be placed.

## Reader preferences

Preferences use `reader.preferences.pdf` and `reader.preferences.epub` settings keys. Engines normalize bounds before the repository stores the returned value.

EPUB preferences include font size, serif/sans-serif family, line spacing, content width, paper/sepia/night theme, and paginated/scrolled flow. PDF preferences include fit width/page, bounded custom zoom, quarter-turn rotation, and light/sepia/dark reader surround. PDF typography is not presented as editable because ordinary PDF page text is fixed by the document.

## Search and user interface

Reader search runs the engine's bounded local book-text search and an in-memory scan of the current book's loaded note/highlight records. Results are labeled by source and jump through normalized locators. Search is literal and case-insensitive; it does not provide stemming, OCR for image-only PDFs, or a persistent full-text index. Phase 6 adds cross-book knowledge views; Phase 10 may introduce measured worker/index improvements.

The reader header exposes Contents, Search, Reading tools, Preferences, and one-action bookmarking. The reading-tools panel lists source jumps and deletion controls, supports book/location notes and note editing, and keeps failures scoped to the reader. Selecting engine text opens keyboard-focusable controls for a color highlight or a highlight-linked note. Arrow keys, Page Up/Down, Space, and the existing buttons remain available when focus is outside form controls.

## Manual offline validation

Use a production build at a stable origin. Keep Spring Boot and MongoDB stopped.

1. Import a multi-page text PDF and a reflowable EPUB, then open each once.
2. Navigate away from the first location, wait one second, return to the library, and reopen. Confirm the committed page/CFI resumes.
3. Navigate again and immediately use **Library**. Reopen and confirm the explicit close flush saved the new location.
4. Add multiple then list/jump/delete bookmarks. Reload between steps to prove persistence.
5. Select text, create every supported highlight color, reload, and confirm placement. Rotate a PDF after highlighting and confirm its normalized geometry follows the page.
6. Add a book note, a current-location note, and a highlight-linked note. Edit, jump, and delete them. Delete a linked highlight and confirm its note remains location-linked.
7. Search a phrase in the publication, a note, and a highlight. Confirm result source labels and source jumps.
8. Change EPUB typography/theme/flow and PDF fit/zoom/rotation/surround independently. Reload both formats and confirm their settings do not leak across formats.
9. Disable networking, close/reopen the installed PWA at the reader URL, and repeat bookmark/note/search/preference changes. Confirm no `/api` request appears.
10. In DevTools, inspect IndexedDB schema version 3 and confirm progress, bookmark, highlight, note, and settings records. Delete the book and confirm its dependent records are gone.

Phase 5 was smoke-tested against the production build in a clean headless Chromium profile using a real text PDF. With the backend absent, the run imported and rendered the PDF, created a bookmark, generated a real text-layer selection and highlight, stored a note, returned through the library, reopened the book, and observed schema version 3 with progress plus one record in each annotation store. Chromium networking was then disabled and the direct reader route reloaded while service-worker-controlled; the title, reader tools, and PDF page still rendered. EPUB visual annotation placement, every preference control, mobile layout, and the destructive book-deletion check remain explicit maintainer checks.

Visual selection geometry, theme contrast, mobile layout, keyboard focus order, and assistive-technology announcements require human inspection. Automated jsdom tests validate the service/repository semantics but cannot prove rendered publication geometry or browser shutdown timing.

## Known limits

- Search is per-open-book and not a cross-library index; Phase 6 owns the knowledge workspace.
- Image-only/scanned PDFs need OCR that is not currently provided.
- PDF highlights without measurable selection rectangles retain quote/location anchors but cannot be painted reliably.
- Publication changes can invalidate CFIs or page anchors; records are preserved and surfaced as unresolved rather than guessed onto unrelated text.
- Advanced PDF annotation/link layers, two-page layout, EPUB DRM/LCP, and scripted EPUB content remain unsupported.
- Storage/site-data deletion can remove reading records; user export and optional backup arrive in later phases.
