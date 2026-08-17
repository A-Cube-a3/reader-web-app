# Configuration

Phase 1 uses framework-native external configuration. Spring Boot reads environment variables and profile files directly; Vite reads its public variables from the process environment. Neither application parses the repository root `.env` file at runtime.

`.env.example` is a names-and-safe-examples template. A developer may copy and export it in a shell, but real `.env` files remain ignored and must never be committed.

## Variable catalog

| Variable | Owner | Classification | Default | Required in production | Introduced | Purpose |
|---|---|---|---|---|---|---|
| `VITE_API_BASE_URL` | Client | Public configuration | `/api` | No; same-origin is the production default | Phase 1 | Base URL for the temporary legacy API client |
| `VITE_BACKEND_PROXY_TARGET` | Client dev server | Public configuration | `http://localhost:8080` | No; development only | Phase 1 | Vite development proxy target |
| `SERVER_PORT` | Server | Private configuration | `8080` | No | Phase 1 | Spring Boot HTTP port |
| `MONGODB_URI` | Server | Secret when it contains credentials | `mongodb://localhost:27017/readerapp` outside production | Yes | Phase 1 | MongoDB connection for legacy/cloud metadata |
| `BOOK_STORAGE_PATH` | Server | Private configuration | `./storage` outside production | Yes | Phase 1 | Server-managed directory for the deprecated upload path |
| `CORS_ALLOWED_ORIGINS` | Server | Private configuration | `http://localhost:5173` outside production | Yes | Phase 1 | Comma-separated browser origins allowed for `/api/**` |

There are no JWT, object-storage, or AI provider variables yet. They must be added to this catalog with safe production validation in the phase that introduces them.

## Client rules

All variables whose names begin with `VITE_` are bundled into client code and are visible to anyone using the application. They are never secret storage.

The client validates `VITE_API_BASE_URL` as either a root-relative path or credential-free HTTP(S) URL. Vite startup/build also rejects secret-like public variable names, including names containing `SECRET`, `PASSWORD`, `API_KEY`, `PRIVATE_KEY`, `JWT`, `MONGO`, `DATABASE`, `CREDENTIAL`, or token terms.

For local development, the default `/api` URL avoids a hard-coded runtime host. Vite proxies it to `VITE_BACKEND_PROXY_TARGET`. For split-origin deployments, set `VITE_API_BASE_URL` to the public backend origin and set the server CORS allowlist explicitly.

## Server profiles

`server/src/main/resources/application.yml` contains safe local defaults. Spring Boot externalized configuration can override them through the environment or ordinary supported Spring configuration sources.

The `prod` profile deliberately removes fallback values for `MONGODB_URI`, `BOOK_STORAGE_PATH`, and `CORS_ALLOWED_ORIGINS`:

```bash
cd server
MONGODB_URI='mongodb://user:password@mongo.example/readerapp' \
BOOK_STORAGE_PATH='/var/lib/reader/books' \
CORS_ALLOWED_ORIGINS='https://reader.example.com' \
./mvnw spring-boot:run -Dspring-boot.run.profiles=prod
```

Inject production secrets through the deployment environment or a secret manager that exposes them as environment variables. Do not put them in `application*.yml`, `.env.example`, client variables, container images, or command history. An early production-profile guard names any missing required variable without logging its value; there are no insecure production credential fallbacks.

## Test configuration

Unit and controller tests use mocks and temporary directories, so they do not require MongoDB or persistent book storage. Configuration binding tests supply explicit properties in an isolated application context.

Phase 2 moves normal import into client-local storage. The server variables remain relevant only to the optional companion and the temporary legacy upload until that migration is complete.
