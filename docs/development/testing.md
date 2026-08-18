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

Vitest uses jsdom, Testing Library, and `fake-indexeddb`. Phase 3 adds manifest/Workbox configuration, install/update/offline lifecycle, local metadata search/filter, Continue Reading/Recent Books derivation, and scoped connectivity/storage UI coverage to the Phase 2 storage/import/repository suite. The test environment uses injected in-memory OPFS and PWA adapters; a production-service-worker browser check remains required.

## Backend

Use the wrapper, not a machine-global Maven installation:

```bash
cd server
./mvnw clean verify
```

The JUnit 5, AssertJ, Mockito, and MockMvc suite does not need MongoDB. Phase 1 covers PDF/EPUB metadata normalization, invalid/empty uploads, compensating file cleanup, generated managed filenames, deletion boundaries, configuration binding, public DTO path omission, deprecation headers, stable not-found behavior, and sanitized error responses.

`verify` also packages the server jar. The build requires Java 17; `.java-version` records that requirement for compatible version managers.

## Manual smoke checks

For the primary flow, keep Spring Boot and MongoDB stopped, start only the production frontend, and follow the [PWA offline-reopen checklist](../offline/pwa.md) plus [local storage checks](../offline/local-storage.md). Confirm installability, active service-worker control, explicit offline navigation/reload, local search/filter, PDF/EPUB import persistence, IndexedDB/OPFS contents, deletion, invalid-file handling, and an honest persistence status.

The deprecated backend endpoint can be regression-checked separately with MongoDB available by sending multipart field `file` to `POST /api/books/upload`. Confirm the response omits `filePath` and includes `Deprecation: true`. The React UI deliberately has no control for this endpoint.
