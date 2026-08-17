# ADR-001: Make the React reader local-first

- **Status:** Accepted
- **Date:** 2026-08-17
- **Decision owners:** Reader app maintainers
- **Related:** `repository-baseline.md`, `local-first-architecture.md`, `../roadmap.md`

## Context

The current prototype uploads a selected PDF or EPUB over HTTP to Spring Boot. The backend writes the file to its filesystem, saves a MongoDB record, and returns that record to a React component. The client has no durable library or reader. Consequently, an account-less user cannot import, list, open, or retain a book without the network, backend, MongoDB, and backend storage all being available.

The intended product is an installed-feeling reader whose essential value is private, device-local, and available offline. Cloud features remain desirable for users who opt into accounts, synchronization, backup, enrichment, and AI, but adding those concerns to the critical reading path would reduce availability and make local-only use impossible.

The same React application must serve the installable web/PWA target and Capacitor Android/iOS targets. JavaScript, React, Vite, Spring Boot, Maven, Java, and MongoDB remain the chosen technology direction.

## Decision

Make the React application the authoritative owner of all core reading data and behavior.

1. Store structured core state in a versioned IndexedDB database accessed through repositories.
2. Store copied book binaries through a platform-neutral `BookBinaryStorage`: OPFS on capable web/PWA platforms and Capacitor Filesystem on native platforms.
3. Assign application UUIDs to books and all locally created records. Cloud persistence identifiers are implementation details.
4. Put PDF and EPUB libraries behind `ReaderEngine` adapters and persist versioned application locators rather than engine/component state or percentage alone.
5. Commit import, progress, annotation, organization, preference, statistics, search, and export actions locally before presenting success.
6. Boot and render the local library without contacting Spring Boot.
7. Reframe Spring Boot and MongoDB as an optional cloud companion for accounts, authorization, synchronization, opt-in binary backup coordination, online AI/enrichment, administration, and operations.
8. When cloud support is enabled, feed it through an asynchronous durable sync queue with revisions, idempotency, tombstones, cursors, and explicit conflict policies. Local repositories remain the UI read model.
9. Treat imported publications as untrusted. In particular, do not execute EPUB-provided JavaScript to make a publication render.

The current `POST /api/books/upload` remains a temporary legacy path during stabilization. Phase 2 removes it from the primary Import Book flow. A later cloud phase will deliberately deprecate/remove it or redefine a separately named endpoint as explicit opt-in backup; two competing import models will not remain.

## Decision drivers

- Reading must remain available without a network or account.
- User actions require immediate feedback and must survive transient cloud failure.
- User-owned reading and knowledge data should remain private unless explicitly synchronized/exported.
- One React core should support PWA and Capacitor without leaking platform paths into domain code.
- Reader engines and browser/native persistence will evolve and therefore need narrow replaceable adapters.
- Cloud conflict handling is easier when records already have stable client-owned identities and versioned semantics.

## Alternatives considered

### Keep the backend-authoritative prototype

Rejected. It preserves a simple CRUD architecture but makes the network, Spring Boot, MongoDB, and server-side book copy mandatory. Offline reopening and account-less local privacy cannot be guaranteed.

### Add a service-worker response cache in front of the existing API

Rejected as the primary architecture. HTTP caching can improve repeat access, but it is not a transactional local library, annotation database, migration system, durable import store, or conflict-aware mutation model. Cached API responses would also preserve MongoDB identity and backend availability assumptions.

### Store everything as IndexedDB blobs

Not selected as the preferred design. It would reduce the number of adapters but mixes large binaries with structured records and gives up OPFS/native filesystem strengths. IndexedDB remains a possible documented fallback behind `BookBinaryStorage` where OPFS is unavailable; domain code will not care.

### Make Spring Boot optional but call it first when online

Rejected. A network-first fast path creates two behavioral authorities and makes latency/outage semantics visible throughout the UI. Cloud work is explicitly downstream of a successful local mutation.

### Rewrite as Flutter, React Native, or platform-native apps

Rejected. It duplicates or replaces the existing React direction and conflicts with the shared-core requirement. Capacitor provides native packaging and platform adapters while keeping one application.

### Add Tauri or another desktop shell now

Rejected for this roadmap. An installable PWA covers the initial desktop target. A wrapper can be evaluated in a separate future project if concrete desktop capabilities require one.

### Adopt native SQLite immediately under Capacitor

Deferred. IndexedDB plus repository abstraction avoids an unnecessary cross-platform migration. SQLite remains an option only after a demonstrated requirement, maintained-plugin review, migration design, and licensing/compliance assessment.

## Consequences

### Positive

- Core reading availability is independent of cloud uptime and account state.
- Local UI reads and writes are fast and predictable.
- Imported books and private notes stay on-device by default.
- PWA and native targets share domain/services/UI while swapping narrow platform adapters.
- UUIDs, normalized locators, repositories, and a durable queue create a sound basis for later sync.
- Cloud features can fail or be disabled without degrading the reader.

### Costs and risks

- IndexedDB schema migrations, quota behavior, and cross-store recovery require careful tests.
- Browser storage durability varies; the product must communicate persistence status honestly.
- OPFS and Capacitor storage need separate adapters and platform validation.
- PDF and EPUB annotation anchors are format-specific and can become stale after a book file changes.
- Local search/indexing and large publication parsing can consume significant CPU/storage, requiring workers, bounds, and incremental behavior.
- Multi-device sync is more complex than backend CRUD and requires documented conflict semantics per record type.
- Local-only data is not automatically backed up; export and optional backup UX must make that tradeoff clear.

## Guardrails

A change violates this decision if it does any of the following for an offline-core feature:

- waits for an API response before updating local state or rendering existing data;
- requires login or a cloud-generated ID;
- stores only an object URL or absolute device path as a book's durable reference;
- reads/writes IndexedDB, OPFS, or Capacitor directly from ordinary React components;
- persists a reader library's internal location without translating it to the application locator;
- silently sends imported book content, annotations, or metadata to a server;
- enables scripts embedded in EPUB publications;
- treats offline state as a fatal application error.

Reviewers should reject new core-feature dependencies from domain/services toward Spring API clients. Optional sync adapters may depend on repository/domain contracts; the inverse is prohibited.

## Migration plan

1. Record the baseline and this decision (Phase 0).
2. Stabilize configuration, tests, build tooling, and existing prototype behavior (Phase 1).
3. Introduce local repositories, versioned IndexedDB, binary storage, local import, and local CRUD; retire backend upload as the primary path (Phase 2).
4. Add the installable/offline application shell and real local library UX (Phase 3).
5. Add normalized locator contracts and PDF/EPUB engines after the EPUB technical spike (Phase 4).
6. Build offline reading tools and knowledge/library capabilities (Phases 5–6).
7. Add Capacitor with the native binary adapter (Phase 7).
8. Add optional accounts, sync, and backup without changing local authority (Phase 8).
9. Add optional online services (Phase 9), then audit and prepare production delivery (Phases 10–11).

## Validation

The decision is fully realized only when this flow passes with networking disabled and Spring Boot/MongoDB absent:

```text
install/launch -> import PDF or EPUB -> open/read -> close -> relaunch
-> resume -> bookmark/highlight/note -> organize -> search -> export
```

Signing in later may synchronize selected data and opt-in backups. Signing out or losing the backend must not invalidate the local copy or any core local record.
