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

## 2026-09-30: renderer spike inputs (Part 1C)

Source: `npm view` on the npm registry; measurements from the spike (see `docs/PERFORMANCE.md` §3.1).

- **pixi.js** 8.21.0, MIT. Ships as ES modules with many lazily loaded chunks. Its own docs (`node_modules/pixi.js/skills`) describe `skipExtensionImports` plus manual `import 'pixi.js/app'` style imports for custom builds. The lean build saved about 28 KB gzip against the default and still loaded both the WebGL and the Canvas renderer chunks. Removed after the decision.
- **playwright-core** 1.63.0, Apache-2.0, no dependencies, dev only. Drives the Chrome already installed on this machine (`channel: 'chrome'`), so no browser download is needed. Used for real-browser checks and throttled startup measurements. Microsoft Edge was not found at its usual path.
- Headless Chrome with software rendering (SwiftShader) is fine for correctness and relative startup timing, not for frame rate. Real fps and battery checks need a real device (Phase 1 gate, guide §19).

## 2026-10-01: 3D stack facts (Part 1K.1)

| Fact | Result | Source |
|---|---|---|
| three.js latest | 0.186.1 on npm | `npm view three version` |
| Gzip cost of a minimal three.js scene | **169 KB gzip** (659 KB minified, 139 KB brotli). Bundle of WebGLRenderer, Scene, PerspectiveCamera, two lights, AnimationMixer, Clock, Raycaster, Plane, vectors, two materials, GLTFLoader, MeshoptDecoder, built with esbuild `--bundle --minify` in a scratch folder. The shader library is not tree-shaken, so adding features adds little. Above the 150 KB rule of thumb in forum posts. | measured here |
| WebGL 2 support | 96.44% global usage (caniuse, August 2026). Chrome for Android since 58, Safari iOS and macOS, Firefox, Edge, Samsung Internet. Hardware needs OpenGL ES 3.0. Budget phones with Mali-G52 class GPUs run it but struggle with big textures and heavy shaders. | https://caniuse.com/webgl2 , https://www.testmuai.com/learning-hub/webgl-2-browser-compatibility/ |
| Sketchfab "NoAI" tag | Terms forbid using NoAI-tagged models in datasets for, development of, or input to generative AI. It does not restrict normal use in a game. We do not feed models to AI tools. | https://sketchfab.com/blogs/community/introducing-the-noai-createdwithai-tags/ |
| Sketchfab free model license | Free downloads are CC licenses. CC-BY needs attribution (record it in `docs/ASSET_LICENSES.md`). Exclude NC (no commercial use) and ND (no changes), because the plan is to sell cosmetics and edit the model in Blender. Check the license on each model page before download. | model pages, Sketchfab help |
| Candidate ferret models | Verbeger "Ferret": CC-BY 4.0, 32K triangles, cartoonish, rig not stated, listing says made for Blender Cycles. ignkiran "Cartoon Ferret Rigged Low-poly": free, Rigify animal rig with face, 44K triangles, 4K textures, NoAI tag, `.blend` provided, license line not confirmed. SDPM Esare "Ferret": CC-BY. All need decimation. | https://sketchfab.com/3d-models/ferret-5e12e38229f041b28f24855f71de796a , https://sketchfab.com/3d-models/cartoon-ferret-rigged-low-poly-3d-model-e0ac2f7270f7453f9647627f19ccc457 |

Still to verify before 1K.3 finishes: meshopt decoder size inside the 169 KB figure (it is included), gltfpack availability on this machine, and a real low-end Android check (1J.4).

Decision input for 1K.4: the proposed 350 KB initial JS budget leaves about 180 KB for Preact, game code, and UI (now about 28 KB), so it fits with margin. Lazy-loading the three.js chunk after the first Preact paint would keep first paint small, but the pet is the product, so the loading screen must show quickly.

## 2026-10-01: Roblox publishing, DataStore, and service facts (side track R)

Full table with status per fact (confirmed, reported, unverified) is in `ferret-game-roblox/02_ROBLOX_FACTS.md`. Summary:

| Fact | Result | Source |
|---|---|---|
| Cost to build and test | Studio and testing are free. No Robux needed | https://generalistprogrammer.com/tutorials/how-to-make-a-roblox-game-for-free |
| Audience settings | Private, Limited (playtesters, friends or community), Public | https://create.roblox.com/docs/production/publishing/publish-experiences-and-places |
| Public publishing needs | Account in good standing 2+ days old, age verification, maturity questionnaire, 2-step verification | same |
| Public game without fee reaches | Age-checked 16+ users and Trusted Friends only | https://devforum.roblox.com/t/alternate-publishing-requirements-for-roblox-kids-and-select/4630944 |
| Reaching under-16 players | 1,000 Robux one-time (refundable), or Plus or Premium for 2 months, plus about 500 highly engaged players. **Sources differ** on refund terms (90 days versus 25 engaged players for 60 days). Not planned | same, https://bloxbot.ai/guide/roblox-new-publishing-requirements-2026 |
| DataStore limits | Reads `300 + users x 40` per minute, writes `300 + users x 20`, 4 MB per key | https://create.roblox.com/docs/cloud-services/data-stores/error-codes-and-limits |
| `AnalyticsService:LogCustomEvent` | Exists, signature `(player, eventName, value, customFields)` | https://create.roblox.com/docs/reference/engine/classes/AnalyticsService |
| `MemoryStoreHashMap` | `SetAsync(key, value, expiration)`, `GetAsync`, `UpdateAsync`, `RemoveAsync`. Unit of `expiration` not on the page | https://create.roblox.com/docs/reference/engine/classes/MemoryStoreHashMap |
| `TextService:FilterStringAsync` | Exists. Re-filter rule for saved text not on the page | https://create.roblox.com/docs/reference/engine/classes/TextService |
| DevEx | 30,000 Robux minimum, 13+, about $0.0035 per Robux (one source says $0.0054 for US 18+ verified). **India eligibility not verified** (official page returned HTTP 403) | https://generalistprogrammer.com/tutorials/roblox-devex-guide-how-to-cash-out-robux |

Decision: publish for 16+ and Trusted Friends, pay no Robux. Re-check on the day of publishing.

## 2026-10-01: iOS Safari storage rule (Part 1H.5)

| Fact | Result | Source |
|---|---|---|
| Safari's tracking prevention deletes all script-writable storage (IndexedDB, localStorage, service worker registrations and caches) after 7 days of Safari use without the person interacting with the site | Confirmed. It counts days of Safari use, not calendar days | https://webkit.org/tracking-prevention/ |
| A site added to the Home Screen as a web app is exempt, and its data is kept apart from Safari | Confirmed | same page |

Decision: the browser build shows a one-time notice on iPhones and iPads that are not launched from the Home Screen: "Add this page to your Home Screen, and export a backup." (`src/platform/web/ios.ts`). A lost pet on non-installed iOS Safari is not a Phase 1 gate failure (guide §25.3).
