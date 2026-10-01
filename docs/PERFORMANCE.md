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
| 1E PetAI and brain | 2026-09-30 | 14.60 KB | Adds PetAI, plan, brain, scaled clock. |
| 1F interactions and mini-game | 2026-09-30 | 18.07 KB | Commands, mini-game, controller, pointer input, test bar. |
| 1G UI and save | 2026-09-30 | 27.53 KB | HUD, action bar, onboarding, menu, i18n, autosave, IndexedDB save wired. Room resized to 360 by 540. |
| 1K.3 3D spike | 2026-10-01 | 1.1 KB entry plus a 154.2 KB lazy three.js chunk (app unchanged at 27.5 KB) | Blender ferret in three.js, 27.9 KB gzip model, scene ready 1.88 s on slow 4G + 4x CPU. See §3.2 |
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

### 3.2 three.js 3D spike, 2026-10-01 (Part 1K.3)

The Blender ferret (`animation/export/ferret.glb`, 13 clips, 184 triangles in the file) in three.js, in a box room, with crossfaded loops and additive one-shots. Page: `dev/ferret3d.html` (dev only). Measured with `node scripts/measure-startup.mjs`, which builds only that page (`vite.spike.config.ts`), serves it with gzip like GitHub Pages, and drives the installed Chrome. Same profile as §3.1: 1.6 Mbps down, 150 ms latency, 4x CPU slowdown, cache off.

| Measure | Result |
|---|---|
| Entry script (starts the model download, shows the loading text) | 1.1 KB gzip, runs at about 0.4 s on the slow profile |
| three.js code, one lazy chunk (`WebGLRenderer`, `GLTFLoader`, `AnimationMixer`, lights, materials; no meshopt decoder) | **154.2 KB gzip** (617 KB raw). The earlier estimate with the meshopt decoder was 169 KB |
| Ferret model, unoptimized | 175 KB raw, **27.9 KB gzip**. With `gltf-transform optimize --compress meshopt` it is 140 KB raw and 18.7 KB gzip (tool run in a scratch folder, not adopted yet) |
| Texture | 64 by 64 PNG, 1.7 KB, inside the model |
| Over the wire in one load | 184.7 KB |
| Scene ready, no throttle | median 215 ms |
| Scene ready, slow 4G + 4x CPU | **median 1.88 s** (five runs, 1.86 to 1.97 s). Phases: entry script 0.39 s, model bytes in 0.85 s, three.js code ready 1.60 s, first frame drawn 1.88 s |
| Frames drawn while paused for 2 s | **0** (settled scene costs nothing) |
| Triangles and draw calls | 140 for the ferret, 212 with the room. 13 draw calls for the ferret (13 pieces), 19 with the room |

How to read it:

- "Scene ready" means the first model frame is on the canvas. Headless Chrome draws WebGL in software (SwiftShader), so the shader compile and first draw are **slower than on a phone GPU**, and frame rate was not measured. This is a pessimistic proxy. The real low-end Android check (task 1J.4) still decides.
- The first version of the measurement left the previous run's page open, and its render loop competed for the CPU. That read 4.2 to 4.9 s. It was a bug in the script, fixed by closing each page before the next run. Ignore any number above 4 s from earlier today.
- Starting the model download before three.js has loaded (the two overlap) and showing the loading text from the tiny entry script is part of the design. A variant with everything in one bundle was not measured cleanly, so the gain from this is not quantified.
- The 154 KB lives in a **dynamic import**, so `scripts/check-budgets.mjs` counts only the 1.1 KB entry. That is the loophole warned about at the end of §3.1. When the 3D scene joins the app (task 1K.6), the budget script must count the scene chunk too (name it in `scripts/budgets.json`), so the real initial cost stays visible. Today's app is 27.5 KB gzip, so app plus scene is about 182 KB.
- Model animation data is most of the file, because every clip stores keys for all 17 bones even when a bone does not move. Dropping constant tracks and compressing is possible when it matters.

Findings against the proposed budgets (`docs/PLAN.md` Part 1K): they hold with a wide margin. Suggested tighter values to approve at 1K.4: initial JS including the scene chunk at most 250 KB gzip, first-run art at most 1 MB, scene ready at most 3 s on the slow profile, texture memory at most 32 MB.

## 4. Decisions made to stay within budget

| Date | Decision | Reason |
|---|---|---|
| 2026-09-30 | Preact 11 instead of React | Few KB instead of tens (guide §3). |
| 2026-09-30 | Checksum is FNV-1a, not SHA-256 (proposed D3) | No crypto dependency or async work for saves. |
| 2026-09-30 | Placeholder rig drawn in code | 0 KB of art for Phase 1 (`ART_STYLE.md`). |
| 2026-09-30 | Canvas 2D instead of PixiJS | 116 to 144 KB gzip and about 1.2 to 1.4 s slower scene-ready under throttle (section 3.1). |
| 2026-10-01 | three.js for the 3D ferret, replacing Canvas 2D (pending approval at 1K.4) | Quality over the smallest bundle. Measured cost is acceptable: 154 KB gzip lazy chunk, scene ready 1.88 s on the slow profile (section 3.2). |

## 5. Platform targets (guide §25.6)

- **Browsers:** current and previous major versions of Chrome, Edge, Firefox, and Safari, including iOS Safari.
- Features to verify against those browsers in Part 1B and record in `VERIFY_LOG.md`: IndexedDB with `navigator.storage.persist()`, `CompressionStream` (needed in Phase 4), service worker and installable PWA, `Intl.Segmenter` (name length check, `ES2022`), `prefers-reduced-motion`, `100dvh` and `env(safe-area-inset-*)`.
- **Android:** the minimum OS version and minimum WebView version are set in Phase 5. They depend on Capacitor's requirements at that time and on what low-end phones in the developer's region run (guide §25.6). Deferred because nothing native exists before Phase 5.
- Below the minimum, the app shows a plain "please update your browser or WebView" screen instead of a broken pet.

## 6. Rendering rules to protect the budgets (guide §4.4)

Render on demand and stop the loop when the pet sleeps. Pause on `visibilitychange` hidden and run the elapsed simulation on return. Cap DPR at 2. Atlases at most 2048 by 2048, no filters or blur. No per-frame allocations in hot paths. Preact never drives per-frame animation. No `setInterval` polling loops.
