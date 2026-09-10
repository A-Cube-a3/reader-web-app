# Development and testing

## Reproducible toolchain

The server targets Java 17 and uses the committed Maven 3.9.12 wrapper. Maven Enforcer rejects other Java major versions and Maven wrapper drift. Spring Boot was upgraded separately from 3.2.0 to 3.5.16 after checking the official [Spring Boot 3.5 system requirements](https://docs.spring.io/spring-boot/3.5/system-requirements.html) and [Spring Boot support policy](https://github.com/spring-projects/spring-boot/wiki/Supported-Versions). Java 17 remains the project baseline; the upgrade did not authorize a Java or architecture migration.

The client targets Node 22, pins 22.23.1 through `.nvmrc`, declares its supported engine range, pins pnpm 11.15.1, and treats `pnpm-lock.yaml` as authoritative.

## Frontend

Install exactly from the lockfile and run the combined check:

```bash
cd client
pnpm install --frozen-lockfile
pnpm check
```

The combined command runs:

```bash
pnpm lint
pnpm test
pnpm build
```

Vitest uses jsdom, Testing Library, and `fake-indexeddb`. The suite covers schema v1/v2 migrations into v3; annotation repository CRUD/cascade deletion; normalized anchors; debounced and explicit progress flush; saved-locator recovery; PDF/EPUB highlight adapters; per-format preferences; reader lifecycle events; local annotation search; and reader-route bookmark/highlight/note/preference interactions in addition to the storage, PWA, engine, and untrusted-EPUB tests. Engine modules and platform services are injected in focused tests; production-browser checks with real PDF/EPUB files remain required.

## Backend

Use the wrapper, not a machine-global Maven installation:

```bash
cd server
./mvnw clean verify
```

The JUnit 5, AssertJ, Mockito, and MockMvc suite does not need MongoDB. Phase 1 covers PDF/EPUB metadata normalization, invalid/empty uploads, compensating file cleanup, generated managed filenames, deletion boundaries, configuration binding, public DTO path omission, deprecation headers, stable not-found behavior, and sanitized error responses.

`verify` also packages the server jar. The build requires Java 17; `.java-version` records that requirement for compatible version managers.

## Manual smoke checks

For the primary flow, keep Spring Boot and MongoDB stopped, start only the production frontend, and follow the [PWA offline-reopen checklist](../offline/pwa.md), [local storage checks](../offline/local-storage.md), [reader-engine checks](../architecture/reader-engines.md), and [reading-tools checks](../architecture/reading-tools.md). Confirm real PDF/EPUB rendering, navigation, progress/resume, annotations, local search, preferences, direct offline reader-route reopening, and cleanup as well as the existing install/import/storage behavior.

The deprecated backend endpoint can be regression-checked separately with MongoDB available by sending multipart field `file` to `POST /api/books/upload`. Confirm the response omits `filePath` and includes `Deprecation: true`. The React UI deliberately has no control for this endpoint.
