# Local-first reader architecture

## Purpose

The reader is an offline-capable application whose React core owns the complete reading experience. Local data is authoritative for responsiveness and availability. Spring Boot and MongoDB become an optional cloud companion; they are never on the critical path for opening a locally imported book.

This is the target architecture. Delivery is staged by `docs/roadmap.md`; the Phase 2 IndexedDB repositories, local library service, OPFS adapter, and bounded metadata services are implemented, while reader, annotation, native, sync, and online-service components remain phased work.

## Product invariants

1. A fresh installation supports the offline core without an account.
2. Every core mutation is committed locally before the UI reports success.
3. Core screens read local repositories and binary storage, not cloud API responses.
4. Previously imported books open when the network and cloud companion are unavailable.
5. Local objects use application-owned UUIDs. MongoDB IDs are never their primary identity.
6. Synchronization is asynchronous, retryable, and optional. Sync failure never rolls back a valid local action.
7. The React domain layer never receives absolute platform filesystem paths.
8. PDF/EPUB engine-specific positions do not escape engine adapters; persistent state uses application locators.
9. Imported files and EPUB markup are untrusted input. EPUB scripts are not enabled for compatibility.
10. Client configuration contains no secrets. Provider, database, token-signing, and object-storage secrets remain server-side.

## System context

```text
                         optional, when configured and online
┌──────────────────────────────┐       ┌──────────────────────────────┐
│ React reader core            │       │ Spring Boot cloud companion  │
│                              │ HTTPS │                              │
│ local repositories           │◄─────►│ accounts/authentication      │
│ local binary storage         │       │ sync and backup APIs         │
│ PDF/EPUB reader engines      │       │ AI and metadata integrations │
│ offline search and exports   │       │ administration/operations    │
└──────────────┬───────────────┘       └──────────────┬───────────────┘
               │                                      │
       ┌───────┴────────┐                  ┌──────────┴──────────┐
       │                │                  │                     │
┌──────▼──────┐  ┌──────▼───────┐   ┌──────▼──────┐   ┌────────▼───────┐
│ Web / PWA   │  │ Capacitor     │   │ MongoDB     │   │ object storage │
│ IndexedDB   │  │ Android / iOS │   │ cloud state │   │ opt-in binaries│
│ OPFS        │  │ native files  │   └─────────────┘   └────────────────┘
└─────────────┘  └──────────────┘
```

The left side is a complete product. The right side is an enhancement.

## Responsibility boundary

| Responsibility | React application | Spring Boot companion | MongoDB / object storage |
|---|---:|---:|---:|
| Import, validate, and store local books | Owns | No | No |
| Local library, reading, progress, annotations, organization, preferences | Owns | No | No |
| Offline search, statistics, and user export | Owns | No | No |
| Account and cloud session | Optional UI/client | Owns | Persists cloud account state |
| Cross-device sync | Queues local changes and applies pulls | Authenticates, validates, resolves protocol | Persists scoped records/cursors |
| Book binary backup | Explicit opt-in client operation | Authorizes/orchestrates | Object storage owns blobs; MongoDB stores metadata only |
| Online AI and enrichment | Sends bounded, explicit requests | Owns provider secrets and policies | Stores operational/accounting state if needed |
| Cloud administration/monitoring | Admin UI only | Owns | Stores cloud-side data only |

The backend cannot administer data that never left a device.

## Frontend boundaries and dependency direction

The exact directory names may evolve with working code, but dependencies must point inward toward stable domain contracts:

```text
routes / components
        │
        ▼
application services / domain use cases
        │
        ▼
repository + ReaderEngine + BookBinaryStorage interfaces
        ▲
        │
IndexedDB / OPFS / Capacitor / PDF.js / EPUB / cloud adapters
```

React components may coordinate view state and call use cases. They must not directly open IndexedDB transactions, manipulate OPFS handles, depend on Capacitor paths, or persist PDF.js/EPUB component state. Platform and engine adapters implement contracts consumed by application services.

A likely target layout is:

```text
client/src/
  app/                 application composition and boot
  components/          reusable presentation
  routes/              screen-level UI
  domain/              models, policies, locators, pure behavior
  services/            import, library, reader, export, search, sync use cases
  repositories/        interfaces and IndexedDB implementations
  storage/             database schema/migrations and binary adapters
  reader/              ReaderEngine contracts plus PDF/EPUB adapters
  platform/            web and native capability adapters
  workers/             expensive parsing/indexing work where justified
```

Directories are created only when a concrete implementation needs the boundary.

## Local data model

### Identity and timestamps

Application records use UUIDs generated locally. IDs remain stable across export, backup, and synchronization. Timestamps are stored in an unambiguous UTC representation. User-authored data keeps update/version metadata needed for migrations and later sync, without making cloud revision fields mandatory for local-only users.

### Book

The application-owned book record supports:

```text
id                   UUID
title                display title
author               structured/display author data where available
description
publisher
language
identifier           ISBN or publication identifier where available
format               pdf | epub
coverReference       opaque local binary/cache reference
binaryReference      opaque BookBinaryStorage reference
originalFilename
fileSize
importedAt
updatedAt
lastOpenedAt
readingStatus        want-to-read | currently-reading | completed | dropped
favorite
metadataSource       embedded | filename | user | enriched (with provenance)
```

User edits take precedence over later extracted or enriched metadata. A cloud API may transport an opaque binary object key but never a device absolute path.

### Normalized reading locator

Persistent progress, bookmarks, highlights, notes, navigation, and synchronization use a versioned application locator:

```js
{
  version: 1,
  format: 'pdf' | 'epub',
  progression: 0.0,       // optional normalized aid, never the only anchor
  pdf: {
    page: 1,              // one-based application convention
    pageCount: 320,
    textQuote: { exact, prefix, suffix },
    geometry: []          // normalized page geometry when an annotation needs it
  },
  epub: {
    cfi: 'epubcfi(...)',
    spineHref: 'chapter.xhtml',
    progressionInResource: 0.42
  }
}
```

Only the format-specific member matching `format` is present. Required fields vary by use case: progress needs a resumable location; a highlight also needs a quote/geometry anchor. Locator validation and migration live in the domain layer. Engine adapters translate between this model and engine internals.

## Structured storage

### IndexedDB

IndexedDB is the initial structured database on PWA and Capacitor targets. It is accessed through repositories, never directly from components. Phase 2 implements database `reader-local-library` at version 2 with `books`, `progress`, `settings`, and retryable `binary-cleanup` stores. Later phase migrations add bookmarks, highlights, notes, collections, statistics, search indexes, sync queue items, and sync metadata.

Each migration:

- has a monotonically increasing schema version;
- is idempotent within the browser upgrade transaction where possible;
- creates/indexes only the records needed by the owning phase;
- preserves existing user data or fails without partially advancing the version;
- has automated upgrade-path tests from every supported prior version;
- documents irreversible transformations and backup/export implications.

Repositories expose task-level operations rather than raw object stores. Multi-record domain changes use a shared transaction when they are in one database. Binary and structured stores cannot share a transaction, so cross-store operations use explicit compensation and recovery state.

`localStorage` may hold tiny non-authoritative boot hints only; it is not the application database.

### Binary storage contract

`BookBinaryStorage` is a platform-neutral interface currently implemented by the web adapter with these operations:

```text
write(File/Blob)                 -> opaque binaryReference
open(binaryReference)           -> readable Blob/stream/engine source
delete(binaryReference)
exists(binaryReference)
inspectCapacity()
requestPersistence()
```

Error results distinguish unsupported capability, permission/persistence denial, quota exhaustion, missing/corrupt data, invalid input, and unexpected I/O. The domain sees opaque references and typed outcomes, not paths or browser handles.

#### Web/PWA adapter

The preferred adapter copies PDF/EPUB bytes into application-managed OPFS. A transient input `File` and object URL are import/read handles only, never permanent storage. The adapter requests persistent storage where supported, checks `navigator.storage.estimate()` when useful, reports whether durability was granted, revokes temporary object URLs, and provides actionable quota/persistence warnings.

If OPFS is unavailable, Phase 2 returns a typed unsupported result; it does not pretend a transient handle is durable. Any future fallback must still be durable, adapter-backed, documented, and tested. Silently retaining only an object URL is prohibited.

#### Capacitor adapter

The native adapter copies imported data into app-private storage through Capacitor Filesystem and resolves it back into a form accepted by reader engines. Native URI/path details remain inside the adapter. The same domain service and book record are used on web and native.

### Import consistency

Import spans untrusted parsing, binary storage, and IndexedDB, so it follows a recoverable sequence:

1. Validate supported size and format using signatures/container structure.
2. Extract bounded local metadata through format-specific services.
3. Copy the book and optional cover into `BookBinaryStorage` under opaque storage IDs.
4. Generate the application book UUID and commit the record with opaque binary references.
5. On a structured-record failure, delete copied binaries or record recoverable cleanup work.

Duplicate detection may be added with content hashes, but a hash cannot replace the application UUID. Import never calls Spring Boot.

Deleting a book atomically removes its book/progress records and records binary cleanup intent in IndexedDB. OPFS deletion then clears that intent; startup retries failures after an interruption. Future dependent stores extend this transaction in their owning phase. If binary deletion fails after structured cleanup, the recoverable cleanup record is retained and the UI reports cleanup is pending.

## Reader engine architecture

The application talks to a stable `ReaderEngine` contract. A concrete API will be proven in Phase 4, but it must cover:

```text
open(source, optionalLocator, preferences)
close()
getMetadata() / getTableOfContents()
getCurrentLocator()
goTo(locator or TOC target)
next() / previous()
search(query)
setViewPreferences(formatAppropriatePreferences)
subscribe(location, selection, loading, error)
```

### PDF

`PdfReaderEngine` uses PDF.js unless the Phase 4 spike identifies a concrete blocker. It owns PDF.js worker configuration, lazy page rendering, text layers, selection mapping, search, zoom/fit/rotation, and conversion between PDF pages/geometry and normalized locators. The full document is not stored in React state and all pages are not eagerly rendered.

### EPUB

Phase 4 begins with a documented technical spike comparing viable JavaScript engines for local Blob/File input, EPUB 2/3, CFI/locations, layouts, TOC, search, selection/annotations, theming, React/Vite, mobile WebView, maintenance, license, and security. The chosen engine is contained by `EpubReaderEngine`.

EPUB resources are untrusted. Active content is isolated in a restrictive sandbox; publication JavaScript is not allowed to execute. Navigation, external resource loading, unsafe URLs, and HTML/CSS injection require explicit controls. Engine limitations are exposed as capability results rather than leaking library-specific state into UI code.

## Core application flows

### Boot and library

```text
load cached application shell
  -> open/migrate local database
  -> initialize local binary adapter
  -> render local library
  -> optionally start connectivity/session/sync services after core readiness
```

No request to Spring Boot gates library rendering. Offline is a normal connectivity state, not a boot error.

### Read and persist progress

```text
open book record -> resolve local binary -> select engine -> restore locator
reader location event -> normalize locator -> debounce -> local progress repository
urgent lifecycle/close event -> best-effort immediate local flush
optional sync enabled -> enqueue/compact sync operation independently
```

The engine never owns durable progress. The local repository write completes independently of network status.

### Online feature degradation

Online actions advertise connectivity/account requirements at their point of use. When unavailable, they produce a specific, recoverable result and leave the reader state intact. AI, enrichment, sync, and backup errors never replace a book screen with a global offline error.

## Search and export

Search indexes are generated locally from book text where format/security/performance permits and from user-owned notes/highlights. Indexing is incremental, cancellable, and suitable for a worker when parsing would block the UI. Search functionality defines whether a format/publication could not be indexed rather than claiming completeness.

Exports are assembled locally from repositories. Markdown and plain text are direct formats; PDF generation uses a bundled local library. Export includes stable source context and human-readable locations without leaking platform paths. Cloud upload is never an implicit export step.

## Optional cloud architecture

Cloud support is introduced only after native offline functionality is complete.

### Accounts and tokens

Spring Security owns registration, login, authorization, token issuance/refresh, logout/revocation, and USER/ADMIN roles. All cloud records are user-scoped. Client token storage is platform appropriate and documented; sensitive bearer tokens are not casually stored in browser `localStorage`.

### Synchronization

Every synchronizable local mutation appends or coalesces a durable queue operation in the same IndexedDB transaction as the domain change where possible. Operations carry stable record IDs, type, base server revision, mutation/tombstone, and idempotency identity. Push and pull use explicit cursors/revisions, server timestamps, bounded batches, retries, and record-specific conflict policies.

The server acknowledges revisions; it does not become the UI's read model. Pulled changes are applied transactionally to local repositories. Deletion uses tombstones so offline devices cannot resurrect records accidentally. `docs/architecture/sync-protocol.md` will become the detailed Phase 8 specification.

### Binary backup

Book metadata sync and book-byte backup are separate user choices and APIs. Backup is opt-in, resumable, integrity-checked, and stored behind an object-storage abstraction. MongoDB stores authorization/metadata, not large binary payloads in ordinary documents. The local binary remains the reader source even after backup.

### AI, enrichment, and administration

Spring Boot bounds excerpts, applies provider timeouts/retries/rate and usage limits, accounts for requests, and holds all provider credentials. Metadata enrichment retains provenance and never overwrites user-edited fields silently. Administration covers cloud users, sync/backup health, AI usage, and server operations only.

## Security model

- Validate magic bytes and bounded archive structure in addition to extensions.
- Treat PDF/EPUB parsing as potentially expensive or malformed; bound size, work, nesting, and memory where libraries permit.
- Sandbox EPUB documents and block embedded scripts, unsafe navigation, and accidental remote subresources.
- Avoid unsafe HTML sinks; sanitize any imported metadata rendered as markup.
- Use a restrictive PWA Content Security Policy compatible with vetted reader workers/frames.
- Revoke object URLs and avoid logging imported content, tokens, local paths, or sensitive annotations.
- Keep cloud DTOs separate from persistence entities and validate all API inputs.
- Enforce user scope in service/repository queries, not only controllers or UI.

## Availability and recovery expectations

| Failure | Required behavior |
|---|---|
| Network/cloud unavailable | Local library and reading continue; online actions explain the requirement. |
| Persistent storage not granted | Core still works if possible, with a durable-storage risk warning and status screen. |
| Quota exhausted | Import fails cleanly without a phantom record; existing books remain readable. |
| Local binary missing/corrupt | Book remains diagnosable; offer removal/re-import/restore if backup exists. |
| IndexedDB migration fails | Do not partially advance; show recovery/export guidance and preserve data. |
| Reader engine error | Contain it to the book/reader route; library and other books remain usable. |
| Sync conflict/failure | Preserve local state and queue; expose status without blocking reading. |
| App closes during progress write | Frequent debounced commits plus lifecycle flush limit loss; last committed locator is valid. |

## Evolution constraints

- React + Vite + JavaScript remain the shared UI/application core.
- PWA is the initial desktop distribution; Capacitor supplies Android/iOS adapters.
- Tauri and a native desktop wrapper are outside this roadmap.
- IndexedDB remains behind repositories. Native SQLite is considered only after demonstrated need and a migration/licensing review.
- Spring Boot, Java, Maven, and MongoDB remain for the optional cloud companion. Version upgrades require research, isolated commits, and validation.

The acceptance test for this architecture is simple: after installation, the complete import-to-export reading workflow succeeds with networking disabled and without ever starting Spring Boot or MongoDB.
