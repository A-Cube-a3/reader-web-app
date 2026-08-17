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

Vitest uses jsdom and Testing Library. Phase 1 covers runtime configuration and secret-name rejection, the legacy API success/error/network contracts, file-type UI validation, successful UI submission, and useful connectivity feedback.

## Backend

Use the wrapper, not a machine-global Maven installation:

```bash
cd server
./mvnw clean verify
```

The JUnit 5, AssertJ, Mockito, and MockMvc suite does not need MongoDB. Phase 1 covers PDF/EPUB metadata normalization, invalid/empty uploads, compensating file cleanup, generated managed filenames, deletion boundaries, configuration binding, public DTO path omission, deprecation headers, stable not-found behavior, and sanitized error responses.

`verify` also packages the server jar. The build requires Java 17; `.java-version` records that requirement for compatible version managers.

## Manual smoke check

With MongoDB available, start the backend and frontend, select a small PDF or EPUB, and use **Upload to Legacy Backend**. Confirm a created response appears without `filePath`, and browser network tools show the `Deprecation: true` response header.

This is only a regression check for the inherited flow. It is not the local-first acceptance test; local import begins in Phase 2.
