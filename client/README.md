# Reader web client

This directory contains the shared React + Vite JavaScript application. It is the future local-first reader core for the PWA and Capacitor targets.

Phase 1 still displays the inherited server upload flow, now labeled as legacy. Phase 2 replaces its primary action with browser-local import and storage; do not build new core reader features against `legacyBooksApi.js`.

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
