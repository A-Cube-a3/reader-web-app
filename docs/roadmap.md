# Reader app local-first roadmap

This is the authoritative Phase 0–11 delivery plan. The repository—not conversation history—is the source of truth for phase order and completion.

## Product destination

The React application is a complete offline reader. Without an account, network, Spring Boot, or MongoDB, a user can import and read PDF/EPUB books; resume; bookmark; highlight; take notes; search; organize; set preferences; view local statistics; and export their knowledge.

Spring Boot and MongoDB are an optional cloud companion for accounts, authentication, cross-device sync, opt-in book backup, online AI/enrichment, administration, and operations. Local state remains authoritative for application responsiveness and the local book remains readable when cloud services disappear.

The shared application targets are:

```text
React + Vite + JavaScript
├── installable Web/PWA (initial desktop target)
└── Capacitor
    ├── Android
    └── iOS
```

Tauri, a native desktop wrapper, a frontend TypeScript migration, and rewrites in Flutter/React Native/Kotlin/Swift are outside this roadmap.

## Status and sequencing

| Phase | Branch | Status | Depends on |
|---:|---|---|---|
| 0 | `phase/00-local-first-context` | Complete — PR #1, merge `98bd1e1` | Baseline `main` at `ef9087e` |
| 1 | `phase/01-baseline-stabilization` | Acceptance met; merge pending | Phase 0 PR merged |
| 2 | `phase/02-local-library` | Planned | Phase 1 PR merged |
| 3 | `phase/03-offline-pwa-library` | Planned | Phase 2 PR merged |
| 4 | `phase/04-reading-engines` | Planned | Phase 3 PR merged |
| 5 | `phase/05-reading-tools` | Planned | Phase 4 PR merged |
| 6 | `phase/06-library-knowledge` | Planned | Phase 5 PR merged |
| 7 | `phase/07-native-mobile` | Planned | Phase 6 PR merged |
| 8 | `phase/08-cloud-sync` | Planned | Phase 7 PR merged |
| 9 | `phase/09-online-services` | Planned | Phase 8 PR merged |
| 10 | `phase/10-hardening` | Planned | Phase 9 PR merged |
| 11 | `phase/11-production-readiness` | Planned | Phase 10 PR merged |

`Acceptance met; merge pending` is not completion. A phase becomes complete only when its acceptance criteria are met and its PR is merged into `main`; the merged PR and merge commit are the authoritative completion evidence. Before starting any next phase, fetch remote state, verify the previous PR merge and merge commit, update local `main`, confirm the merge is contained, and confirm a clean working tree.

## Cross-phase delivery rules

- Use exactly one phase branch and PR at a time, based on the newly merged `main`; do not stack unmerged phase branches.
- Do not merge or enable auto-merge. After PR handoff, stop until the maintainer confirms and Git proves the PR is merged.
- Make multiple coherent commits where scope naturally permits. Avoid both giant mixed commits and artificial one-line splits.
- Every behavior change includes tests in the same PR. Phase 10 expands/audits quality; it is not the first testing phase.
- Update affected documentation and this roadmap in the phase that changes behavior or plan.
- Preserve useful legacy behavior while replacements are proven, then remove/repurpose it deliberately.
- Keep the local/cloud feature boundary structural: core components/use cases depend on local repositories and platform abstractions, never cloud availability.
- Treat files/publication content as untrusted and never place secrets in the client.
- Finish every phase by running relevant validation, reviewing the diff, scanning for secrets/artifacts, ensuring docs are current and the worktree is clean, pushing, opening a PR to `main`, reporting the handoff, and stopping.

## Phase 0 — Repository analysis and pivot context

**Branch:** `phase/00-local-first-context`

**Purpose:** Establish an evidence-based baseline, accept the local-first direction, and make the repository a durable source of truth before product implementation.

### Required work

- Inspect every tracked source/configuration/documentation file, reachable Git history, current branches/PR refs, endpoints, model, storage, MongoDB/security configuration, frontend structure/routing, dependencies, tests, CI, and build behavior.
- Identify stale documentation, obsolete scaffolding, security/configuration risks, and historical generated/user artifacts.
- Add:
  - `docs/architecture/repository-baseline.md`
  - `docs/architecture/local-first-architecture.md`
  - `docs/architecture/adr-001-local-first-reader.md`
  - this authoritative roadmap
- Add concise root `AGENTS.md` continuity instructions without duplicating the roadmap.
- Make no major product implementation or opportunistic baseline fixes.

### Acceptance criteria

- Baseline claims name the inspected commit/date and match current code/history.
- Old and target architectures, React/Spring/Mongo responsibilities, offline/online boundary, storage, reader abstraction, identity/locator direction, migration risks, and phased plan are explicit.
- Every Phase 0–11 entry has purpose, required scope, branch, dependencies, and acceptance criteria.
- `AGENTS.md` requires repository-state reconstruction, one merged phase at a time, phase branches/PRs, validation, no merge, and stop-after-handoff.
- Existing frontend lint/build and backend compile/test baseline are recorded with actual outcomes and limitations.
- Only documentation/continuity files are included; worktree is clean after coherent commits.

## Phase 1 — Stabilize the existing baseline

**Branch:** `phase/01-baseline-stabilization`

**Purpose:** Make the small prototype reproducible, testable, and safe enough to evolve without redesigning its legacy upload flow.

**Depends on:** Phase 0 merged and present in updated `main`.

### Required work

- Correct root/client setup documentation and repository paths; choose/document one package-manager workflow from the committed lockfile.
- Make the Maven wrapper executable/reproducible and define/enforce the supported Java toolchain. Research current framework support before upgrades; isolate any necessary upgrade in its own commit.
- Replace manual `java-dotenv` loading with Spring Boot externalized configuration and `@ConfigurationProperties` where useful.
- Commit safe defaults/templates only; provide `.env.example` names/placeholders, keep real env files ignored, and document local/test/production configuration.
- Document each environment variable with phase introduced and classification: public config, private config, or secret.
- Remove hard-coded frontend API URL in favor of validated `VITE_API_BASE_URL`; document that all `VITE_*` data is public and reject prohibited secret-like client configuration where practical.
- Ensure production fails clearly when mandatory Mongo/JWT/AI/storage secrets (as introduced) are absent; never provide insecure production secret fallbacks.
- Resolve duplicate/unreferenced frontend bootstrap and template artifacts.
- Add useful UI/API error handling, DTO/response hygiene for the existing API, and remove internal absolute paths/error details from public responses.
- Address confirmed build/lint/dependency inconsistencies and localhost assumptions without prematurely rewriting the upload flow.
- Establish frontend and backend test harnesses with meaningful smoke/unit/controller coverage.
- Add initial CI or reproducible local check commands if needed to keep the baseline stable; comprehensive CI remains Phase 11.

### Acceptance criteria

- A documented clean checkout setup uses safe configuration and starts/builds consistently on the supported Java/Node/package-manager versions.
- No code manually copies `.env` values into system properties; no committed credential or client secret exists.
- Frontend URL/CORS configuration is environment-driven with safe development defaults and explicit production behavior.
- Existing upload/list/get behavior has useful tests and API errors do not expose filesystem paths or raw internal exception details.
- Frontend lint/test/build and backend test/package commands pass with actual test counts reported.
- Documentation matches the stabilized code and names the legacy upload path as temporary.

## Phase 2 — Local library and storage foundation

**Branch:** `phase/02-local-library`

**Purpose:** Perform the fundamental product pivot: import, persist, and manage books locally without calling Spring Boot.

**Depends on:** Phase 1 merged; stable frontend tests/configuration; legacy upload remains available only as a migration fallback.

### Required work

- Introduce concrete domain/service/repository/storage boundaries, without decorative abstractions.
- Create a versioned IndexedDB schema, transaction/migration runner, and repositories for books, reading progress, and settings.
- Use application-owned UUIDs and a local book model supporting title, author, description, publisher, language, identifier/ISBN, format, cover/binary references, original filename, size/timestamps, reading status, favorite, and metadata provenance where available.
- Define `BookBinaryStorage` and implement web OPFS import/open/delete/exists plus typed unsupported, persistence, quota, exhaustion, missing/corrupt, and I/O outcomes.
- Request/inspect persistent storage and quota where supported. Never retain only a temporary object URL.
- Replace the primary Add/Import Book flow with local PDF/EPUB import; it must not call Spring Boot.
- Validate signatures/container structure beyond extension where practical, bound file/archive work, and handle malicious/malformed inputs safely.
- Extract local PDF metadata/page count and EPUB publication metadata/cover/TOC data where useful; fall back to filename-derived metadata without failing import.
- Support local list, details, appropriate metadata edits/rename, and deletion.
- Define/document cascade behavior: book deletion removes its binary and dependent progress/records, with compensation/recovery for cross-store partial failure.
- Add fresh-schema and upgrade/migration tests plus import/read/delete/quota/error integration tests.
- Document storage durability, browser support/fallbacks, quota behavior, backup limitations, and legacy upload migration.

### Acceptance criteria

- With Spring Boot and MongoDB stopped, a user imports valid PDF and EPUB files, sees them after reload, edits display metadata, and deletes them.
- IndexedDB contains versioned structured records; OPFS/application-managed storage contains copied binaries; no component persists through browser APIs directly.
- IDs are UUIDs and records expose only opaque binary references.
- Invalid/unsupported/quota-exhausted imports do not leave phantom records or unexplained orphans.
- Automated tests cover schema creation/upgrades and binary/record cleanup.
- `POST /api/books/upload` is no longer the UI's normal import path and its temporary legacy status is documented.

## Phase 3 — Installable offline PWA and library UX

**Branch:** `phase/03-offline-pwa-library`

**Purpose:** Turn the local library into an installable, offline application that feels like a reader rather than an upload demo.

**Depends on:** Phase 2 merged; durable local imports and repository APIs proven.

### Required work

- Add a web manifest, app metadata/icons/placeholders, service worker, application-shell precache, offline navigation fallback, and explicit update/version UX.
- Bundle all critical runtime assets; no core dependency on external CDNs or remote fonts/resources.
- Ensure application boot opens/migrates local data and renders the library before optional network/cloud initialization.
- Add persistent-storage request/status UX, quota/durability warnings, and recoverable storage errors.
- Build My Library, Continue Reading, Recent Books, Import Book, book cards/details, local metadata search, format filters, empty/loading/error states, and useful connectivity indication.
- Add accessible keyboard/focus behavior and responsive app layout.
- Add PWA/service-worker tests and an automated or reproducible offline-reopen scenario.
- Document install support, cache/update semantics, offline behavior, storage clearing risks, and troubleshooting.

### Acceptance criteria

- The built app is installable on supported browsers and launches to the local library without backend contact.
- After one book is imported, disabling networking and reopening the installed/built app retains the shell, library record, and local binary availability.
- Offline is not presented as a global error; only online-only controls (if any) are marked unavailable.
- App updates have a clear, tested activation/reload path without silently losing local data.
- Local search/filter and core library screens work offline with accessible empty/error states.

## Phase 4 — PDF and EPUB reading engines

**Branch:** `phase/04-reading-engines`

**Purpose:** Deliver real local PDF/EPUB reading behind stable engine and locator contracts.

**Depends on:** Phase 3 merged; offline binary access, local library routes, and PWA worker strategy available.

### Required work

- Define a versioned normalized reading locator with PDF page/count/progression/quote/geometry concepts and EPUB CFI/spine/progression concepts.
- Define `ReaderEngine` lifecycle, capability, navigation, location, TOC, search, selection, preference, loading/error, and cleanup contracts.
- Add engine registry/factory based on book format and local binary sources.
- Implement `PdfReaderEngine` with PDF.js: worker configuration, lazy page rendering, text layer/selection, page navigation/jump, zoom, fit width/page, document search, and reasonable rotation.
- Do not eagerly load/render all pages into React state.
- Before choosing EPUB code, perform and document a technical spike comparing currently viable engines for local Blob/File, EPUB 2/3, CFI/locations, pagination/scrolling, TOC, search, selection/highlights, theming, React/Vite, mobile WebView, maintenance, licensing, and security.
- Record the EPUB choice in a new ADR and implement it behind `EpubReaderEngine` with reflow, chapter/TOC navigation, pagination, optional robust scroll mode, CFI reporting, selection, and search.
- Sandbox EPUB content, block publication scripts and accidental external loads, and treat its HTML/CSS/URLs as untrusted.
- Build responsive reader routes and controls: open local source, resume supplied locator, current position/progression, next/previous, jump, keyboard navigation, loading/error/unsupported states.
- Reader components report normalized locations but do not own persistent progress.
- Test locator validation/translation, engine lifecycle/cleanup, navigation, large-book lazy behavior where feasible, and malicious EPUB safety assumptions.

### Acceptance criteria

- Locally stored PDFs and EPUBs open and remain readable offline; engines receive data through binary-storage APIs.
- Both engines resume a supplied application locator and emit normalized application locators.
- PDF page/text/search/zoom/fit and EPUB reflow/TOC/CFI/search/selection functions work within documented engine limits.
- Large documents are handled lazily without all pages/chapters in React state.
- EPUB scripts cannot execute and remote content does not load silently.
- Architecture and EPUB decision documentation matches implemented interfaces and dependencies.

## Phase 5 — Reading state, bookmarks, highlights, and notes

**Branch:** `phase/05-reading-tools`

**Purpose:** Add the offline reading tools that turn engines into a durable personal reader.

**Depends on:** Phase 4 merged; normalized locators and selection/capability events stable.

### Required work

- Persist automatic progress locally with debounced regular writes and lifecycle/close flush; update last-opened time and honest progression.
- Resume safely from the last committed locator after normal close and abrupt termination where platform support permits.
- Add repository/domain/UI flows to create, list, jump to, and delete bookmarks.
- Add text highlights where engine capabilities allow, using quote/context plus PDF normalized geometry or EPUB CFI—not raw DOM coordinates alone.
- Add notes attached to highlights, reading locations, and books with create/edit/delete flows.
- Persist format-appropriate preferences. EPUB: font size/family, line spacing, content width, theme, reading flow as supported. PDF: zoom, fit/layout, rotation as appropriate, and surrounding reader theme.
- Do not claim EPUB typography changes alter ordinary PDF page content.
- Support within-book search plus search across local notes and highlights.
- Define behavior for stale/unresolved anchors and changed/missing binaries.
- Add repository, locator round-trip/restore, debounce/flush, annotation anchoring, notes, search, and preference tests.
- Document data models, anchor robustness/limitations, autosave semantics, and accessibility/keyboard controls.

### Acceptance criteria

- Progress, bookmark, highlight, note, and preference workflows complete with networking disabled and survive reload/relaunch.
- Continue Reading opens the last committed normalized locator; progress is not stored as percentage alone.
- Annotations jump back to a resolvable source location, or show an honest recoverable unresolved state.
- Preferences are scoped correctly by format and restored locally.
- Search operates locally over supported book text and user annotations with documented indexing limits.
- Automated tests cover persistence/restoration and abrupt-close-safe behavior that can be simulated.

## Phase 6 — Knowledge system and library management

**Branch:** `phase/06-library-knowledge`

**Purpose:** Complete offline organization, knowledge review, export, and useful local activity insights.

**Depends on:** Phase 5 merged; book/annotation repositories and normalized source jumps available.

### Required work

- Add collection repositories and create/rename/delete/add-book/remove-book flows with clear behavior when a collection or book is deleted.
- Add Want to Read, Currently Reading, Completed, and Dropped statuses plus favorites.
- Build all-notes and all-highlights workspaces with book/tag/category filters where justified, edit/delete, and jump-to-source.
- Add local Markdown, plain text, and PDF export of user-owned notes/highlights; include useful source context without paths or backend requirements.
- Track local books completed, reading time, pages/locations read, streak, and monthly activity.
- Define activity sessions and avoid false equivalence/precision between PDF pages and EPUB locations.
- Add migration/repository/UI/export/statistics tests and offline integration coverage.
- Document export schema/format, local-only backup considerations, statistic approximations, and deletion effects.

### Acceptance criteria

- Collections, status, favorites, knowledge filtering/editing/deletion/source-jump work entirely offline and survive relaunch.
- Markdown, text, and PDF exports are produced locally with correct user data and no API traffic.
- Statistics are derived from recorded local activity, are reproducible in tests, and label estimates appropriately.
- Book/collection/annotation deletion preserves referential consistency or documented recoverable state.
- The local-only product now supports import through knowledge export without an account.

## Phase 7 — Capacitor and native mobile

**Branch:** `phase/07-native-mobile`

**Purpose:** Package the same React reader for Android/iOS and implement native persistence/lifecycle behavior without duplicating the application.

**Depends on:** Phase 6 merged; complete offline React core and stable platform interfaces.

### Required work

- Add Capacitor configuration and generated Android/iOS platform projects appropriate for source control; do not commit signing secrets or machine-local output.
- Implement the native `BookBinaryStorage` with Capacitor Filesystem while preserving the domain contract and opaque references.
- Adapt file picker/import, share/open/export, safe areas, application lifecycle/progress flush, Android back behavior, and offline/connectivity capabilities.
- Verify binary persistence and reopening after process/app restart on both platforms.
- Keep structured storage behind existing repository APIs and IndexedDB initially.
- Investigate document intents/Open with Reader as a separate integration; implement only if clean and maintainable, otherwise document a concrete follow-up.
- Introduce native SQLite only on demonstrated evidence, after maintained-plugin compatibility, migration, licensing/compliance, backup, and rollback design are documented and approved.
- Add adapter/lifecycle tests plus reproducible Android/iOS manual validation matrices.
- Document prerequisites, generated-code policy, development/build/run steps, permissions, signing boundaries, and platform limitations.

### Acceptance criteria

- One React codebase builds for web, Android, and iOS; no parallel native UI/domain implementation exists.
- Android/iOS can import PDF/EPUB, read offline, persist/reopen files after app restart, and restore structured reading state.
- React/domain code never handles Capacitor absolute paths.
- Android back, safe area, app pause/resume, and relevant share/open flows behave as documented.
- Build instructions are reproducible without committed signing material; actual device/simulator results are reported honestly.

## Phase 8 — Optional accounts, JWT, and cloud sync

**Branch:** `phase/08-cloud-sync`

**Purpose:** Add opt-in cloud identity, secure multi-device synchronization, and explicit book backup while preserving the local-only product unchanged.

**Depends on:** Phase 7 merged; stable web/native local records, UUIDs, repositories, locators, and platform security capabilities.

### Required work

- Add optional registration, login, logout, account profile, and account deletion/state flows.
- Use Spring Security with USER/ADMIN roles, secure access-token and refresh-token lifecycles, rotation/reuse/revocation/logout policy, and platform-appropriate client storage. Do not casually use browser `localStorage` for bearer tokens.
- Use validated DTOs and enforce ownership in backend service/repository access for every user-scoped resource.
- Define synchronizable schemas for book metadata, progress, bookmarks, highlights, notes, collections, status, favorites, and useful preferences.
- Add a durable local sync queue and metadata/checkpoint stores. Local mutations stay immediate and enqueue in the same local transaction where possible.
- Implement bounded push/pull with UUIDs, idempotency keys, base/server revisions, tombstones, server timestamps, cursors/checkpoints, retries/backoff, resume, and multi-device safety.
- Specify/implement explicit conflict policy for each record type; prohibit blind last-request-wins overwrites.
- Add sync status and conflict recovery UX that never blocks local reading.
- Separate metadata sync from opt-in binary backup. Add object-storage abstraction, provider-configurable production implementation, local development option, resumable/integrity-checked authorization, and Mongo metadata—not ordinary Mongo blob storage.
- Keep local binary opening independent of backup availability.
- Create `docs/architecture/sync-protocol.md` detailed enough to reproduce/debug wire operations and conflicts.
- Add authentication/authorization/IDOR, token lifecycle, idempotency, cursor, retry, conflict, tombstone, offline-edit/reconnect, two-device, and backup-isolation tests.

### Acceptance criteria

- A user who never creates an account observes no regression or cloud requirement.
- Authenticated records and backups cannot be read/mutated across users; automated isolation tests cover every resource class.
- Offline mutations queue, survive restart, retry safely, sync on reconnect, and do not duplicate or silently overwrite conflicts.
- A second device can pull scoped state using checkpoints/revisions; deletions do not resurrect.
- Disabling/removing the backend after sync leaves all local books and reading tools usable.
- Binary backup is explicit, separate, provider-backed, and not stored in ordinary Mongo documents.

## Phase 9 — Online AI, enrichment, and cloud administration

**Branch:** `phase/09-online-services`

**Purpose:** Add clearly optional, bounded online enhancements and cloud-only operations.

**Depends on:** Phase 8 merged; authenticated cloud security, usage scoping, configuration, and sync/operations foundation.

### Required work

- Define backend `AIService` and provider adapters. Keep all provider secrets/prompts/policy enforcement server-side.
- Support summaries for selected text, bounded PDF page selections where feasible, and EPUB chapters, with selectable length.
- Support selected word/phrase definitions, contextual meaning, passage explanation, and simplified explanation.
- Send the smallest sufficient excerpt; never upload an entire book unnecessarily.
- Implement input/output bounds, timeouts, bounded exponential retries where appropriate, provider-error mapping, rate/usage limits, accounting, provider swapping, prompt templates, and startup configuration validation.
- Make AI connectivity/account requirements and failures local to the action; core reading remains unaffected.
- Add optional cover/author/ISBN enrichment with source provenance, review/merge UX, and protection for user-edited metadata.
- Build cloud administration for users/account state, AI usage, sync health, backup health, server health, and operational analytics with ADMIN authorization.
- Do not imply admins can access device-only books/data.
- Add provider contract/failure/bounds/rate tests, enrichment merge tests, admin authorization tests, and UI graceful-degradation tests.
- Document AI providers/configuration/data sharing/retention, enrichment provenance, admin scope, usage policies, and online-only boundaries.

### Acceptance criteria

- AI and enrichment actions require explicit user initiation, send bounded content, use no frontend secrets, and fail without disrupting reading.
- Providers can be changed through backend configuration behind one service contract.
- Rate/usage/accounting limits and error/retry behavior are enforced and tested.
- User-edited metadata is never overwritten silently.
- USER cannot access admin endpoints/screens; ADMIN visibility is limited to cloud-side resources and operations.

## Phase 10 — Security, performance, and comprehensive quality audit

**Branch:** `phase/10-hardening`

**Purpose:** Conduct a focused end-to-end audit and close demonstrated security, performance, reliability, and coverage gaps accumulated across the complete feature set.

**Depends on:** Phase 9 merged; all product surfaces exist and have phase-level tests.

### Required work

- Audit EPUB frame/content sandboxing, XSS/unsafe HTML/URLs, CSP, filenames, object URLs, file signatures/archive bombs, dependency vulnerabilities, and unintended external resource loading. Never enable publication scripts.
- Audit JWT/token lifecycle, authentication/authorization, IDOR/user isolation, validation, CORS/CSRF as applicable, rate limits, error exposure, upload/object-storage/path traversal/MIME/size controls, and AI abuse boundaries.
- Add threat model and targeted regression tests for confirmed risks.
- Profile frontend routes/readers/import/index/search and optimize evidenced bottlenecks: route/engine lazy loading, PDF worker, EPUB lazy behavior, workers, IndexedDB batching/indexes, debounced writes, virtual rendering, rerender control, and useful loading states.
- Review backend pagination, Mongo indexes/queries, bounded asynchronous work, and safe caching. Do not cache private data across users.
- Expand backend unit/service/controller/auth/authorization/sync/conflict tests and frontend repository/storage/component/integration/reader/import/delete/annotation tests.
- Add critical end-to-end flows:
  - `import -> open -> read -> close -> offline reopen -> resume`
  - `offline edit -> reconnect -> sync -> second device pull`
- Test offline behavior explicitly across supported PWA/native targets where environments permit; document anything not executable.
- Run dependency/security tools and address or document findings without claiming scans that did not run.
- Update security, performance, testing, and limitation documentation with measured evidence.

### Acceptance criteria

- No arbitrary EPUB script execution or silent imported external-resource loading is possible in supported readers.
- Automated tests demonstrate cloud user isolation, bounded uploads/AI, safe token lifecycle, sync conflict/tombstone behavior, and core offline reopen/resume.
- Measured high-impact regressions have fixes or documented, prioritized risk acceptance; optimization claims include before/after evidence.
- Frontend/backend dependency and static/dynamic security checks run with results recorded; critical unresolved findings block completion.
- The comprehensive test suite passes on the supported toolchains, with environmental gaps/flake risks disclosed.

## Phase 11 — Production readiness, CI, and final documentation

**Branch:** `phase/11-production-readiness`

**Purpose:** Make the repository ready for sustained release work, establish operational delivery, and audit the final local-first promise.

**Depends on:** Phase 10 merged; security/performance/test findings resolved or explicitly accepted.

### Required work

- Add GitHub Actions for frontend lint/test/production build, backend tests/package, and useful dependency/security checks with caching/artifact policies that do not leak secrets.
- Document native build validation separately where signing infrastructure is unavailable; never invent successful native CI.
- Provide clear local/test/production profiles and a complete environment-variable/security classification catalog. Commit no real credentials.
- Add/document backend health, readiness, useful metrics, structured logging, production error handling, backup/restore, retention, and incident considerations.
- Consolidate accurate authoritative docs under sensible architecture/setup/development/testing/offline/sync/security/deployment/native/release topics; remove or redirect stale duplication.
- At minimum cover architecture/local-first principles, storage/data models/migrations, PWA/offline, reader engines/EPUB security, native setup, optional backend/auth/sync/backup, AI, testing, deployment, release, and backup/restore.
- If OpenAPI is added, generate/verify it against actual endpoints.
- Run a final acceptance audit on supported platforms with network disabled and no account/backend; separately validate optional cloud boundaries.
- Produce a final status report of completed capabilities, validation evidence, supported platforms, known limitations, deferred work, and production risks.

### Acceptance criteria

- Required CI checks execute on PRs and `main`, and recorded green results correspond to the committed revision.
- Production configuration fails clearly for missing mandatory secrets and has no insecure fallback/client leakage.
- Operations provide meaningful liveness/readiness and documented observability/error behavior.
- Documentation matches actual commands, endpoints, storage/sync behavior, and platform support with no known stale prototype instructions.
- The final offline scenario passes: install/launch, import PDF/EPUB, read, close/reopen/resume, annotate/note, organize, search, and export without an account, network, Spring Boot, or MongoDB.
- Optional sign-in/sync/backup/AI can become unavailable again without breaking the local reader.
- Final report distinguishes verified capabilities from limitations and future work.

## Legacy backend upload migration checkpoint

`POST /api/books/upload` is the current prototype import architecture. Phase 1 may stabilize it but must label it legacy. Phase 2 makes local import the only normal UI flow and records the endpoint's deprecation. Phase 8 either removes it or replaces it with deliberately named, authenticated, user-scoped, opt-in object-storage backup semantics. It must not survive silently as a second import authority.

## PR handoff checklist

Every phase PR body and handoff report includes:

1. **Scope** — what the phase changes.
2. **Architectural impact** — boundaries/models introduced or changed.
3. **Commits** — ordered commit list and purpose.
4. **Validation** — exact commands and actual results/test counts.
5. **Manual validation** — checks the maintainer should perform.
6. **Data/config migrations** — IndexedDB, backend, environment, native, or none.
7. **Documentation** — files added/updated/retired.
8. **Risks / limitations** — known issues and intentional deferrals.
9. **Next phase** — name only; do not begin it until this PR is merged and verified.

The author then stops. Review changes stay on the same phase branch/PR, use additional coherent commits, re-run validation, push, and hand back control again.
