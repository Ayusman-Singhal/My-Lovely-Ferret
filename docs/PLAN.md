# Project Ferret: Plan and Todo List

Source of truth for design: `PET_GAME_GUIDE_v3.md` (cited as "guide §N"). Working rules: `CLAUDE.md`.

**Current status:** Phase 1, Parts 1A to 1G done (341 tests plus the smoke test). Market research done (`docs/MARKET_RESEARCH.md`). Developer decided on 2026-10-01 to move the pet to 3D: cute blocky ferret (LandyStudio, CC-BY 4.0), clips made by the developer in Blender (`animation/`), rendered with three.js. Animation export done (13 clips, `animation/export/ferret.glb`). Part 1K.3 spike done: three.js 154 KB gzip, scene ready 1.88 s on the slow profile (`docs/PERFORMANCE.md` §3.2). Size budgets relaxed (D7). Part 1K done except the three painted coat textures (1K.9, the developer's Blender-side step 8): the real app now shows the 3D ferret (sleeping, eating, mini-game, petting all verified in Chrome, smoke test passes). Part 1L.1 to 1L.5 done (1L.5: shinies earned by care with a daily cap, a shop sheet with six outfits shown on the ferret, schema v3, not a lazy chunk (it is small); 1L.4: random gifts every 2 to 4 days, 14 items in three tiers, album in the menu, schema v2 with the first migration; 1L.3: stretch, dig, tunnel run, war dance, tail chase, four new clips, 17 in all; hide-in-box, cushion hop and dook were cut) (steering movement, planted paws, touch the room: floor call, ball throw and fetch, drag toys, window, bowls and hammock as buttons). Part 1H done (tester tools: dev panel, About my pet, feedback, error copy, iOS notice; smoke test covers them). Added Part 1L (make it a game, see below) on the developer's feedback of 2026-10-01; working on it before Part 1I. Preview URL: https://ayusman-singhal.github.io/My-Lovely-Ferret/  Dev URLs: ?pet=anything (test pet, no saving), ?speed=600 (fast time, no saving), ?debug=1.

How to use this file: take the next unchecked task in the current part, do it, tick it, update the status line above. Sizes: S (under an hour), M (a few hours), L (a day or more). Stop at the end of each part and at each phase gate.

## Decisions

Decided in the setup session (2026-09-30), from guide §3 defaults unless noted:

| # | Decision |
|---|---|
| 1 | Preact for UI (not React). |
| 2 | ~~Canvas 2D~~ replaced by **three.js** (D6, 2026-10-01). PixiJS stays removed. |
| 3 | Art: ~~layered-sprite rig animated in code~~ replaced by a blocky 3D ferret animated in Blender (D6). |
| 4 | Audience: general, 13+, minimal data collection. |
| 5 | Adoption free until Phase 6 (in-app purchase then). Closed beta is free. Free "care for a friend's pet" path always exists. |
| 6 | Fast-transfer entitlement is bought by the caretaker. |
| 7 | Owner is prompted to link a Google account before inviting anyone. |
| 8 | Pet name "Mochi" is a placeholder in examples only. Player names their own pet. |
| 9 | Item economy: shinies, Care Day milestone unlocks, cosmetic packs. |
| 10 | One mini-game (toy chase, about 20 s) plus a daily found item. |
| 11 | Up to 2 pets per device, one shown at a time. |
| 12 | Art source: the developer rigs and animates the model in Blender (`animation/`) and paints coat textures in Krita or Piskel. Style: cute blocky 3D, small warm palette (`ART_STYLE.md`). |
| 13 | Web build is a closed preview (unlisted link), not the shipped product. |
| 14 | Package manager: npm. Node 24 (`.nvmrc`). |
| 15 | Repo: public GitHub. CI: GitHub Actions. Preview hosting: GitHub Pages. |
| 16 | Git identity: the developer sets it. Claude does not change global git config. |

Open items that do not block Phase 1:

- Limited-time or extra pets (for example a blocky baby pink sheep, original art): out of the MVP (CLAUDE.md, guide §0). The rig and clip names in `animation/RIG_SPEC.md` §7 are kept species-agnostic so a new pet needs no code change. Decide at Phase 2 planning.
- **Side track R: Roblox validation (docs only, started 2026-10-01).** `ferret-game-roblox/` holds the plan, design, tech plan, build guide, and launch guide for a small Roblox version of the game, to test the idea with real testers (shared care, cute and alive, platform fit, early money signal). Published free for age-checked 16+ players and Trusted Friends, no Robux. Does not change the phases, the stack, or `src/` (workflow rule 7). The developer builds it in Roblox Studio while the Blender animations are made. Results feed back into this plan after the 2-week test (`ferret-game-roblox/01_VALIDATION_PLAN.md`).
- Hindi translator and reviewer (needed at Phase 2, guide §25.9).
- Android minimum OS and WebView version (Phase 5, guide §25.6).
- (Resolved) Pixi versus Canvas 2D: Canvas 2D, see Part 1C.

## Proposed deviations from the guide (approve or reject at the Phase 0 gate)

| # | Deviation | Detail |
|---|---|---|
| D1 | Epoch-millisecond integers for times in the save and in `core` | Guide example uses ISO strings. See `docs/SAVE_SCHEMA.md`. |
| D2 | Traits are integers 0 to 100 | Guide says 0 to 1. No floats in `core`. |
| D3 | Save checksum is FNV-1a 32-bit | Guide says "checksum". Detects corruption only. Works over plain http. Transfer bundle keeps SHA-256 (Phase 4). |
| D4 | TypeScript pinned to 6.x | TypeScript 7 is latest, but typescript-eslint 8.71 needs below 6.1. See `docs/VERIFY_LOG.md`. |
| D5 | Canvas 2D renderer instead of the guide's default PixiJS | Approved 2026-09-30 from measurements (`docs/PERFORMANCE.md` §3.1). The guide allows this fallback (§3 Open Decision 2). |
| D6 | three.js 3D ferret instead of Canvas 2D (replaces D5) | Approved 2026-10-01: quality over the smallest bundle. Spike numbers in `docs/PERFORMANCE.md` §3.2. Pet model: LandyStudio's ferret, CC BY 4.0, animated in Blender (`animation/`) |
| D7 | Size budgets relaxed to realistic app sizes | Approved 2026-10-01: initial JS 1 MB gzip, first-run assets 10 MB, scene ready 5 s on slow 4G + 4x CPU. Supersedes the numbers in guide §4.1. Speed and frame-rate budgets stay |
| R1 | Simulation RNG seeded per 10-minute step, from petId and the step start time | Refines "seed from petId + lastSimulationTime" so chunked and one-shot runs give the same result. Not a change of intent. |

## Phase 1 gate pass criteria (proposed, developer confirms at Phase 1 start)

- About 10 testers try the hosted link.
- At least 6 of 10 reopen it the next day.
- Most describe the pet as alive or cute without being prompted.
- Budgets from guide §4 met or consciously adjusted, with numbers in `docs/PERFORMANCE.md`.
- One real low-end Android check done before the art style is locked.

---

# Phase 0: Setup and decisions

## Part 0A: Project memory and todo list

- [x] 0A.1 (S) Write `CLAUDE.md` at the repo root.
- [x] 0A.2 (S) Write this file, `docs/PLAN.md`.
- [x] 0A.3 (S) Commit 0A files together with 0B (needs git identity, see 0B.12).

## Part 0B: Repo and tooling

- [x] 0B.1 (S) `git init -b main`. Add `.gitignore`, `.gitattributes` (`* text=auto eol=lf`), `.editorconfig`, `.nvmrc` (24).
- [x] 0B.2 (S) Check latest stable versions with `npm view`. Log them in `docs/VERIFY_LOG.md`.
- [x] 0B.3 (S) Write `package.json` (scripts, engines). Install `preact`, and dev tools `vite`, `@preact/preset-vite`, `typescript`, `vitest`, `eslint`, `@eslint/js`, `typescript-eslint`. No Pixi yet. No Prettier. No size-limit.
- [x] 0B.4 (S) `tsconfig.json` (strict, `noUncheckedIndexedAccess`, Preact JSX) and `tsconfig.core.json` (only `src/core`, no DOM lib).
- [x] 0B.5 (S) `vite.config.ts` (Preact preset, `base` from `BASE_PATH`, manifest on, Vitest node environment).
- [x] 0B.6 (M) `eslint.config.js`: `src/core` purity rules (imports, globals, banned `Math`/`Date` members, `**`), and the static-Firebase-import ban outside `src/sync/firebase`.
- [x] 0B.7 (S) `index.html`, `src/main.tsx`, `src/ui/App.tsx`, `src/ui/app.css`: portrait phone frame with placeholder text.
- [x] 0B.8 (S) `src/core/rng.ts` (mulberry32 with `Math.imul`, integer helpers) and `src/core/rng.test.ts`.
- [x] 0B.9 (S) `scripts/check-budgets.mjs` and `scripts/budgets.json` (initial JS gzipped at most 300 KB).
- [x] 0B.10 (S) Run `npm run check`. All green. Record baseline size.
- [x] 0B.11 (S) Guard proofs, each reverted afterward: forbidden import in core fails lint, `Math.random()` in core fails lint, `document` in core fails typecheck, 1 KB budget fails `npm run size`.
- [x] 0B.12 (S) Commit (needs git identity).

## Part 0C: CI and hosting

- [x] 0C.1 (S) Verify current GitHub Actions versions (checkout, setup-node, upload-pages-artifact, deploy-pages). Log in `docs/VERIFY_LOG.md`.
- [x] 0C.2 (S) `.github/workflows/ci.yml`: on push and PR run `npm ci` then `npm run check`. Deploy job on `main` push only, with `BASE_PATH` set from the repo name.
- [x] 0C.3 (S) Verify current GitHub Pages limits and terms for free accounts. Log them.
- [x] 0C.4 (S) Commit.
- [x] 0C.5 (developer) Create an empty public GitHub repo, give Claude the URL.
- [x] 0C.6 (S) `git remote add origin <url>` (done, origin = github.com/Ayusman-Singhal/My-Lovely-Ferret). **First push needs developer OK, still pending.**
- [x] 0C.7 (developer) Settings, Pages, Source = GitHub Actions. (Pages was already enabled: first deploy passed.)
- [x] 0C.8 (S) After push: confirm Actions run is green and the Pages URL serves the app. (Run 36725417130: check and deploy green. https://ayusman-singhal.github.io/My-Lovely-Ferret/ returns 200 with the /My-Lovely-Ferret/ base path.)

## Part 0D: Phase 1 spec docs

- [x] 0D.1 (M) `docs/GAME_DESIGN.md`: needs and rates in integer hundredths per 10-minute step, floors, sleep and wake thresholds, happiness baseline, interaction effects, bond diminishing returns, core loop, toy-chase mini-game, onboarding flow, name rules, coats.
- [x] 0D.2 (M) `docs/PET_BEHAVIOR.md`: PetAI states, integer weights from traits, needs, time of day, and furniture, history event catalog, welcome-back summary rules, daily found item.
- [x] 0D.3 (M) `docs/SAVE_SCHEMA.md`: v1 types, tester counters, checksum, IndexedDB two-slot atomic write and fallback, migration chain, export format (no `installId`), import validation.
- [x] 0D.4 (S) `docs/ART_STYLE.md`: soft flat vector, 360 by 640 logical viewport at 2x, DPR cap 2, palette, outline rule, rig parts and pivots, coats as tints.
- [x] 0D.5 (S) `docs/ART_ASSET_LIST.md`: rig parts, Phase 1 animations, props, room, UI icons, with a size column.
- [x] 0D.6 (S) `docs/PERFORMANCE.md`: budgets from guide §4, measurement method, Phase 0 baseline, platform targets (guide §25.6).
- [x] 0D.7 (S) `docs/ASSET_LICENSES.md` (empty table and rules) and finish `docs/VERIFY_LOG.md`.
- [x] 0D.8 (S) Commit.

## Part 0E: Phase 0 gate

- [x] 0E.1 (S) Tick every Phase 0 task. Update the status line.
- [x] 0E.2 (S) Report to the developer: files created, measured bundle size, deviations from the guide.
- [x] 0E.3 **Gate:** developer approved on 2026-09-30 ("yes proceed"). Deviations D1 to D4 and R1 accepted. Phase 1 gate criteria confirmed as proposed. Phase 1 started.

---

# Phase 1: Browser visual prototype (single-player vertical slice)

Goal (guide §20): open the page and feel like a little creature lives there. One room, one ferret, five interactions (tap/pet, feed, water, play with one toy, sleep). Every part ends in something runnable and testable. Details of each part are refined at the start of that part.

## Part 1A: Core foundation (pure TypeScript)

- [x] 1A.1 (S) Fixed-point helpers (`fixed.ts`), tuning constants (`tuning.ts`).
- [x] 1A.2 (S) Time helpers and clocks (`time.ts`): owner-offset local minute and date, hour classes, manual clock, session clock with backward-jump handling (guide §7.3).
- [x] 1A.3 (M) Types (`types.ts`), name validation (`name.ts`).
- [x] 1A.4 (M) Pet creation from a pet id seed (`pet.ts`), fixed draw order, pinned by a test.
- [x] 1A.5 (L) `simulate(record, nowMs)` in 10-minute steps (`simulate.ts`): decay, sleep pattern, floors, 30-day cap, memorable events.
- [x] 1A.6 (S) Derived mood (`mood.ts`).
- [x] 1A.7 (M) Tests: one hour, one day, 30 days, cap, sleep recovery, floors, negative elapsed, determinism, chunk invariance, sleep-pattern guards (78 tests).
- [x] 1A.8 (S) Tune the sleep pattern from measurements and record it in `docs/GAME_DESIGN.md` §3.3.

## Part 1B: Save

- [x] 1B.1 (M) Save schema v1 and migration chain skeleton (`docs/SAVE_SCHEMA.md`).
- [x] 1B.2 (M) `SaveStore` interface and IndexedDB implementation (atomic write, verify, swap, one previous version, checksum, fallback if corrupt).
- [x] 1B.3 (S) `installId` creation and storage (same IndexedDB in browser, never in exports).
- [x] 1B.4 (M) Export backup and Import (validates checksum and schema). `navigator.storage.persist()`.
- [x] 1B.5 (M) Tests: migrations, corrupt-file fallback, atomic write, export and import round trip.
- [x] 1B.6 (S) Wire-up done in Part 1G and covered by the smoke test in real Chrome (reload keeps the pet, export works).

## Part 1C: Renderer spike (decided: Canvas 2D)

- [x] 1C.1 (M) Same scene built twice, PixiJS 8.21.0 and Canvas 2D (`src/render/canvasScene.ts` kept), verified in real Chrome with screenshots.
- [x] 1C.2 (S) Measured gzip size and scene-ready time under slow 4G plus 4x CPU. Recorded in `docs/PERFORMANCE.md` §3.1.
- [x] 1C.3 (S) **Decision: Canvas 2D** (developer approved 2026-09-30). PixiJS 116 to 144 KB gzip, scene ready about 1.8 to 2.0 s throttled, against 1.4 KB and 0.6 s. PixiJS removed. Recorded as deviation D5 (allowed fallback, guide §3 Open Decision 2).
- [x] 1C.4 (M) Render-on-demand loop with pause when hidden, frame cap for low-power mode, DPR cap 2 (`src/render/loop.ts`, 10 tests).
- [x] 1C.5 (S) Done in 1K.3 (3D pivot): `scripts/measure-startup.mjs` measures size, ready time under throttle, and frames drawn while paused (0). Original text: later, at Part 1J: a reusable startup-time measurement script under `scripts/` (the spike used a throwaway one), and a real-browser check that a settled loop uses no frames.

## Part 1D: Placeholder rig and animations

- [x] 1D.1 (L) Layered rig drawn in code with pivots (`src/render/ferretDraw.ts`, `pose.ts`): body, head, two ears, tail (2 segments), four legs, eyes, mouth, carried item. Verified in real Chrome (`node scripts/shots.mjs`).
- [x] 1D.2 (L) Code-driven animations (`animations.ts`, `animator.ts`): idle (breathing, ear twitch), blink, walk, run (zoomies), sniff, curious, sleep, eat, drink, sneak (steal), and the reactions happy, annoyed, surprise. Blending between clips, reactions over a base clip, frame-rate hints (sleep 10 fps).
- [x] 1D.3 (S) Coat palettes as tints (`coats.ts`): sable, cinnamon, albino, panda.
- [x] 1D.4 (M) Room, scene, and a TEMPORARY demo brain (`room.ts`, `scene.ts`, `demoBrain.ts`) so the preview page shows a living ferret. The demo brain is deleted in Part 1E. Dev-only rig gallery at `/dev/gallery.html` (not in the production build).
- [x] 1D.5 (M) 88 render tests: pose limits, smoothness at 60 fps, loops, one-shots end at rest, blink rate and length, no pops when switching clips, draw calls balanced and finite.

## Part 1E: PetAI (autonomous behavior)

- [x] 1E.1 (M) Behavior scoring and weighted choice with integer utility weights from traits, needs, time of day, and the room (`src/core/petAI.ts`, 22 tests). Cooldowns, needs-first rule, dev `forceDecision` hook.
- [x] 1E.2 (M) Personality shows in behavior: guarded by tests over 1000 decisions (steal 137 against 0, playful 219 against 145). Weights retuned after the first version showed no playful difference; see `docs/PET_BEHAVIOR.md` §3.
- [x] 1E.3 (S) Steal is logged as a history event and starts the 12 hour cooldown (`completeBehavior`). Simulation steals and PetAI steals are kept separate so nothing is counted twice.
- [x] 1E.4 (M) Render brain (`src/render/plan.ts`, `brain.ts`): turns decisions into walking and animation steps, keeps the simulation current while the app is open, moves the pet to the hammock to sleep and back up when it wakes, carries the sock. Temporary demo brain deleted. Preview options `?pet=`, `?speed=`, `?debug=1`.
- [x] 1E.5 (S) Temporary always-stocked bowls and `eatingSatisfiesNeeds` removed in Part 1F: bowls are filled by the feed and water commands and emptied by the pet.

## Part 1F: Interactions and mini-game

- [x] 1F.1 (M) Command layer (`src/core/commands.ts`): FeedPet, GiveWater, PetTouch, StartPlay, FinishPlay, PutToBed. Validated, simulated to now first, then applied. Unknown or malformed commands are dropped. 26 tests.
- [x] 1F.2 (M) Effects, cooldowns, bond diminishing returns (100, 50, 0 and so on per type per local day), 30 minute play reward cooldown, refusals, and feed, water, and play waking a sleeping pet in one action (`docs/GAME_DESIGN.md` §4).
- [x] 1F.3 (L) Toy-chase mini-game: pure logic (`src/core/toyChase.ts`), pointer input, toy and timer drawing, result band into FinishPlay. Touch classification for pet sessions (`src/core/touch.ts`).
- [x] 1F.4 (M) Game controller (`src/game/controller.ts`) joining commands, brain, mini-game, and touch, with 15 tests. Verified by playing it in real Chrome: feed, water, play (10 catches, band 3), bed, tap to wake.
- [x] 1F.5 (S) Temporary test bar (Feed, Water, Play, Bed) in `App.tsx`. Replaced by the real HUD and action bar in Part 1G.

## Part 1G: UI and saving

- [x] 1G.1 (M) HUD (`Hud.tsx`: icon, label, number, level word, and bar length per need, low shown with stripes and bold, never color alone) and action bar (`ActionBar.tsx`: Feed, Water, Play, Sleep, at least 44 px, first-time hint marked by a ring and a dot).
- [x] 1G.2 (M) First-run flow (`Onboarding.tsx`): adopt, name (1 to 16 grapheme clusters, trimmed, clear errors), a short personality introduction, then home. "Care for a friend's pet" is present and disabled.
- [x] 1G.3 (M) Welcome-back summary (`summary.ts`, dialog): sleep hours, up to 3 notable events newest first, a mood line. Warm, never mentions how long the player was gone.
- [x] 1G.4 (S) `t()` helper and `en.json` (`src/i18n`). A test checks every key used in the UI exists. Hindi in Phase 2.
- [x] 1G.5 (S) Portrait layout with safe areas, 44 px targets, screen reader announcements in an `aria-live` region (only real transitions), text scale ready, reduced motion for the interface.
- [x] 1B.6 (S) Save wired: debounced autosave, save when the page is hidden, persistent storage request, backup export and import in the menu, recovery screens for a damaged or too-new save, play without saving when IndexedDB is unavailable.
- [x] 1G.6 (M) End-to-end smoke test in real Chrome (`npm run smoke`, also in CI): 10 steps including a reload that keeps the pet, a backup with no install id, and a summary after 8 hours away.
- [x] 1G.7 (S) Room resized from 360 by 640 to 360 by 540 so the pet fills the screen width between the bars.

## Part 1K: 3D pivot (inserted 2026-10-01, runs before 1H)

Why: the developer decided quality now outranks the smallest bundle, and a flat 2D ferret will not satisfy users (`docs/MARKET_RESEARCH.md` §5). Look: **cute blocky** (changed from stylized-real on 2026-10-01 after the developer picked the model below). Clips: made by the developer in Blender. This replaces decision D5 (Canvas 2D) once the spike numbers are approved. The logical 360 by 540 room stays; the 3D scene maps it to a floor plane, so `src/core`, `src/game`, `src/ui`, `brain.ts`, `plan.ts`, and `loop.ts` stay as they are.

Budgets (decision D7, 2026-10-01): initial JS 1 MB gzip including the three.js chunk, first-run assets 10 MB, loading screen under 1.5 s and scene ready at most 5 s on slow 4G + 4x CPU, texture memory 128 MB, rig limits in `animation/RIG_SPEC.md` §6. The developer's Blender instructions are in `animation/` (README, RIG_SPEC, CLIPS, BLENDER_GUIDE, clips.json).

- [x] 1K.0 (S) `docs/MARKET_RESEARCH.md` written, proposals A1 to A11 and C1 to C4 recorded there as pending.
- [x] 1K.1 (S) Verify and log in `docs/VERIFY_LOG.md`: three.js version and gzip cost with GLTFLoader and skinning, WebGL on target browsers and Android WebView, gltfpack and meshopt options (WebP textures, not KTX2), Sketchfab license terms (CC-BY attribution, "NoAI" tag, no NC or ND).
- [x] 1K.2 (S) Model chosen 2026-10-01: "Black Footed Ferret" by LandyStudio, CC-BY 4.0, 132 triangles, no rig, no animations (checked through the Sketchfab API). Recorded in `docs/ASSET_LICENSES.md`. Still to do: CC0 room furniture (Kenney, Quaternius) at 1K.8.
- [x] 1K.3 (M) Done 2026-10-01: `dev/ferret3d.html`, `src/dev/ferret3d.ts`, `src/dev/ferret3dScene.ts`, `vite.spike.config.ts`, `scripts/measure-startup.mjs`. Dev-only spike page: three.js, GLTFLoader, meshopt, the ferret in a box room. Reusable startup measurement script in `scripts/` (closes 1C.5). Record numbers in `docs/PERFORMANCE.md` §3.2.
- [x] 1K.4 (developer) Done 2026-10-01: the developer said size is no longer a main concern, so the budgets are relaxed (D7). `three` moved to `dependencies`, `scripts/budgets.json` set to 1000 KB.
- [x] 1K.5 (S) Done 2026-10-01 (animation pipeline doc is `animation/BLENDER_GUIDE.md`).  Update CLAUDE.md, this file (decision D6), `ART_STYLE.md`, `ART_ASSET_LIST.md`, `ASSET_LICENSES.md`. Add `docs/ART_PIPELINE_3D.md` (Blender export rules and clip names).
- [x] 1K.6 (L) Done 2026-10-01: `src/render/scene3d.ts` (lazy chunk) behind `PetScene` (`petScene.ts`), `stageMap.ts` maps the logical room to the floor and back (tested), touches are raycast onto the vertical plane through the pet. The controller gives it `props()`; `Stage.tsx` loads it, shows loading and error text.
- [x] 1K.7 (M) Done 2026-10-01 (inside `scene3d.ts`): `AnimationMixer`, 0.2 s cross-fades, additive one-shots, blink timing from `blink.ts`, playback speed from the pet's real speed (`clipSpec.ts` `playbackRate`). `clipSpec.test.ts` checks the real `.glb` against `animation/clips.json`.
- [x] 1K.8 (M) Done 2026-10-01. Room and props in 3D: baked lighting, blob shadow, no real-time shadows.
- [ ] 1K.9 (S) Four coat textures, only the pet's own loaded. **Partly done:** a colour tint per coat stands in (`coats3d.ts`); the three painted textures are the developer's step 8 in `animation/README.md`.
- [x] 1K.10 (M) Done 2026-10-01. Loading screen, plain WebGL-unavailable screen (no 2D fallback), pointer input through the raycast.
- [x] 1K.11 (M) Done 2026-10-01: smoke and shots updated, `dev/ferret3d.html` is the clip viewer, 280 tests pass (the 2D rig tests were removed with the rig).
- [x] 1K.12 (S) Done 2026-10-01: 2D rig deleted. Real-app numbers in `docs/PERFORMANCE.md` §3.3. Measure, record in `docs/PERFORMANCE.md`. Report at the end of the part.

Developer track (parallel): Blender work following `animation/BLENDER_GUIDE.md` (written in 1K.2, replaces the planned `ART_PIPELINE_3D.md`). Clips named `idle`, `walk`, `run`, `sniff`, `curious`, `sleep`, `eat`, `drink`, `sneak`, `happy`, `annoyed`, `surprise`, `blink`. Until they exist the game plays the rest pose, so code work is not blocked. The Phase 1 gate waits on the clips.

## Part 1L: Make it a game (added 2026-10-01, runs after 1H and before 1I)

Why: the developer played the live preview and said the movement is off (feet slide or float, pace wrong, not much going on), the neck made the ferret look malnourished (fixed 2026-10-01 in `animation/scripts/make_chubby.py`), and "it's still a very simple game with not much to do". Research on other apps (`docs/MARKET_RESEARCH.md` §6) says what carries a pet game is a pet that moves freely and feels alive, things to do with it, and a home to decorate. This part pulls the first Phase 2 items forward, on the developer's choice of 2026-10-01: touch the room, a livelier ferret, **occasional** gifts with a collection (not daily), shinies with a shop and decorating, and tricks. Rules stay: no timers, no punishment, no ads, care always free, no new network use. Each task ends with something runnable and a smoke-test step. The Phase 1 gate (testers) still comes after this part.

- [x] 1L.1 (M) Movement polish. Steering: the pet turns at a limited rate and moves along its facing, so it never strafes; pace retuned (walk 46, run 150, sneak 26 px/s); verify against the clips' ground speeds with a foot-slide test; unit tests.
- [x] 1L.2 (M) Touch the room. Tap the floor and the ferret comes to you (a ring marks the spot). Tap the ball to throw it and the ferret fetches it back. Drag the ball and the sock around. Tap the window and it looks out. Tapping a bowl or the hammock does what Feed, Water, or Sleep does. Controller and scene input only: no new core rules. Done without the bond credit for fetch (cut: the existing care rules stay the only source of bond).
- [x] 1L.3 (L) A livelier ferret. New things it does by itself, with the room: dig at the rug, run through a tunnel, hide in a box, hop on the cushion, stretch and yawn, war dance, dook, chase its own tail. Needs new furniture (a tunnel, a box) in `scene3d.ts`, new behaviors in PetAI (`docs/PET_BEHAVIOR.md`), and new clips made in Blender (`animation/scripts/animate.py`): `stretch`, `dig`, `warDance`, `dook`, `tailChase`. Clip names added to `animation/clips.json` and `CLIPS.md`.
- [x] 1L.4 (M) Occasional gifts and a collection. Replaces the daily found item (`docs/GAME_DESIGN.md` §3.5): the ferret now brings a gift now and then, on average every 2 to 4 days, never on a schedule the player can miss. A collection album (in the menu) shows what has been found, first-found dates, and silhouettes of what is still out there. Core: new rule in `simulate` (deterministic), new items, save schema migration.
- [x] 1L.5 (L) Shinies and the shop. Shinies earned by caring, playing, and finding gifts (daily cap), never bought, never needed for survival (guide §14). A shop screen (lazy chunk) sells outfits (bow, hat, scarf, collar) shown on the ferret and cosmetic room items. Save schema migration for `inventory`. The Roblox money test stays separate.
- [ ] 1L.6 (L) Decorating. Wall and floor skins, and a few furniture slots the player can fill from what they own. Portrait touch UI.
- [ ] 1L.7 (M) Bond tricks. Bond milestones unlock tricks the ferret does on request or by itself (sit up, roll over, war dance). Ties 1L.3 clips to progress. Small history lines for milestones.
- [ ] 1L.8 (S) Docs, smoke-test steps for every new thing, measure with `scripts/measure-startup.mjs`, and report at the end of the part.

Cut first if time runs short: 1L.6, then 1L.7. Do not cut 1L.1 to 1L.3: they are what makes the game feel alive and give the tester something to do.

## Part 1H: Tester tools

- [x] 1H.1 (M) Done 2026-10-01 (`DevPanel.tsx`, `devTools.ts`). Dev panel (clock control through the single time source, seed override, need setters, behavior trigger, save inspector). Excluded from production or behind a hidden gesture.
- [x] 1H.2 (S) Done 2026-10-01 (`AboutDialog.tsx`, `aboutPet.ts`). Local tester counters and an "About my pet" screen (guide §25.3).
- [x] 1H.3 (S) Done 2026-10-01 (`FeedbackDialog.tsx`, `feedback.ts`). One-tap feedback (`mailto:` or a free form) including the counters.
- [x] 1H.4 (S) Done 2026-10-01 (`errorReport.ts`, `Notices.tsx`). `window.onerror` handler with "copy error details".
- [x] 1H.5 (S) Done 2026-10-01 (`ios.ts`, `Notices.tsx`). iOS Safari outside an installed PWA: "Add to Home Screen, and export a backup" message.

## Part 1I: PWA

- [ ] 1I.1 (M) Service worker with versioned cache and "Update available" prompt (never mid-interaction).
- [ ] 1I.2 (S) Web manifest and icons.
- [ ] 1I.3 (S) Save migrations run before the new UI loads. A failed migration keeps the old save and offers Export.

## Part 1J: Measure, host, gate

- [ ] 1J.1 (M) Measure bundle, first-run art, time to interactive (throttled), fps under 4x CPU throttle, idle CPU, texture memory. Record in `docs/PERFORMANCE.md`.
- [ ] 1J.2 (S) Deploy to GitHub Pages. Share the link.
- [ ] 1J.3 (developer) Play it. Ask 5 to 10 testers to try it.
- [ ] 1J.4 (developer) One real low-end Android check before art style is locked.
- [ ] 1J.5 **Gate:** report built, tested, measured, deviations. If the pet is not fun, iterate on the pet, do not continue.

---

# Later phases (coarse, guide §20; detailed at each phase start)

## Phase 2: Complete single-player

Groom, clean and room mess, customization (clothes, toys, furniture), shinies economy, history screen, passport and share card, accessibility basics, English and Hindi. Gate: stable for a week of daily use, budgets still met.

## Phase 3: Shared care (Firebase mailbox)

Firebase project (Spark only), anonymous auth, `Mailbox` with `FirebaseMailbox` and `MemoryMailbox`, emulator, security rules with tests, lazy loading. Invite, claim, approve with QR and typed code. Commands, `validateCommand`, owner apply loop. Outbox, caretaker predicted view, sync-status UI. Budget manager, sync levels, Remote Config, debug usage screen. App Check evaluation. Gate: two browser profiles pair, caretaker cares while the owner's tab is closed, write count per pair per day measured, Firebase stays out of the initial bundle.

## Phase 4: Care Days, bond, ownership, recovery

Care Days with anti-cheat, milestones, transfer protocol, epoch and tombstone logic, Google account linking, reclaim flow, "Protect Mochi" step. Gate: all ownership tests pass, including race and interruption tests.

## Phase 5: Native packaging (Capacitor, Android first)

Native `SaveStore`, notifications, share sheet, camera scanning, back button and safe areas, platform backup (with `installId` outside the backup), native Google sign-in. Measure on real Android, including a low-end phone. Gate: native matches browser behavior and meets budgets.

## Phase 6: Monetization

IAP spike first. Adoption IAP, transfer entitlement, cosmetic packs, restore purchases, shop. Gate: purchase test matrix passes.

## Phase 7: Release preparation

Performance pass, accessibility pass, privacy policy, account deletion, store listing and policy review, closed beta. Gate: MVP definition of done (guide §23).
