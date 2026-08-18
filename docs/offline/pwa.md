# Installable PWA and offline behavior

## What Phase 3 provides

The web client builds as an installable Progressive Web App. Its application shell, JavaScript, CSS, icons, PDF.js code, and PDF worker are bundled locally and precached by a generated Workbox service worker. Once the production app has loaded and completed service-worker installation, the shell can launch and navigate without a network connection.

Local library records remain in IndexedDB and imported book/cover binaries remain in OPFS. The service worker does not duplicate book files into Cache Storage. The three stores have separate responsibilities:

```text
Cache Storage   -> versioned application shell and bundled runtime assets
IndexedDB       -> book metadata, progress foundation, settings, cleanup intent
OPFS            -> copied PDF/EPUB and cover binaries
```

Spring Boot and MongoDB are not contacted during application boot, local search/filter, library rendering, or offline reopening.

## Manifest and install

The Vite build generates `manifest.webmanifest` with:

- a stable `/` application identity, start URL, and scope;
- standalone display mode;
- local theme/background colors;
- bundled 192 px and 512 px PNG icons;
- a maskable 512 px icon.

The UI displays **Install app** when the browser emits an install prompt. Browsers that do not expose that event may still offer installation from their own menu. If the app is already running in standalone mode, the in-app action stays hidden. Installation support is ultimately a browser/platform capability; the local library continues working in a normal supported browser tab.

The manifest and service-worker integration use [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/guide/) with Workbox's generated-service-worker strategy. All critical assets are repository-owned; the shell does not require a CDN, remote font, or third-party runtime host.

## Cache and navigation behavior

The production build precaches HTML, JavaScript, `.mjs` worker/chunk files, CSS, PNG, and SVG assets. `index.html` is the navigation fallback for same-origin application routes, so reopening an application URL offline returns the local shell. `/api/**` is deliberately excluded from navigation fallback: a failed optional cloud request must fail as a network request, not masquerade as application HTML.

Vite's development server is not the offline acceptance target. Use a production build and preview/static server:

```bash
cd client
pnpm build
pnpm preview --host 127.0.0.1
```

Service workers require a secure context; loopback development origins qualify in browsers that follow the secure-context standard. Production must use HTTPS.

## Update lifecycle

Updates use the prompt strategy documented by the [Vite PWA update guide](https://vite-pwa-org.netlify.app/guide/service-worker-strategies-and-behaviors). A newly installed worker waits while the current version remains active. The UI displays **Reader update ready** with:

- **Update now** — activates the waiting worker and reloads;
- **Later** — keeps the current app session and form state intact.

This avoids automatic reloads while the user is importing a book or editing metadata. The app asks the registration to check for updates hourly while online, when the browser returns online, and when the document becomes visible. Failed checks do not interrupt local use. A registration failure is shown as a scoped, dismissible offline-installation warning; it is not presented as library data loss.

The first successful worker installation produces a dismissible **Ready offline** notice. A service-worker update changes Cache Storage only; it does not delete or migrate IndexedDB/OPFS data. Schema migrations remain owned by the versioned database code.

## Offline and connectivity UX

Offline is normal. When the browser reports no connection, the header displays **Offline · local library ready** rather than a global error. Import, metadata search, format filters, details, edits, and deletion continue through local services. Optional cloud features are not present yet; when introduced, only their controls may require connectivity.

The library includes:

- Continue Reading derived from local progress/last-opened state;
- Recent Books derived from local timestamps;
- in-memory metadata search over title, author, publisher, language, identifier, description, and original filename;
- All/PDF/EPUB format filters;
- accessible loading, empty, no-results, storage, install, update, and offline states.

Actual PDF/EPUB reading remains Phase 4. Selecting a book currently opens its local details.

## Storage durability is separate from offline caching

An installed/cached shell does not make browser data indestructible. The storage card separately reports quota and whether durable storage was granted. Low quota is called out, and storage-inspection failures are recoverable without hiding existing IndexedDB records.

Clearing this origin's site data can remove Cache Storage, IndexedDB, and OPFS. Uninstall behavior varies by browser/platform, so users must retain original book files until an explicit backup/export path exists. See [local library storage](local-storage.md) for quota, persistence, import, and cleanup details.

## Reproducible offline-reopen check

Keep Spring Boot and MongoDB stopped.

1. Run `pnpm build` and serve with `pnpm preview --host 127.0.0.1`.
2. Open `http://127.0.0.1:4173/` in a fresh browser profile.
3. Wait for **Ready offline** or confirm an active service worker in developer tools.
4. Import a valid PDF or EPUB and confirm its card appears.
5. Reload once online so the active worker controls the page.
6. In developer tools, enable network **Offline**.
7. Reload `/` and then navigate directly to a same-origin path such as `/offline-check`.
8. Confirm the My Library shell and imported record render without a global error.
9. Search for the imported title and change the format filter.
10. Confirm the stored binary still exists in the origin-private filesystem and can be read through the storage adapter/browser storage inspection.
11. Restore connectivity and confirm the offline badge disappears without losing state.

Do not treat leaving the preview server running as proof of offline behavior; the browser network must be explicitly disabled for steps 6–10.

## Troubleshooting

### Install action does not appear

- Confirm the production build is served from HTTPS or a loopback origin.
- Inspect `manifest.webmanifest` and its icon requests for errors.
- Confirm a service worker is active and the app is within `/` scope.
- Check the browser's own install menu; not every browser exposes an in-page prompt.
- The action is intentionally hidden in standalone mode.

### Old interface remains after deployment

- Look for the **Reader update ready** prompt and select **Update now**.
- Close other tabs running the older version if activation remains blocked.
- Inspect service-worker registrations and Cache Storage before clearing anything.
- Do not clear site data casually: that also risks deleting IndexedDB and OPFS books.

### Shell does not reopen offline

- Confirm the app completed one successful online production load before disconnecting.
- Confirm the page is controlled by the generated service worker rather than the Vite development server.
- Verify `sw.js` and Workbox files were served with successful responses and correct JavaScript content types.
- Rebuild after configuration changes; the precache manifest is generated from production output.

### Library exists but a book binary is missing

That is a local storage issue, not a service-worker cache issue. Follow [local storage troubleshooting and recovery](local-storage.md); reinstalling the shell cannot recreate a deleted OPFS binary.
