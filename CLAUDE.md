# Project Ferret

A web-first virtual pet game. One person adopts a ferret and can share its care with one other person, who may eventually become the permanent owner. Core promise: **raise one pet with someone you care about.**

Stack: TypeScript, Vite, Preact, three.js for the 3D ferret (Blender model and clips in `animation/`), Vitest, Playwright (`playwright-core` driving the installed Chrome). Zero-cost Firebase Spark "mailbox" for shared care (Phase 3 onward, lazy-loaded). Capacitor wraps the same code as an Android app (Phase 5).

`PET_GAME_GUIDE_v3.md` is the source of truth. Cite its sections (for example "guide §10.6") in code comments, docs, and reports. If the guide and this file disagree, ask the developer.

## Workflow

`docs/PLAN.md` is the todo list. Follow it.

1. Read the "Current status" line at the top of `docs/PLAN.md`, then take the next unchecked task in the current part.
2. Do the task. Tick it `[x]` and update the status line in the same change.
3. Commit at logical points, in small commits with clear messages.
4. Stop at the end of each **part** with a short report (what was done, what was tested, what is next).
5. Stop at each **phase gate** (guide §20). Report what was built, what was tested, measured bundle and performance numbers, and any deviations from the guide. Wait for the developer's go-ahead. Never start the next phase without it.
6. Do not write game code before Phase 0 is approved. Tests come with code. Ownership logic gets tests before any cosmetics.
7. If a task turns out bigger or different than planned, edit `docs/PLAN.md` first, tell the developer, then continue.

The developer is a solo developer with no budget. Cut scope before adding it.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | `tsc` on the app and, separately, on `src/core` with no DOM types |
| `npm run lint` | ESLint, including the `src/core` purity rules |
| `npm test` | Vitest (node environment) |
| `npm run size` | Bundle budget check. Fails when a budget in `scripts/budgets.json` is exceeded |
| `node scripts/shots.mjs` | Screenshots of the dev rig gallery and the running app into `shots/` (uses installed Chrome). Look at them after changing the rig or layout |
| `npm run smoke` | End-to-end test in real Chrome against the built app (run `npm run build` first): first run, naming, care, mini-game, reload, backup, welcome-back. Takes about 40 seconds |
| `npm run check` | typecheck, lint, test, build, size. Run before every commit that changes code |

## Layout (guide §18)

```text
src/core/      pure TypeScript. Simulation, personality, bond, care days, ownership state machine,
               command validation, seeded RNG, save schema and migrations, PetAI
src/sync/      Mailbox interface, MemoryMailbox, Outbox, BudgetManager
  firebase/    FirebaseMailbox (dynamic import only)
src/platform/  SaveStore, PurchaseService, Notifications, Share, Camera (web/ and capacitor/)
src/game/      controller: joins commands, brain, mini-game, and touch (no DOM, no drawing)
src/render/    Canvas 2D scene, room, pet rig, particles, render-on-demand loop, asset loader
src/ui/        Preact components (HUD, menus, shop, passport, settings)
src/i18n/      t() helper, en.json, hi.json
public/        atlases, audio, icons, manifest, service worker
docs/          PLAN, GAME_DESIGN, PET_BEHAVIOR, SAVE_SCHEMA, ART_STYLE, ART_ASSET_LIST,
               ASSET_LICENSES, PERFORMANCE, VERIFY_LOG (later: SYNC_PROTOCOL, OWNERSHIP_SPEC, IAP_SPEC, PRIVACY)
firebase/      firestore.rules, indexes, rules tests (Phase 3)
scripts/       build-time helpers such as check-budgets.mjs
```

Create folders when they are first needed, not before.

## Engineering rules (guide §18, enforced where possible)

- **`src/core` is pure.** No imports from `render/`, `ui/`, `platform/`, `sync/`, `preact`, `pixi.js`, or `firebase`. No DOM or browser globals (`window`, `document`, `navigator`, `performance`, `localStorage`, `indexedDB`). ESLint and `tsconfig.core.json` (no DOM lib) both enforce this.
- **Deterministic simulation.** `simulate(state, elapsed, seed)` gives the same result on every device (guide §7.2). Use only basic integer arithmetic. Never use `Math.random`, `Math.sin`, `Math.exp`, `Math.pow`, `**`, or `Date.now` in `src/core`. Use the seeded integer RNG (mulberry32 with `Math.imul`). Time is passed in, never read.
- **Fixed-point needs.** Needs and bond are integers in hundredths (0 to 10000). Convert to 0 to 100 only for display.
- **Time zone.** Simulation uses the owner's stored `tzOffsetMin`, never the device's local zone.
- **Firebase only through `Mailbox`,** and only via dynamic `import()` from `src/sync/firebase/`. The initial bundle never contains Firebase.
- **Single-player never touches the network.**
- **The renderer owns per-frame animation.** Preact never drives it. The renderer reads game state through a small subscription. Render on demand, and pause the ticker when the page is hidden. No `setInterval` polling.
- **The UI never mutates canonical pet state.** It goes through the command layer. The caretaker sends commands, never state.
- **Ownership transitions are explicit and atomic** (guide §13). Every network message carries a protocol version and an epoch.
- **Saves are versioned** with a migration chain from the first release, written atomically, and checksummed.
- **Purchase entitlement logic is separate from ownership logic.**
- **Text.** All UI strings go through `t()`. No text in the canvas. No text baked into images.
- **Input and layout.** Pointer events only, never hover. Touch targets at least 44 px. Portrait phone layout first. Never encode state by color alone.

## Hard constraints

- **Never enable Firebase Blaze billing. Never add Cloud Functions, Cloud Storage, Cloud Run, or any paid service.** If a feature seems to need one, stop and ask the developer.
- **Every dependency earns its place.** It must be maintained, permissively licensed, and save real work. Download size is no longer a main concern (decision 2026-10-01), but look at the size impact so nothing balloons by accident. Prefer a small helper over a library when the helper is simple. Avoid lodash, date libraries, UI kits, CSS frameworks, and heavy i18n libraries, mainly for the complexity they add (guide §4.6).
- **Budgets fail the build.** Size budgets are realistic, like other apps (decision 2026-10-01, supersedes the numbers in guide §4.1): initial JS gzipped at most 1 MB including the 3D scene, first-run assets at most 10 MB. Speed and smoothness budgets stay (fast first feedback, steady frame rate, idle CPU near zero). Measured numbers go in `docs/PERFORMANCE.md` at every phase gate.
- **Free tools and permissive assets only** (CC0 or permissive). Record the license of every third-party asset in `docs/ASSET_LICENSES.md` and every asset's size in `docs/ART_ASSET_LIST.md`.
- **No secrets in the repo.** Firebase web config is public, but service accounts and signing keys are not.
- **Lockfiles are generated, never edited.** Change `package.json` and let npm regenerate `package-lock.json`.

## Dropped on purpose (guide §0)

Do not bring these back without asking the developer: Unity, C#; peer-to-peer networking (Nearby Connections, WebRTC, STUN/TURN, Cloudflare Workers signaling); device key pairs, signed events, encrypted saves; server-side purchase verification; hygiene, enrichment, and bathing as stats, `trust`, and the traits `playfulness`, `foodPreference`, `socialPreference`; a second room, and camera panning. Also out of the MVP: multiple species, chat, friends list, trading, PvP, breeding, blockchain or NFTs, AI chatbot pet, more than one caretaker, Discord bot.

## Verify before relying (guide §24)

Do not trust memory or the guide for facts that change: Firebase Spark quotas and SDK sizes, store fees and policies, Capacitor plugin support, browser storage and API support, package versions, GitHub Actions versions, free hosting limits. Check official documentation, then log the result in `docs/VERIFY_LOG.md` with the date and source URL.

## Decisions already made

- Preact (not React), with `preact/compat` only if a dependency needs it.
- Roblox is a validation prototype only (`ferret-game-roblox/`, docs, started 2026-10-01), not the shipped product. It does not change the web and Android plan. Published free for 16+ and Trusted Friends, never paid Robux, no under-16 route.
- Renderer: **three.js** (3D), decided 2026-10-01 by the developer: quality now matters more than the smallest bundle, and a flat 2D ferret would not satisfy users. Measured in the spike (`docs/PERFORMANCE.md` §3.2): 154 KB gzip lazy chunk, scene ready 1.88 to 2.14 s on slow 4G + 4x CPU. Canvas 2D (decision D5, 2026-09-30) and PixiJS are no longer used for the pet. Do not add PixiJS.
- Art: a cute blocky 3D ferret, a modified copy of "Black Footed Ferret" by LandyStudio (CC BY 4.0, credit required), rigged and animated by the developer in Blender (`animation/`), played in three.js. Room and UI keep the small warm palette (`docs/ART_STYLE.md`, to be rewritten for 3D). The 2D code-drawn rig is a placeholder until the 3D scene replaces it (Part 1K).
- Size is not a main constraint any more (decision 2026-10-01): initial phases kept everything tiny, now assets and bundles may be as large as typical apps. Keep the budgets in `docs/PERFORMANCE.md`. Speed to first feedback and smooth frame rate still matter.
- General audience, 13+, minimal data collection.
- Adoption is free until Phase 6. The closed beta is free. Web build is a closed preview, not the shipped product.
- Item economy: shinies (soft currency, earned by caring, never bought, never needed for survival), Care Day milestone unlocks, cosmetic packs. Basic food and water are always free.
- One tiny mini-game (toy chase) plus a daily "found item".
- Up to 2 pets per device, one shown at a time.
- Languages: English and Hindi, in-house `t()` helper.
- Repo and hosting: public GitHub repo, GitHub Actions CI, GitHub Pages preview. Package manager: npm.
- "Mochi" is a placeholder pet name for examples only.

## Git

- Small commits at logical points. Clear messages. Never skip hooks.
- The developer sets their own git identity. Do not change global git config.
- Ask before the first push, and before any force-push or history rewrite.

## Style

- Code reads like the code around it. Match its naming, comment density, and idiom.
- Comments explain why, and cite the guide section when a rule comes from it.
- Write tests alongside code (Vitest for `src/core`, Playwright for flows, Firestore emulator for rules).
