# Repository baseline

**Snapshot date:** 2026-08-17  
**Baseline commit:** `ef9087e` (`chore: update gitignore`)  
**Baseline branch:** `main`  
**Repository:** `A-Cube-a3/reader-web-app`

This document records what existed before the local-first pivot. It is an inventory, not a description of intended or assumed functionality.

## Git and repository shape

The remote was fetched with pruning before this inventory was written. At the snapshot, `origin/main` was the only remote branch and no pull-request refs were present. The repository had 11 commits, all in one linear history dated 2026-02-11 or 2026-03-25. There were no tags, submodules, or tracked CI definitions.

There are 25 tracked files:

```text
.
├── README.md
├── client/
│   ├── README.md
│   ├── eslint.config.js
│   ├── index.html
│   ├── main.jsx                 # duplicate, not referenced by index.html
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── src/
│   │   ├── App.css
│   │   ├── App.jsx
│   │   └── main.jsx             # active browser entry point
│   └── vite.config.js
└── server/
    ├── .mvn/wrapper/maven-wrapper.properties
    ├── mvnw
    ├── mvnw.cmd
    ├── pom.xml
    └── src/main/
        ├── java/com/reader/...
        └── resources/application_example.properties
```

No root `AGENTS.md` or `docs/` directory existed. No test sources existed in either application.

## Existing architecture

The prototype implements one backend-dependent flow:

```text
React file picker
  -> POST /api/books/upload
  -> Spring Boot writes a file under server/storage
  -> Spring Data writes metadata to MongoDB
  -> the API returns the Mongo document, including its absolute file path
  -> React prints the response JSON
```

This makes Spring Boot, MongoDB, a writable server filesystem, and a network connection prerequisites for importing a book. The frontend has no local library database, durable binary store, service worker, reader, or offline behavior. The existing system therefore does not satisfy any local-first guarantee.

## Frontend inventory

### Runtime and dependencies

- React `^19.2.0` and React DOM `^19.2.0`.
- Vite `^7.3.1` with `@vitejs/plugin-react`.
- ESLint 9 with React Hooks and React Refresh rules.
- JavaScript and JSX only; there is no TypeScript configuration.
- A pnpm lockfile is committed, but `package.json` does not declare a `packageManager` version.

### Application behavior

`client/index.html` loads `client/src/main.jsx`, which mounts one `App` component. There is no router or route structure. `App.jsx`:

- accepts one file through an HTML file input;
- checks only whether the lower-cased filename ends in `.pdf` or `.epub`;
- sends the file to the hard-coded URL `http://localhost:8080/api/books/upload`;
- displays raw successful response JSON;
- reports a backend/network error to the user.

The application does not list existing books or open either format. State is transient React component state. It has no IndexedDB, OPFS, Cache Storage, local-storage database, worker, PDF/EPUB dependency, metadata parser, PWA manifest, service worker, install UX, or offline fallback.

### Structure and stale scaffolding

- `client/main.jsx` duplicates the active `client/src/main.jsx` bootstrap and is not referenced by Vite's HTML entry.
- `client/README.md` is the generic Vite template and discusses TypeScript-oriented expansion that is not part of this product direction.
- `client/index.html` retains the Vite icon reference and generic `client` title; the referenced icon is not tracked.
- Styling is a single prototype stylesheet. No reusable component, domain, service, repository, storage, reader, platform, or route boundary exists.

### Frontend validation at the snapshot

After installing the lockfile dependencies, these commands completed successfully:

```text
./node_modules/.bin/eslint .
./node_modules/.bin/vite build
```

Vite transformed 29 modules and produced a production bundle. There are no frontend tests and no `test` script.

## Backend inventory

### Runtime and dependencies

- Java source/release level 17.
- Spring Boot parent `3.2.0`.
- Spring MVC and Spring Data MongoDB.
- Lombok `1.18.30`, inherited from Spring Boot dependency management.
- `java-dotenv` `5.2.2`.
- `spring-boot-starter-test` is declared, but there are no tests.
- Maven Wrapper is configured to download Maven `3.9.12`.

The Unix `server/mvnw` file is tracked without its executable bit, so `./mvnw` fails on Unix-like systems unless permissions are corrected or it is invoked as `bash mvnw`.

### Endpoints

| Method | Path | Current behavior |
|---|---|---|
| `GET` | `/health` | Returns a plain text process message. This is not Spring Boot Actuator readiness. |
| `POST` | `/api/books/upload` | Accepts multipart field `file`, writes it to disk, persists metadata in MongoDB, and returns the entity. |
| `GET` | `/api/books` | Returns every MongoDB book document without pagination or user scope. |
| `GET` | `/api/books/{id}` | Returns a MongoDB book document by Mongo ID, or an error map. |

There are no download, content streaming, update, delete, authentication, synchronization, backup, AI, metadata-enrichment, or admin endpoints.

### Book model

The MongoDB `books` document contains:

```text
id                 MongoDB-generated String ID
title              filename with its final extension removed
type               "PDF" or "EPUB"
filePath           absolute path on the backend host
originalFileName   client-supplied multipart filename
fileSize           byte count
uploadedAt         server LocalDateTime
```

It does not represent author, description, publisher, language, ISBN/identifier, cover, local binary reference, user ownership, revisions, tombstones, or any reading state. Mongo IDs are the only identity. Controllers serialize this persistence entity directly rather than using API DTOs.

### File storage and validation

`FileStorageService` resolves `file.storage.path` to an absolute backend path, creates that directory, and copies uploads to a UUID filename while preserving the supplied extension. The service returns the absolute path, which is stored in MongoDB and exposed by the API.

Validation is based only on filename extension. There is no signature/container validation, MIME validation, PDF parsing, EPUB ZIP validation, archive entry validation, malware/content scanning, or filename normalization policy. EPUB contents are never rendered, so there is not yet an EPUB sandbox policy. If filesystem storage succeeds and MongoDB persistence fails, no compensation removes the orphaned file. There is no cleanup API.

### Configuration

The only tracked configuration is `application_example.properties`; Spring Boot does not automatically load that filename. It contains:

- a `dev` active profile with no matching profile file;
- localhost server, MongoDB host/port/database, and filesystem defaults;
- an alternative placeholder Atlas URI in the same template;
- multipart limits of 100 MB;
- DEBUG logging for the application package.

The real `application.properties` path is ignored. `ReaderApplication` unconditionally loads an untracked `.env` through `java-dotenv` and copies `MONGO_URI` into a system property. No tracked Spring property references `MONGO_URI`, so this manual loading is both brittle and ineffective as committed. A checkout without `.env` cannot rely on the documented startup path, and a copied example is required to supply `file.storage.path`.

There is no environment-variable catalog, configuration properties binding, profile-specific production validation, or `.env.example` file. No literal credential was found in the current tracked files or in the inspected prior `application.properties`; the Atlas value is a placeholder. Real `.env` patterns are ignored. Secret scanning is not automated.

### Security and API hygiene

- Spring Security is not present; every endpoint is anonymous.
- CORS is globally allowed for `/api/**` only from `http://localhost:5173`, with hard-coded methods.
- There is no authorization, user isolation, rate limiting, CSRF/security design, or account model.
- The API exposes backend absolute filesystem paths.
- Upload I/O errors append internal exception messages to client responses.
- Upload filenames are logged and reflected in records without an explicit sanitization/redaction policy.
- Request size is configured only in the unused example file.
- Reads are unpaginated.

### Backend validation at the snapshot

Using the declared Java 17 runtime:

```text
JAVA_HOME=/usr/lib/jvm/java-17-temurin-jdk bash mvnw test
```

completed successfully, but Maven reported `No tests to run`. This proves compilation under Java 17, not application startup or behavioral correctness. No MongoDB-backed integration check was performed.

Using the workstation's default Java 25, compilation failed because Lombok-generated `Book.builder()` and `Book.getId()` were unavailable. Phase 1 must define and enforce a supported Java toolchain before deciding whether dependency upgrades are warranted.

## Tests, CI, and operations

- No frontend unit, component, integration, or end-to-end tests.
- No backend unit, service, controller, repository, or integration tests.
- No offline tests.
- No GitHub Actions or other CI definitions.
- No container/deployment definitions.
- No Actuator, readiness, metrics, structured-log policy, or production error contract.
- No dependency/security scanning configuration.

## Documentation accuracy

The root README describes the old backend-required upload prototype. Several instructions are stale or misleading:

- commands use nonexistent `reader-app/backend` and `reader-app/frontend` paths instead of `server` and `client`;
- it recommends `npm install` although the committed lockfile is pnpm;
- its expected startup class name does not match `ReaderApplication`;
- its storage path uses the nonexistent `backend` directory;
- it implies copying configuration and providing `.env` are unnecessary;
- it documents an absolute `filePath` response as desirable;
- it describes upload as the product's primary flow and MongoDB as required.

The client README is unmodified Vite template text. There is no architecture, storage, offline, security, testing, or deployment documentation.

## Historical artifacts

A 104,017-byte, one-page PDF was committed at `server/storage/fe800b3e-8cb7-4df7-9dfc-28e07f6f441f.pdf` in commit `86d7da9` and deleted in `dcd9b35`. It remains retrievable from Git history. It must be treated as a repository-history data exposure and its ownership/sensitivity assessed before deciding whether history rewriting is justified. No history rewrite is part of Phase 0.

No committed real `.env` or literal database credential was found in the inspected reachable history. This is not a substitute for automated secret scanning, which is deferred to baseline stabilization/CI work.

## Confirmed gaps and phase ownership

| Gap | Planned owner |
|---|---|
| Reproducible configuration, README/setup accuracy, wrapper permissions, duplicate bootstrap, tests | Phase 1 |
| IndexedDB repositories, schema migrations, OPFS binaries, local import/CRUD/metadata | Phase 2 |
| Manifest, service worker, install/offline shell, real library UX | Phase 3 |
| PDF.js and selected EPUB engine behind normalized reader interfaces | Phase 4 |
| Progress, bookmarks, highlights, notes, preferences, in-book/local knowledge search | Phase 5 |
| Collections, status, favorites, knowledge workspace, exports, local statistics | Phase 6 |
| Capacitor Android/iOS and native binary storage adapter | Phase 7 |
| Optional accounts, security, sync, and opt-in binary backup | Phase 8 |
| Optional online AI, enrichment, and cloud administration | Phase 9 |
| Focused security, performance, and comprehensive quality audit | Phase 10 |
| CI, operations, release documentation, and final acceptance audit | Phase 11 |

Phase 0 intentionally does not correct these product and configuration defects. Its output is the verified baseline and the architectural/roadmap source of truth used to correct them in ordered, reviewable phases.
