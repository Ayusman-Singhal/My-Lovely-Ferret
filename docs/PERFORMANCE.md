# Performance

Light and fast is a hard requirement (guide §4, Principle 11). Budgets are enforced in the build. This file holds the budgets, how they are measured, and the measured numbers at every phase gate. Update it at each gate.

## 1. Budgets (starting targets, guide §4.1)

| Metric | Starting target | Enforced by |
|---|---|---|
| Initial JS (UI, game, renderer), gzipped | at most about 300 KB, tighten after measuring | `npm run size` (fails the build) |
| Firebase chunk (lazy), gzipped | own budget, set when it exists (Phase 3) | `npm run size`, `scripts/budgets.json` |
| First-run art | at most about 1 to 1.5 MB | `ART_ASSET_LIST.md` totals, size check later |
| Total installed art and audio | as small as possible | `ART_ASSET_LIST.md` totals |
| Time to interactive, mid-range Android over 4G | under about 2 seconds | Lighthouse or DevTools throttling |
| Frame rate | steady 60 fps on a mid-range laptop, at least 30 fps under 4x CPU throttling | DevTools |
| Idle CPU (pet asleep, nothing animating) | near zero | DevTools Performance |
| Texture memory | start at about 32 MB, tracked | Pixi texture stats or DevTools |

**How "initial JS" is counted.** `scripts/check-budgets.mjs` reads `dist/.vite/manifest.json`, takes the entry chunk plus everything it imports statically, gzips each file with Node's `zlib`, and sums them. Dynamically imported chunks (Firebase, lazy screens) are excluded on purpose.

## 2. How to measure

| What | How |
|---|---|
| Bundle size | `npm run build && npm run size` |
| What is in the bundle | Build, then inspect `dist/assets/*.js` (a bundle visualizer is added only if needed and only as a dev tool) |
| Time to interactive | `npm run preview`, Chrome DevTools Lighthouse, mobile preset, throttled 4G and 4x CPU |
| Frame rate | DevTools Performance panel with 4x CPU throttling, mobile emulation, while the pet walks |
| Idle CPU | DevTools Performance, pet asleep for 30 seconds. Expect a flat line |
| Real device | One check on a real low-end Android phone through the hosted preview link, at the end of Phase 1 and before the art style is locked (guide §19) |

## 3. Measurements by phase

| Phase or part | Date | Initial JS gzip | Notes |
|---|---|---|---|
| 0B baseline | 2026-09-30 | 4.82 KB | Preact 11 and the placeholder app. No renderer yet. |
| 1C renderer spike | | | Pixi versus Canvas 2D decision goes here. |
| Phase 1 gate | | | Full table of section 1. |

## 4. Decisions made to stay within budget

| Date | Decision | Reason |
|---|---|---|
| 2026-09-30 | Preact 11 instead of React | Few KB instead of tens (guide §3). |
| 2026-09-30 | Checksum is FNV-1a, not SHA-256 (proposed D3) | No crypto dependency or async work for saves. |
| 2026-09-30 | Placeholder rig drawn in code | 0 KB of art for Phase 1 (`ART_STYLE.md`). |

## 5. Platform targets (guide §25.6)

- **Browsers:** current and previous major versions of Chrome, Edge, Firefox, and Safari, including iOS Safari.
- Features to verify against those browsers in Part 1B and record in `VERIFY_LOG.md`: IndexedDB with `navigator.storage.persist()`, `CompressionStream` (needed in Phase 4), service worker and installable PWA, `Intl.Segmenter` (name length check, `ES2022`), `prefers-reduced-motion`, `100dvh` and `env(safe-area-inset-*)`.
- **Android:** the minimum OS version and minimum WebView version are set in Phase 5. They depend on Capacitor's requirements at that time and on what low-end phones in the developer's region run (guide §25.6). Deferred because nothing native exists before Phase 5.
- Below the minimum, the app shows a plain "please update your browser or WebView" screen instead of a broken pet.

## 6. Rendering rules to protect the budgets (guide §4.4)

Render on demand and stop the loop when the pet sleeps. Pause on `visibilitychange` hidden and run the elapsed simulation on return. Cap DPR at 2. Atlases at most 2048 by 2048, no filters or blur. No per-frame allocations in hot paths. Preact never drives per-frame animation. No `setInterval` polling loops.
