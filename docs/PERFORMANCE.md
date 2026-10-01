# Performance

Fast and smooth is a hard requirement (guide §4, Principle 11): quick first feedback, a steady frame rate, near-zero idle CPU. **Small is no longer a hard requirement** (developer decision, 2026-10-01): the first phases kept everything tiny to prove the idea, and now sizes may be as large as typical apps. The size numbers below replace the stricter ones in guide §4.1. Budgets are enforced in the build. This file holds the budgets, how they are measured, and the measured numbers at every phase gate. Update it at each gate.

## 1. Budgets (relaxed on 2026-10-01; the original strict targets are in the table below it)

| Metric | Target | Enforced by |
|---|---|---|
| Initial JS (UI, game, renderer including the 3D scene chunk), gzipped | at most 1 MB | `npm run size` (fails the build). The script must count the scene chunk too, see §3.2 |
| Other lazy chunks (Firebase, shop, history), gzipped | at most 500 KB each, set when each exists | `npm run size`, `scripts/budgets.json` |
| First-run assets (3D model, textures, room) | at most 10 MB | `ART_ASSET_LIST.md` totals, size check later |
| Total installed art and audio | web: keep under about 50 MB. Android: well under Google Play's bundle limit (check the limit at Phase 5) | `ART_ASSET_LIST.md` totals |
| Loading screen visible, slow 4G + 4x CPU | under 1.5 seconds | `scripts/measure-startup.mjs` |
| Scene ready (first pet frame), slow 4G + 4x CPU | at most 5 seconds | `scripts/measure-startup.mjs` |
| Frame rate | steady 60 fps on a mid-range laptop, at least 30 fps under 4x CPU throttling | DevTools |
| Idle CPU (pet asleep, nothing animating) | near zero | DevTools Performance, and the paused-frames check in `scripts/measure-startup.mjs` |
| Texture memory | at most 128 MB, tracked | Sum of image sizes (width x height x 4 bytes), DevTools memory |

Original strict targets, kept for history (guide §4.1): initial JS about 300 KB, first-run art 1 to 1.5 MB, time to interactive under 2 s, texture memory about 32 MB. The relaxed numbers still catch accidents (a 5 MB library, an uncompressed 50 MB texture) without forcing tiny assets.

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
| 1K.12 3D scene in the app | 2026-10-01 | 182.5 KB including the lazy three.js scene chunk | Scene ready 3.0 s on slow 4G + 4x CPU, loading text 1.06 s. See §3.3 |
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

**Re-measured with rig v2 (2026-10-01, later the same day).** The developer rebuilt the rig (22 bones, two-box legs, split torso, 264 triangles) and the 13 clips. Same method: model 299 KB raw, **73.9 KB gzip** (was 27.9), 231 KB over the wire, scene ready **median 2.14 s** (2.11 to 2.20 s) on the slow profile, phases: entry 0.38 s, model bytes in 1.31 s, three.js code 1.82 s, first draw 2.14 s. 0 frames while paused. 292 triangles and 24 draw calls with the room. The animation data (22 bones x 3 channels x 13 clips, all keyed) is most of the size. `gltf-transform optimize --compress meshopt` (scratch run) brings the file to 215 KB raw and **31.8 KB gzip**, which would bring the model back to about 0.9 s on this profile. Worth doing at 1K.6, not needed to meet the budgets.

Findings against the budgets (`docs/PLAN.md` Part 1K): the 3D ferret passes the relaxed budgets (section 1) with a very wide margin: about 182 KB gzip of 1 MB for JS, under 0.1 MB of 10 MB for the model, 1.9 to 2.1 s of 5 s for scene ready. Tighter values were suggested on 2026-10-01 and the developer chose the relaxed ones instead, because size is not a main concern any more.

### 3.3 The real app with the 3D ferret, 2026-10-01 (Part 1K.12)

`node scripts/measure-startup.mjs 5 app` builds the app and loads `/?pet=measure` on the same slow profile as §3.1 and §3.2 (1.6 Mbps, 150 ms, 4x CPU, cache off, gzip like GitHub Pages, software WebGL).

| Measure | Result | Budget (section 1) |
|---|---|---|
| Initial JS including the lazy 3D scene chunk, gzip | **182.5 KB** (app 24.2 KB + three.js scene 158.9 KB) | 1 MB |
| Model file | 299 KB raw, **73.9 KB gzip** | first-run assets 10 MB |
| Over the wire for a first visit | 260.7 KB | n/a |
| Loading text visible, slow 4G + 4x CPU | **1.06 s** | under 1.5 s |
| Scene ready (3D canvas up, loading text gone), slow 4G + 4x CPU | **median 3.0 s** (2.93 to 3.06 s) | at most 5 s |
| Scene ready, no throttle | median 0.4 s | n/a |

How the start-up is arranged: `src/main.tsx` starts the model download and the lazy `scene3d` chunk at once, so the two overlap each other and the app's own boot. Before that change the scene was ready at 3.7 s. `Stage.tsx` shows the loading text until the scene is ready, or a plain message when WebGL is missing or the download fails.

Smoke test (`npm run smoke`) passes in real Chrome. Frame rate is not measured here (software rendering). A real low-end Android check is still task 1J.4.

### 3.4 The real app at the end of Part 1L (make it a game), 2026-10-01

Same method as §3.3, after the touch room, 17 clips, tunnel and furniture, gifts, shop, outfits, decorations, and tricks.

| Measure | Result | Budget (section 1) |
|---|---|---|
| Initial JS including the lazy 3D scene chunk, gzip | **196.8 KB** (app 36.4 KB + three.js scene 160.4 KB) | 1 MB |
| Model file | 385 KB raw, **92.3 KB gzip** (17 clips) | first-run assets 10 MB |
| Over the wire for a first visit | 294.1 KB | n/a |
| Loading text visible, slow 4G + 4x CPU | **0.97 s** | under 1.5 s |
| Scene ready, slow 4G + 4x CPU | **median 2.8 s** (2.75 to 2.85 s, five runs) | at most 5 s |
| Scene ready, no throttle | median 0.31 s | n/a |

The shop, the album, the tricks sheet, and the outfit and decoration looks cost about 14 KB gzip of app code together. They are not a lazy chunk (the plan said they might be): they are small, and a second request would cost more than it saves on a slow link. Frame rate and idle CPU on a real low-end phone are still task 1J.4; the render loop is unchanged (on demand, paused when hidden, 10 frames a second asleep).

## 4. Decisions made to stay within budget

| Date | Decision | Reason |
|---|---|---|
| 2026-09-30 | Preact 11 instead of React | Few KB instead of tens (guide §3). |
| 2026-09-30 | Checksum is FNV-1a, not SHA-256 (proposed D3) | No crypto dependency or async work for saves. |
| 2026-09-30 | Placeholder rig drawn in code | 0 KB of art for Phase 1 (`ART_STYLE.md`). |
| 2026-09-30 | Canvas 2D instead of PixiJS | 116 to 144 KB gzip and about 1.2 to 1.4 s slower scene-ready under throttle (section 3.1). |
| 2026-10-01 | Size budgets relaxed to realistic app sizes (section 1) | Developer decision: size only mattered while proving the idea. Speed and smoothness budgets stay. |
| 2026-10-01 | three.js for the 3D ferret, replacing Canvas 2D (approved) | Quality over the smallest bundle. Measured cost is acceptable: 154 KB gzip lazy chunk, scene ready 1.88 s on the slow profile (section 3.2). |

## 5. Platform targets (guide §25.6)

- **Browsers:** current and previous major versions of Chrome, Edge, Firefox, and Safari, including iOS Safari.
- Features to verify against those browsers in Part 1B and record in `VERIFY_LOG.md`: IndexedDB with `navigator.storage.persist()`, `CompressionStream` (needed in Phase 4), service worker and installable PWA, `Intl.Segmenter` (name length check, `ES2022`), `prefers-reduced-motion`, `100dvh` and `env(safe-area-inset-*)`.
- **Android:** the minimum OS version and minimum WebView version are set in Phase 5. They depend on Capacitor's requirements at that time and on what low-end phones in the developer's region run (guide §25.6). Deferred because nothing native exists before Phase 5.
- Below the minimum, the app shows a plain "please update your browser or WebView" screen instead of a broken pet.

## 6. Rendering rules to protect the budgets (guide §4.4)

Render on demand and stop the loop when the pet sleeps. Pause on `visibilitychange` hidden and run the elapsed simulation on return. Cap DPR at 2. Atlases at most 2048 by 2048, no filters or blur. No per-frame allocations in hot paths. Preact never drives per-frame animation. No `setInterval` polling loops.
