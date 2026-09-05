# ADR-002: Use Foliate JS behind `EpubReaderEngine`

- **Status:** Accepted for Phase 4
- **Date:** 2026-09-05
- **Decision owners:** Reader application maintainers
- **Related:** [ADR-001](adr-001-local-first-reader.md), [reader engines](reader-engines.md)

## Context

The local-first reader needs to open an application-managed EPUB `File`/`Blob` without a server, retain EPUB CFI locations, paginate reflowable content, expose table-of-contents/search/selection behavior, and run in Vite browsers plus later Capacitor WebViews. Publication HTML is untrusted and scripted EPUB content must not execute.

A renderer is an infrastructure dependency, not the application's persistent model. All library-specific values therefore remain inside `EpubReaderEngine`; progress and later annotations use the versioned application locator.

## Technical spike

The spike was performed on 2026-09-05 using project documentation, source, release history, package metadata, and published security discussions. “Supported” means the candidate exposes a usable primitive; it does not mean this project has adopted every feature.

| Criterion | Foliate JS | EPUB.js 0.3.93 | Readium Web toolkit | Vivliostyle.js |
|---|---|---|---|---|
| Local `File`/`Blob` | Direct `View.open(File/Blob)` and section loader | Accepts `ArrayBuffer`; direct Blob behavior has historical issues | Navigator consumes Readium Web Publication Manifest/resources; packaged EPUB normally needs a streamer/conversion layer | Viewer primarily targets URLs/unpacked EPUB/HTML |
| EPUB 2/3 | OPF/nav plus NCX code paths | Mature EPUB 2/3 support | Strong standards-oriented EPUB support | EPUB/Web Publication typesetting support |
| Stable locations | EPUB CFI generation/resolution plus section context | Mature CFI/locations API | Readium locator/position model | Not centered on CFI-based reader state |
| Pagination / scrolling | CSS-column pagination and switchable scrolling | Paginated and scrolled managers | Reflowable/fixed-layout navigators and preferences | Excellent paged-media layout |
| TOC | Native nested TOC | Native navigation API | Manifest/navigator navigation | Publication navigation available |
| Search | Incremental section document search | `Section.find`; application orchestration required | Search depends on the surrounding publication/API toolchain | Not a primary reader-search API |
| Selection / highlights | Selection ranges and overlayer hooks | Selection/CFI and annotation APIs | Decorator APIs | Not the best fit for interactive annotation anchoring |
| React/Vite | Framework-neutral ES modules/custom element; proven by this Vite build | Common browser integration, but older module/tooling design | Published TypeScript packages; larger integration surface | Published viewer/core/React packages |
| Mobile WebView | Browser primitives; requires ES2022-era WebView features | Broad historical device use | Browser/embedded-frame target | Browser target; reader interaction is secondary |
| Maintenance (at spike date) | Upstream commits through May 2026; npm snapshot 1.0.1 is older | npm 0.3.93 and core commit activity are several years old | Active 2.8.x releases in 2026 | Active releases in 2026 |
| License | MIT; vendored zip.js BSD-3 and fflate MIT | BSD-2-Clause | BSD-3-Clause | AGPL-3.0 |
| Security posture | Explicitly refuses publication scripts and warns that CSP is mandatory because its iframe needs `allow-scripts` in WebKit | Scripts disabled by default, but enabling them makes its sandbox unsafe | Active iframe-hardening issue means additional work is required | Larger typesetting engine and AGPL obligations; still requires untrusted-content controls |

Primary evidence:

- [Foliate JS README and security guidance](https://github.com/johnfactotum/foliate-js)
- [Foliate JS commit history](https://github.com/johnfactotum/foliate-js/commits/main/)
- [EPUB.js README and scripted-content warning](https://github.com/futurepress/epub.js)
- [EPUB.js npm package](https://www.npmjs.com/package/epubjs)
- [Readium Web architecture](https://github.com/readium/web)
- [Readium TypeScript toolkit](https://github.com/readium/ts-toolkit)
- [Readium iframe-hardening issue](https://github.com/readium/ts-toolkit/issues/120)
- [Vivliostyle.js repository and license](https://github.com/vivliostyle/vivliostyle.js)

## Decision

Use `foliate-js` 1.0.1 as the Phase 4 EPUB implementation, pinned exactly in `package.json` and the integrity-locked pnpm lockfile. It is a narrow npm snapshot of upstream commit `f52d42c6127d0ad981a2c67634113541b17ae01e`; the package publisher is not the upstream repository owner, so upgrades require a fresh source/provenance review rather than a version-range bump.

`EpubReaderEngine` owns:

- module loading and the Foliate custom element;
- local Blob parsing and one-section-at-a-time rendering;
- CFI/spine/application-locator translation;
- TOC, next/previous, paginated/scrolling flow, search, selection, and view styles;
- renderer cleanup and generated blob revocation via section unload;
- blocking automatic external-link navigation.

The rest of the application imports neither Foliate modules nor its location/event types.

## Required security controls

Foliate's WebKit-compatible iframe uses `allow-same-origin allow-scripts`, so its sandbox is not a sufficient trust boundary. The application therefore applies layered controls:

1. A document CSP allows application scripts only from `'self'`, blocks objects, and limits frames/resources to application/blob/data sources as appropriate.
2. Before Foliate creates any resource blob URL, the EPUB transform hook removes scripts, embedded documents, event handlers, refresh/base elements, unsafe link schemes, and remote resource URLs.
3. CSS imports/URLs are limited to generated blob/data resources and legacy executable CSS constructs are removed.
4. A live-document pass repeats removal of executable elements/attributes after section load.
5. External hyperlinks are surfaced as a reader notice and never opened automatically.
6. Publication scripting is never enabled.

These controls are defense in depth. Phase 10 must audit parser evasions, SVG/CSS edge cases, CSP response headers, and a maintained malicious-EPUB corpus.

## Consequences and limits

- The reader can work directly from OPFS-returned `File` objects without inventing a backend streamer.
- Foliate and its parser/renderer chunks load only when an EPUB session starts, while the PWA precaches them for offline opening.
- EPUB CFIs remain the stable primary anchor; section href/index and progression are recovery/display context.
- Search walks publication sections incrementally and is capped at 200 returned matches, but it can still be expensive for very large books. Worker indexing remains later work.
- The npm snapshot lags active upstream. Upgrading to a newer snapshot, a verified upstream distribution, or another renderer requires rerunning this matrix and adapter tests.
- DRM/LCP, scripted publications, remote publication resources, and full EPUB media-overlay UX are not supported.

## Rejected alternatives

- **EPUB.js:** closest fallback and functionally capable, but its official release/maintenance age and historical Blob/large-chapter issues are weaker for a new long-lived adapter.
- **Readium Web:** promising and actively maintained, but its manifest/streamer architecture and current iframe-hardening work add server/service-worker complexity to a direct local-file phase.
- **Vivliostyle:** excellent paged typesetting, but AGPL obligations and weaker CFI/search/annotation reader fit make it disproportionate here.
- **Build a renderer from scratch:** would duplicate difficult EPUB layout, CFI, bidi/writing-mode, navigation, and accessibility work without evidence that the product needs a proprietary engine.
