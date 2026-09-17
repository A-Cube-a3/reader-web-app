# Offline knowledge, export, and statistics

## Local boundaries

Phase 6 adds no cloud dependency. `LibraryKnowledgeService` coordinates book, collection, annotation, and reading-activity repositories; React screens never open IndexedDB. `KnowledgeExportService` formats records in the browser and the web adapter downloads a generated `Blob`. PDF generation is lazy-loaded so its library and bundled font do not enter the normal library/reader startup path; both the lazy chunk and font are included in the PWA precache so export still works offline.

No export includes OPFS references, local paths, book binaries, MongoDB identifiers, or account data. Exporting does not call Spring Boot. The user is responsible for storing the downloaded file safely because browser site-data backup is still not implemented.

## Organization and tags

Books retain their application UUID while status changes among Want to Read, Currently Reading, Completed, and Dropped. Favorite is an independent boolean. A collection has its own UUID, name, timestamps, and a de-duplicated list of book UUIDs.

Deleting a collection leaves every book untouched. Deleting a book removes its collection membership together with its progress, annotations, activity, and structured book record in one IndexedDB transaction before retryable OPFS cleanup. Notes and highlights accept normalized lower-case tags (at most 20 tags, 40 characters each). Tags are currently filtered from the loaded annotation set; there is no full-text/indexing claim.

The knowledge workspace combines all local notes and highlights. It filters by text, book, type, and tag; supports note edits, tag edits, deletion, and source jumps. A source jump passes the application locator through transient navigation state and never serializes selected text or annotation context into the URL. Unanchored book notes correctly have no source-jump action.

## Export formats

The active knowledge filters determine the exported records.

- Markdown contains headings, book/author context, the normalized human-readable location, tags, and blockquoted highlights.
- Plain text contains the same fields without Markdown syntax.
- PDF is rendered locally with `pdf-lib` and its MIT-licensed fontkit integration, using the Liberation Sans font already distributed with PDF.js. Long text wraps and creates new pages.

Exports are knowledge exports, not complete database backups: they do not preserve record UUIDs, full machine-readable locators, collection definitions, preferences, activity sessions, or book files. Import/restore of an export is not implemented. Markdown and plain text preserve the source text most portably; unusual scripts not covered by the bundled font may fail PDF font encoding and should be exported as Markdown/text instead.

## Activity and approximation rules

A reading-tools session creates one local activity record when a book opens. Location changes update its end locator. Lifecycle flushes pause the session, and a later location event resumes it. Each elapsed interval is capped at five minutes, so leaving a tab open cannot count indefinitely. Browser termination can still lose the final unflushed interval.

The statistics screen reports:

- completed books from explicit book status;
- locally recorded reading duration;
- active local calendar days and a consecutive-day streak ending today or yesterday;
- monthly session, time, and active-day totals;
- distinct PDF pages visited within each session, summed across sessions and labeled approximate because repeat sessions can count a page again;
- EPUB location changes, labeled approximate and never presented as pages because reflow changes pagination.

These are personal activity indicators, not auditable timekeeping. Clock/time-zone changes, private-data clearing, idle capping, abrupt process termination, repeated pages, and EPUB reflow all limit precision.

## Offline validation checklist

1. Keep Spring Boot and MongoDB stopped and start the production PWA at a stable origin.
2. Import a PDF and EPUB, create a collection, add books, set statuses/favorites, and reload; confirm organization persists.
3. Create a highlight and note, open Knowledge, edit/tag/filter them, use Open source, and confirm the reader reaches the normalized locator.
4. With networking disabled, download Markdown, plain-text, and PDF exports; inspect their content and confirm no backend request occurred.
5. Read both formats across location changes, close the reader, and inspect Statistics. Confirm PDF page visits and EPUB location changes are separate and marked approximate.
6. Delete a highlight with a linked note; confirm the note remains with its source. Delete a collection; confirm its books remain. Delete a book; confirm its annotations, activity, and collection membership are gone.
7. Reopen the service-worker-controlled application offline and repeat the knowledge filters and an export.

Automated tests cover schema v3-to-v4 preservation, repositories/cascades, collection/status/tag domain behavior, knowledge mutations, export formatting/delegation, activity idle bounds, streak/month calculations, source-locator navigation, and UI interactions. Real browser downloads, the final PDF rendering/font range, and the complete destructive cleanup flow remain manual checks.

Phase 6 was also checked against the production build in a fresh headless Chromium profile. The service-worker-controlled application reloaded after Chromium networking was disabled, issued no `/api` request, rendered the local Library, Knowledge, and Statistics views, and generated a PDF export using the precached lazy exporter and font with no runtime error. A separate disposable-profile check created a collection, reloaded it successfully, and observed IndexedDB schema version 4 with all nine expected stores. A populated real-book export, broad Unicode font coverage, mobile layout, and the destructive deletion sequence remain maintainer checks.
