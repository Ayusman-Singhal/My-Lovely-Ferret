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
| Texture memory | start at about 32 MB, tracked | Sum of canvas and image sizes (width x height x 4 bytes), DevTools memory |

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
| 1C renderer spike | 2026-09-30 | Canvas 2D: 1.4 KB. PixiJS 8.21.0: 116 KB (lean) to 144 KB (default) | Decision: **Canvas 2D**. See the table below. |
| 1D rig and animations | 2026-09-30 | 10.21 KB | Preact, core types, Canvas 2D scene, rig, 12 animations. 0 KB of art files. |
| Phase 1 gate | | | Full table of section 1. |

### 3.1 Renderer spike, 2026-09-30 (Part 1C)

The same scene (room with a window and floor boards, plus one moving rounded shape) was built twice, at the same 360 by 640 logical size, device pixel ratio 2. Screenshots from real Chrome were pixel-identical in layout.

| Variant | JS loaded at start, gzip | Scene ready, no throttle | Scene ready, slow 4G + 4x CPU (median of 5) |
|---|---|---|---|
| Canvas 2D | 1.4 KB | 0.13 s | **0.60 s** |
| PixiJS 8.21.0, lean (`skipExtensionImports`, manual imports) | 116 KB | 1.3 s | **1.79 s** |
| PixiJS 8.21.0, default import | 144 KB | 0.51 s | **1.98 s** |

Method: Vite production build of each page, served with `vite preview`, driven by `playwright-core` on the installed Chrome (headless, software WebGL). Network throttled with the Chrome DevTools Protocol to 1.6 Mbps down and 150 ms latency, CPU 4x, cache off. "Scene ready" is the time from navigation until the canvas exists in the DOM (after Pixi's async init for the Pixi variants). This is a proxy for time to interactive, not Lighthouse. The unthrottled lean number is noisy (first-run chunk loading) and the fps figures from headless Chrome are not meaningful, so neither is used for the decision.

Finding: PixiJS fits the 300 KB size budget but not the speed budget. The empty scene alone used about the whole 2 s time-to-interactive target on a throttled phone-like profile, before any game code, art, or fonts. The game scene is about a dozen shapes and props with no filters (docs/ART_STYLE.md), which Canvas 2D handles without a library.

**Decision (developer approved, 2026-09-30): Canvas 2D.** PixiJS is removed from the project. Reconsider only with new measurements if the scene's needs grow a lot (many sprites, shaders).

Rule kept from this spike: `npm run size` counts the entry chunk and its static imports. A dynamic import that always fires at startup would slip past it, so never use dynamic `import()` for code needed for the first paint. Dynamic imports are for lazy features only (Firebase, shop, history, passport).

## 4. Decisions made to stay within budget

| Date | Decision | Reason |
|---|---|---|
| 2026-09-30 | Preact 11 instead of React | Few KB instead of tens (guide §3). |
| 2026-09-30 | Checksum is FNV-1a, not SHA-256 (proposed D3) | No crypto dependency or async work for saves. |
| 2026-09-30 | Placeholder rig drawn in code | 0 KB of art for Phase 1 (`ART_STYLE.md`). |
| 2026-09-30 | Canvas 2D instead of PixiJS | 116 to 144 KB gzip and about 1.2 to 1.4 s slower scene-ready under throttle (section 3.1). |

## 5. Platform targets (guide §25.6)

- **Browsers:** current and previous major versions of Chrome, Edge, Firefox, and Safari, including iOS Safari.
- Features to verify against those browsers in Part 1B and record in `VERIFY_LOG.md`: IndexedDB with `navigator.storage.persist()`, `CompressionStream` (needed in Phase 4), service worker and installable PWA, `Intl.Segmenter` (name length check, `ES2022`), `prefers-reduced-motion`, `100dvh` and `env(safe-area-inset-*)`.
- **Android:** the minimum OS version and minimum WebView version are set in Phase 5. They depend on Capacitor's requirements at that time and on what low-end phones in the developer's region run (guide §25.6). Deferred because nothing native exists before Phase 5.
- Below the minimum, the app shows a plain "please update your browser or WebView" screen instead of a broken pet.

## 6. Rendering rules to protect the budgets (guide §4.4)

Render on demand and stop the loop when the pet sleeps. Pause on `visibilitychange` hidden and run the elapsed simulation on return. Cap DPR at 2. Atlases at most 2048 by 2048, no filters or blur. No per-frame allocations in hot paths. Preact never drives per-frame animation. No `setInterval` polling loops.
