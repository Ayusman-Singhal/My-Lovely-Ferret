# Verify Log

Facts that change over time must be checked against official sources before the project relies on them (guide §24, `CLAUDE.md`). Each entry: date, what was checked, source, result, decision.

## 2026-09-30: toolchain versions (Part 0B)

Source: `npm view <package> version`, `npm view <package> peerDependencies`, `npm view <package> engines` on the npm registry.

| Package | Latest found | Installed | Note |
|---|---|---|---|
| preact | 11.0.0 | ^11.0.0 | Stable. `beta` and `rc` tags also exist. |
| vite | 8.3.1 | ^8.3.1 | Needs Node ^20.19 or >=22.12. |
| @preact/preset-vite | 2.10.6 | ^2.10.6 | Peer: vite 2 to 8, `@babel/core` 7. |
| vitest | 5.0.3 | ^5.0.3 | Needs Node ^22.12, ^24, or >=26. Peer: vite ^6.4, ^7, or ^8. |
| eslint | 10.11.0 | ^10.11.0 | `@eslint/js` 10.0.1 requires eslint ^10. |
| typescript-eslint | 8.71.0 | ^8.71.0 | Peer: `typescript >=4.8.4 <6.1.0`. |
| typescript | 7.0.2 (latest) | ^6.0.3 | **Deviation:** TypeScript 7 is `latest`, but typescript-eslint 8.71 does not support it (needs below 6.1). Pinned to 6.x. Revisit when typescript-eslint supports 7. |
| @types/node | n/a | ^24 | Lets `vite.config.ts` use `process.env`. Dev only, no bundle cost. |

Decision: `engines.node` is `>=22.12` (the loosest range that vite and vitest both accept). `.nvmrc` is 24 (the local Node is 24.20).

## 2026-09-30: `src/core` purity guards (Part 0B)

Method: temporary probe files in `src/core` and `src/ui`, deleted afterward.

- ESLint flags every banned item in `src/core`: imports of preact, `../render/*`, `../sync/firebase/*`; `Math.random`, `Math.sin`, `**`, `Date.now`, `new Date()`, `document`.
- A static `import ... from 'firebase/app'` in `src/ui` is flagged. A dynamic `import('firebase/app')` in the same file is not, as intended (guide §4.3).
- `tsc -p tsconfig.core.json` rejects `document` and `window` (no DOM lib).
- **Finding:** importing `preact` in `src/core` pulls the DOM lib into that typecheck (preact's type definitions reference it), so `tsc` alone would then accept `document`. ESLint bans the `preact` import in core, so the two guards cover each other. Keep both.
- `npm run size` exits 1 when the budget is set to 1 KB, and 0 at 300 KB.

## Baseline (Part 0B)

Initial JS gzipped: 4.82 KB (Preact 11 plus the placeholder app), budget 300 KB. PixiJS is not measured yet (Part 1C).

## 2026-09-30: GitHub Actions and Pages (Part 0C)

Source: GitHub REST API `repos/<owner>/<repo>/releases/latest` (authoritative for tags and dates), and the GitHub Pages limits page (https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

| Action | Latest | Used in `ci.yml` |
|---|---|---|
| actions/checkout | v7.0.1 (2026-07-20) | `@v7` |
| actions/setup-node | v7.0.0 (2026-07-14) | `@v7` |
| actions/upload-pages-artifact | v5.0.0 (2026-04-10) | `@v5` |
| actions/deploy-pages | v5.0.1 (2026-09-01) | `@v5` |

GitHub Pages limits (from the docs page): published site at most 1 GB, soft bandwidth limit 100 GB per month, soft limit of 10 builds per hour (does not apply when deploying with a custom GitHub Actions workflow), deployment times out after 10 minutes. These are far above what a small preview needs.

**Not verified:** whether GitHub Pages is available for private repositories on a free account, and any acceptable-use limits on commercial use. The docs pages fetched did not state it. Not blocking: the developer chose a public repo. Recheck before any decision to make the repo private, and before the game is monetized (Phase 6), since the closed preview is not the shipped product.

Note: `npm run check` builds with `base: '/'`. The deploy job rebuilds with `BASE_PATH=/<repo-name>/` because a project site is served from a sub-path.

## 2026-09-30: browser storage facts (Part 1B)

Sources: WebKit blog "Full Third-Party Cookie Blocking and More" (https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/), MDN `StorageManager.persist()` and `CompressionStream` pages.

- **iOS Safari 7-day rule: confirmed.** Safari's ITP deletes all script-writable storage (IndexedDB, localStorage, service worker registrations) after 7 days of Safari use without user interaction on the site. **Home Screen web apps are exempt**: they have their own use counter, and using the app resets it. So the guide's advice stands: iOS testers should use Add to Home Screen and Export backup (guide §8, §25.3). The in-app notice is built in Part 1H.
- **`navigator.storage.persist()`:** Baseline widely available since December 2021, HTTPS only, not available in Web Workers. Each browser decides on its own whether to grant it (some prompt, some decide silently), so a `false` result is normal. The save must never depend on it. `requestPersistentStorage()` in `src/platform/web/persist.ts` treats every failure as `false`.
- **`CompressionStream`:** Baseline widely available since May 2023 (per MDN). Needed only for the Phase 4 transfer bundle. Exact per-browser version numbers were not in the fetched text: check the MDN compatibility table and the Capacitor WebView before Phase 4.
- **Test environment:** `fake-indexeddb` 6.2.5 (Apache-2.0, no dependencies, dev only) tests the real IndexedDB wrapper in Node. It does not replace one manual check in a real browser (done at the Phase 1 gate).
