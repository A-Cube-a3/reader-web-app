# Reader web client

This directory contains the shared React + Vite JavaScript application and its local-first library core for the PWA and future Capacitor targets.

The primary UI imports PDF/EPUB files locally. React calls `LocalLibraryService`; repositories own IndexedDB and `OpfsBookBinaryStorage` owns browser file handles. Core library code does not import the legacy API client or wait for Spring Boot.

The current web adapter requires OPFS and checks that capability at runtime. Use a secure context (`localhost` is acceptable for development). The app asks for durable storage through the browser and reports quota/durability state, but the browser may deny persistence. See [local storage behavior](../docs/offline/local-storage.md).

## Commands

Use Node 22.23.1 and pnpm 11.15.1 from the repository pins.

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm test
pnpm build
pnpm check
```

`pnpm check` runs lint, the Vitest suite, and a production Vite build.

## Configuration

`VITE_API_BASE_URL` defaults to `/api`, which uses the Vite development proxy and remains suitable for a same-origin production deployment. `VITE_BACKEND_PROXY_TARGET` changes the development proxy target and defaults to `http://localhost:8080`.

Every `VITE_*` value is public browser configuration. The build rejects secret-like `VITE_*` names; never place credentials, tokens, database URLs, signing material, or provider keys in client configuration. See [the configuration catalog](../docs/setup/configuration.md).
