# Reader

Reader is being rebuilt as a local-first PDF and EPUB application. The React application will own core reading data and work without an account, Spring Boot, MongoDB, or a network connection. Spring Boot and MongoDB remain as an optional cloud companion.

Phase 1 stabilizes the inherited upload prototype. Local import and durable offline storage begin in Phase 2; the current upload screen and `POST /api/books/upload` are explicitly temporary legacy paths.

## Repository

```text
client/   React 19 + Vite 7 + JavaScript
server/   Java 17 + Spring Boot 3.5 + Maven wrapper + MongoDB
docs/     Authoritative architecture, roadmap, setup, and development guidance
```

Read [docs/roadmap.md](docs/roadmap.md) before roadmap work. The accepted architecture is in [docs/architecture/local-first-architecture.md](docs/architecture/local-first-architecture.md).

## Supported toolchain

- Java 17 exactly for the server build
- Maven 3.9.12 through the executable wrapper in `server/`
- Node.js 22 (the repository pins 22.23.1 in `.nvmrc`)
- pnpm 11 (the client pins 11.15.1)
- MongoDB for the temporary server upload path only

## Quick start

The frontend can be linted, tested, and built without MongoDB. Running the temporary upload flow requires MongoDB and the backend.

```bash
cd client
pnpm install --frozen-lockfile
pnpm check
pnpm dev
```

In another terminal:

```bash
cd server
./mvnw clean verify
./mvnw spring-boot:run
```

Local development defaults use MongoDB at `mongodb://localhost:27017/readerapp`, server port `8080`, client port `5173`, and server storage at `server/storage/` when the backend is launched from `server/`. Override them through the environment; the application does not load `.env` files itself.

For example:

```bash
cp .env.example .env
set -a
. ./.env
set +a
```

Do not commit the resulting `.env`. See [docs/setup/configuration.md](docs/setup/configuration.md) for the full variable catalog, profiles, and production rules.

## Current API

| Method | Endpoint | Current purpose |
|---|---|---|
| `GET` | `/api/health` | Simple prototype health response |
| `POST` | `/api/books/upload` | Deprecated server-side PDF/EPUB upload |
| `GET` | `/api/books` | List legacy MongoDB book metadata |
| `GET` | `/api/books/{id}` | Get legacy MongoDB book metadata |

Public book responses omit internal storage paths. API failures use a stable error shape and do not return raw storage or database exception details. The upload response includes deprecation headers because Phase 2 replaces this UI path with local import.

## Validation

```bash
cd client && pnpm check
cd ../server && ./mvnw clean verify
```

The current test layout and exact reproducible commands are documented in [docs/development/testing.md](docs/development/testing.md).
