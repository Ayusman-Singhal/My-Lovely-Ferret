# Project Ferret: Build Guide (v3.1: web-first, light and fast, zero-cost)

A virtual pet game where one person adopts a ferret and can share its care with one other person, who may eventually become the permanent owner.

> Core promise: **Raise one pet with someone you care about.**

This guide replaces the earlier v1 plan and v2 guide, which are no longer in the repo. What changed in v3.1 (a gap-review revision of v3):

- **Sync protocol fixes:** owner write-back no longer loses caretaker commands (Section 10.6), Care Day date bounds use a rule-enforced server time (Section 12.1), commands are ordered by `seq` and applied without rewinding time (Section 10.6), `seq` is keyed by caretaker install, and the old owner and revoked caretaker can still learn what happened (Sections 10.4 and 13.3).
- **One pet, one active device:** an owner signed in on two devices can no longer fork the pet (Section 13.5).
- **Design gaps filled:** sleep, mood, trust, clean, item economy, core loop, onboarding, coat variation, and multiple pets per device (Sections 7 and 8).
- **New Section 25 (production and ops):** art plan, hosting and CI, telemetry for the Phase 1 gate, iOS storage limits, account deletion, PWA updates, platform targets, dev tooling.
- **Phase 1 now includes backup import**, not just export.
- **Merged the still-valid content of v1 and v2** (first-launch routes, screen layout and gestures, mini-game and animation lists, retention design, shop rules, history event catalog, share moments), so this guide is complete on its own. Section 0 lists what was dropped on purpose.
- **Three fixes found in that merge:** platform backup can no longer clone `installId` (Sections 8 and 13.6), transfer acceptance must be a real transaction and never a queued batched write (Section 13.3), and the soft currency is renamed "shinies" to avoid clashing with food treats.

What changed in v3 (kept for reference):

- **Web first.** Build and test everything in a desktop browser with a mobile-sized preview. Wrap it as an Android/iOS app with Capacitor only after the visuals and the game feel are proven.
- **Light and fast is a hard requirement**, with measurable budgets enforced in the build (Section 4).
- Engine changed from Unity to **TypeScript + Preact (React-compatible) + PixiJS**.
- Everything else from v2 carries over: zero-cost Firebase Spark "mailbox", local-first, owner-authoritative pet, commands not state, epoch-guarded ownership transfer, recovery as a core feature, small MVP.

---

# 0. How Claude Code should use this guide

Follow this order. Do not write game code until steps 1 to 4 are done.

1. **Read this whole guide.** It is complete on its own. Earlier versions (v1 plan, v2 guide) were deleted. Do not reintroduce anything in the "Dropped on purpose" list below.
2. **List blockers.** Check Section 3 (open decisions) and ask the developer only what blocks planning. Batch the questions into one message. Do not ask about things this guide already decides.
3. **Write `docs/PLAN.md`.** Turn Section 20 (phases) into a concrete task list with rough sizes, ordered so every phase ends in something runnable and testable.
4. **Get approval on `docs/PLAN.md`.** Then implement Phase 1 only.
5. **After each phase, stop at the phase gate.** Report what was built, what was tested, measured bundle and performance numbers, and any deviations from this guide. Wait for the go-ahead.

**Dropped on purpose from v1 and v2.** Do not bring these back without asking the developer:

- Unity, C#, and 3D art (now TypeScript, Preact, PixiJS, and a 2D layered-sprite rig).
- Peer-to-peer networking: Nearby Connections, WebRTC, STUN and TURN, and the Cloudflare Workers signaling backend (now the Firebase mailbox).
- Device key pairs, signed events, and encrypted saves (identity is the Firebase `uid`, and saves are integrity-checked but not secret).
- Server-side purchase verification (there is no server).
- Hygiene, enrichment, and bathing as stats or interactions, `trust`, and the extra traits `playfulness`, `foodPreference`, `socialPreference`.
- A second room or enclosure area (MVP has one room), and camera panning.

Working rules:

- The developer is a solo developer with **no budget**. Use free tools, free packages, and CC0 or permissively licensed assets. Record every third-party asset's license in `docs/ASSET_LICENSES.md`.
- **Never enable Firebase Blaze billing, and never add Cloud Functions, Cloud Storage, Cloud Run, or any paid service.** If a feature seems to need one, stop and ask.
- **Every dependency must justify its bytes.** Before adding a package, check its gzipped size impact (for example with the bundler's analyzer). Prefer a 20-line helper over a library.
- Facts that may have changed (Firebase quotas, SDK sizes and behavior, store fees and policies, plugin support) must be re-verified from official documentation. Section 24 lists them. Do not trust memory or this guide for them.
- Keep the simulation and ownership logic in **pure TypeScript with no DOM, React, or Pixi imports**, so it runs fast under Vitest (Section 18).
- Write tests alongside code. Ownership logic gets tests before any cosmetics are built.
- Keep commits small, at logical points, with clear messages.

---

# 1. Product vision and principles

The game should feel like owning a small digital animal, not an idle game. The pet should have a distinct personality, needs that change over time, autonomous behavior when nobody is watching, a home it affects and is affected by, a bond with its people, and a visible history.

Take inspiration from real ferret behavior (long sleeps, bursts of activity, tunnels, stashing and stealing objects, grooming, mischief) without becoming a veterinary simulator. **Use realism when it makes the pet feel alive, and drop realism that only creates chores.**

**Differentiator:** shared care of one persistent pet, ending in permanent ownership transfer.

## Principles (hard constraints)

1. **The pet is the product.** Menus, shops, and multiplayer exist to support the pet.
2. **Attachment, not anxiety.** No permanent punishment for normal inactivity. The pet never dies or is ruined by absence.
3. **One canonical pet state.** Never fork the pet into independent copies.
4. **The owner device is authoritative.** The cloud is a mailbox and a referee, not the game.
5. **Money buys ownership and expression, not survival.**
6. **The pet should surprise the player.** Personality drives behavior.
7. **No blockchain, NFTs, or crypto.**
8. **No social features before the pet is good.** Prove fun first.
9. **Local-first.** Every action works instantly and offline. The network only delivers what the other person needs to see.
10. **Zero recurring cost.** The game runs on free tiers with no payment method attached to any service.
11. **Light and fast.** Small download, instant start, smooth animation, low battery use, works on cheap phones (Section 4).

---

# 2. Hard constraints

| Constraint | Implication |
|---|---|
| Developer cannot spend money | Firebase Spark (free) only. No servers, paid plugins, or paid assets. |
| No Cloud Functions or Cloud Storage | Both need billing. Design without trusted server code. |
| Free quota is per project, per day | Sync must be sparse and budgeted (Section 11). |
| No trusted server code | Security rules are the only server-side logic. Purchases are verified on device. Friend-activity push notifications are not possible. |
| Publishing costs money | Google Play has a one-time developer fee and Apple an annual fee (verify amounts). **Android first.** iOS only when revenue covers it. The browser build is free to host and test. |
| Solo developer | One species, one room, a few excellent animations. |
| Light and fast | Enforced budgets (Section 4). A feature that breaks a budget needs a plan or gets cut. |

If Firebase's free plan changes in a way that breaks the design, the `Mailbox` interface (Section 10.1) lets the backend be swapped with a contained change.

---

# 3. Decisions

## Decided

- **Stack:** TypeScript, Vite, **Preact** (React-compatible API via `preact/compat`, a few KB instead of tens) for UI, **PixiJS** (tree-shaken, only needed modules) for the pet and room. Game logic is framework-free.
- **Packaging:** browser build first (installable PWA for testing), then **Capacitor** to wrap the same code as an Android app (iOS later). Not React Native.
- **Backend:** **Firebase Spark** with Firestore, Anonymous Auth (upgradeable), Remote Config, Crashlytics and Analytics (native builds), loaded **lazily** (Section 4).
- Pet state lives on the owner's device. Firebase holds only the pairing invite, one small shared pair document, a rarely-used transfer bundle, and the sync-level config.
- Shared care model: caretaker sends **commands**, the owner applies them (Section 10).
- Ownership transfer: guarded by a **database transaction and an ownership epoch** (Section 13).
- Launch animal: ferret. One room. Platform order: browser preview, Android, then iOS.
- Languages: English and Hindi, localization-ready from day one, using a tiny in-house `t()` helper unless a library clearly pays for its bytes.
- Notifications: local only, plus an optional owner-supplied Discord webhook post-MVP.
- No local peer-to-peer transport, no WebRTC. The mailbox replaces both.

## Open (confirm with the developer during planning)

1. **Preact or full React.** *Recommended default: Preact*, for size and speed. It is API-compatible for this use, and switching later is a bundler alias. If the developer wants literal React, that is fine, but it costs bytes (measure it).
2. **Renderer: PixiJS or plain Canvas 2D.** *Recommended default: PixiJS* (batched sprite rendering), kept only if the initial bundle stays within budget. If it does not, fall back to Canvas 2D, which is smaller but needs more hand-written rendering code. Decide with real numbers at the end of Phase 1's first week.
3. **Art approach.** *Recommended default: 2D layered-sprite rig animated in code* (body, head, ears, tail, legs as separate sprites moved by tweens, with squash and stretch and a few frame swaps such as blinking, mouth open, eyes closed). It is much smaller than full frame-by-frame animation, cheap to author with free tools, and easy to tweak. Full frame-by-frame atlases are the alternative for a few hero animations only.
4. **Audience and age.** If the game targets children under 13, COPPA and store family policies apply. *Recommended default: general audience, 13+, minimal data collection.*
5. **Free versus paid entry.** *Recommended default:* adoption is a one-time in-app purchase added late (Phase 6). The closed beta is free. The free "care for a friend's pet" path always exists.
6. **Who buys the fast-transfer entitlement.** *Recommended default:* the caretaker.
7. **Identity recovery approach.** *Recommended default:* prompt the owner to link a Google account (and Apple ID on iOS) before inviting anyone (Section 13.5).
8. **Pet name and setting.** "Mochi" is a placeholder in examples only.
9. **Item economy.** How do players get clothes, toys, and furniture without paying? *Recommended default:* a soft currency ("shinies", earned only by caring, never bought, never needed for survival) plus Care Day milestone unlocks and cosmetic IAP packs. See Section 7.8.
10. **Core loop and mini-game.** *Recommended default:* one tiny mini-game (for example a 20-second toy chase) behind `StartPlay`/`FinishPlay`, plus a daily "found item" surprise. See Section 7.8.
11. **Multiple pets per device.** *Recommended default:* the save holds a list of pets, at most 2 (one owned, one accepted through transfer while the first stays), with the UI showing one at a time. Alternative: refuse a transfer if the caretaker already owns a pet. See Section 8.
12. **Art source and style.** Who draws the ferret rig, and in what style? See Section 25.1. This is the biggest practical blocker, so decide it in Phase 0.
13. **Web build versus paid adoption.** *Recommended default:* the public web build is a closed preview for testers and is not shipped as the product. If the web build must stay public, adoption becomes optional there (cosmetic-only monetization). See Section 25.4.

---

# 4. Light and fast: budgets and rules

These are **starting targets**. Measure in Phase 1 and record the real numbers in `docs/PERFORMANCE.md`, then tighten or justify changes. They are enforced in the build, not just written down.

## 4.1 Budgets

| Metric | Starting target |
|---|---|
| Initial JS (UI + game + renderer), gzipped | at most about 300 KB, then tighten after measuring |
| Firebase chunk (lazy-loaded), gzipped | separate budget, measured and recorded |
| First-run art (needed to show the first room and pet) | at most about 1 to 1.5 MB |
| Total installed art and audio | as small as possible, tracked in `PERFORMANCE.md` |
| Time to interactive, mid-range Android over 4G (Lighthouse or DevTools throttling) | under about 2 seconds |
| Frame rate | steady 60 fps on a mid-range laptop, at least 30 fps under 4x CPU throttling in DevTools |
| Idle CPU (pet asleep, no animation) | near zero (render on demand) |
| Texture memory | within a tracked budget (start at roughly 32 MB) |

## 4.2 Build enforcement

- Add a bundle-size check to CI or the build (for example `size-limit`) that **fails the build** when a budget is exceeded.
- Track a performance log in `docs/PERFORMANCE.md`, updated at each phase gate.

## 4.3 Loading

- **Lazy-load Firebase.** The core game must not import Firebase. Load it with a dynamic `import()` only when the player opens shared care, pairing, or transfer. Single-player never downloads it.
- Code-split by screen (shop, history, passport, settings).
- Load first-run art first, then the rest in the background.
- Load audio lazily, in compressed formats, and unlock the audio context on the first user gesture.
- Prefer WebP (or PNG where needed) atlases. Verify support in the Capacitor WebView.
- Cache all static assets with a service worker (installable PWA), so repeat launches are instant and the game works offline.
- In the Capacitor app, assets ship inside the app package, so startup involves no network.

## 4.4 Rendering and CPU

- **Render on demand.** When the pet is asleep or idle and nothing is animating, stop the render loop. A sleeping pet should cost almost nothing.
- **Pause when hidden.** Stop the ticker on `visibilitychange` hidden. On return, run the elapsed-time simulation.
- Cap `devicePixelRatio` at 2. Optionally offer a low-power mode that renders at 30 fps.
- Use **texture atlases** (each at most 2048x2048) and batch sprites. Avoid filters, blur, and expensive shadows.
- **No per-frame allocations** in hot paths. Pool particles and reuse objects.
- **Never drive per-frame animation through Preact/React state.** UI components render the HUD and menus. The renderer owns the pet, room, and animation, and reads game state through a small subscription, not a re-render.
- No `setInterval` polling loops. Use event-driven updates and one scheduler.
- Keep the simulation on the main thread (it is cheap: coarse steps). Only move it to a worker if measurements demand it.

## 4.5 Battery and network

- Sparse, batched sync (Section 11). No always-on listeners.
- No continuous timers while backgrounded.
- Minimal analytics events, batched.

## 4.6 Dependencies

Allowed by default: `preact`, `pixi.js` (tree-shaken), a tiny IndexedDB wrapper (for example `idb-keyval` or a small in-house one), `firebase` (modular, lazy), Vite, Vitest, Playwright, and a bundle-size checker. **Avoid:** lodash, moment or date libraries when `Intl` and `Date` suffice, large UI kits, large CSS frameworks, and heavy i18n libraries. Use plain CSS or CSS modules.

---

# 5. Scope

## Tier A: Visual prototype (Phase 1). No network, no shop.

One ferret, one room, five excellent interactions: tap/pet, feed, water, play with one toy, sleep. Time-based simulation, local save, personality-driven behavior. The goal is the "little creature lives here" feeling at the target performance.

## Tier B: Complete single-player (Phase 2)

Groom, clean, basic customization, pet history, pet passport, backup export and import, accessibility basics, English and Hindi.

## Tier C: Shared care and ownership (Phases 3 and 4)

Invite, pairing, permissions, command mailbox, outbox, caretaker predicted view, Care Days, bond, ownership transfer, identity linking, recovery.

## Tier D: Native app, monetization, release (Phases 5 to 7)

Capacitor packaging, native storage and notifications, adoption IAP, transfer entitlement, cosmetics, closed beta.

## Not in MVP

Multiple species, public social feed, chat, friends list, trading, PvP, breeding, blockchain, AI chatbot pet, more than one caretaker, local peer-to-peer, WebRTC, server-side purchase verification, Discord bot, cloud backup blob, bathing.

**Ideas for after the MVP, only once the ferret loop is proven:**

- Later species (axolotl, capybara, rabbit, cat, small dog), each with its own behaviors and environment, never a reskinned ferret.
- An optional **together mode** where both people are online and see each other's actions live. It needs a live listener, so it is quota-gated and behind the sync level (Section 11.3).
- The optional Discord webhook (Section 15) and an optional small cloud backup document (Section 13.5).

---

# 6. Architecture

```text
                       FIREBASE SPARK (free, lazy-loaded)
              +-------------------------------------+
              |  invites/{code}      (short-lived)   |
              |  pairs/{petId}       (1 small doc)   |
              |  transfers/{petId}   (rare, temp)    |
              |  Remote Config       (syncLevel...)  |
              |  Security Rules      (the only rules)|
              +-------------------------------------+
                  ^                        ^
      batched, sparse writes      batched, sparse writes
                  |                        |
          OWNER DEVICE               CARETAKER DEVICE
      canonical pet state         predicted copy (never canonical)
      full simulation             same deterministic simulation
      applies commands            sends commands via local outbox
      works fully offline         works offline, queues commands
```

Everything about the pet's actual state lives in the owner's local save. The cloud carries just enough for the caretaker to see and act on the pet.

**Cloud stores:** the invite (about 15 minutes), the pair document (uids, epoch, transfer state, pet summary, pending commands), the transfer bundle (temporary), and Remote Config values.

**Cloud never stores:** live stats, per-tick state, full history, inventory, furniture layout, chat, or any gameplay database.

---

# 7. Pet simulation

## 7.1 Start small

**MVP needs** (0 to 100): `hunger`, `hydration`, `energy`, `happiness`.
**Relationship:** `bond` (0 to 100). `trust` is **deferred**: it is not in the MVP state, the summary, or the save. Add it only when a behavior needs it.
**MVP personality traits** (0 to 1, fixed at creation, seeded from the pet id): `mischief`, `curiosity`, `affection`.
**Secondary state:** `sleepState`, `currentActivity`, `favoriteFood`, `favoriteToy`, `favoriteActivity`, `lastInteractionTime`, `lastSimulationTime`.
**Derived, not stored:** `mood`. It is a pure function of the needs, `sleepState`, and traits (for example: `sleepy` when energy is low, `playful` when happiness and energy are high and mischief is high, `needy` when any need is below a threshold). The summary may carry it for display, but it is always recomputable.
**Deferred:** `hygiene`, `enrichment`, `trust`, bathing. MVP "groom" raises bond and happiness. "Clean" removes room mess (Section 7.5). In the MVP, `happiness` drifts toward a baseline computed from the other needs and bond only. Enrichment is not an input until it exists.
**Fixed-point numbers.** Store needs and bond as **integers in hundredths** (0 to 10000) in simulation code, so rates such as -0.5 per 10-minute step stay exact and identical across engines. Convert to 0 to 100 only for display.

## 7.2 Elapsed-time simulation

On app open, when the tab becomes visible again, and when applying commands:

```text
elapsed = now - lastSimulationTime
simulate(state, elapsed, seed) -> new state + list of memorable events
save
```

- **Pure and deterministic.** `(state, elapsed, seed)` gives the same result on every device. The caretaker's predicted copy depends on this.
- **Use only basic arithmetic and integer-based logic.** Do not use `Math.sin`, `Math.exp`, `Math.pow` or similar in simulation code, because results can differ slightly between JavaScript engines. Use a seeded integer RNG (for example mulberry32 with `Math.imul`), never `Math.random`.
- Simulate in coarse steps (for example 10 minutes).
- Clamp elapsed time: negative becomes 0, and cap at 30 days of simulated activity.
- Seed the RNG from `petId + lastSimulationTime`.
- **Time of day uses the owner's time zone**, stored as a fixed UTC offset in minutes (`tzOffsetMin`) in the save and copied into `summary`. Owner and caretaker devices in different time zones must run the same simulation, so neither device reads its own local time zone inside `simulate()`. Update the stored offset when the owner's device zone changes (for example travel or daylight saving), and publish it with the next summary.
- The pet mostly sleeps during a long absence, wakes for a few bursts, and drifts toward mild neediness.
- **Floors:** needs never fall below a minimum (for example 10) from inactivity alone. No death, no permanent damage. After a long absence, show a "welcome back" summary of what happened.
- Sleep follows a soft ferret-like pattern (long sleeps with short activity bursts), shaped by traits and furniture.

**Starter values (tunable, final numbers go in `GAME_DESIGN.md`):**

| Need | Awake | Asleep |
|---|---|---|
| hunger | about -3/hr | about -1/hr |
| hydration | about -4/hr | about -1.5/hr |
| energy | about -4/hr | about +10/hr |
| happiness | drifts toward a baseline from the other needs, bond, and enrichment | same |

## 7.3 Clock trust

The device clock is not trustworthy.

- Use monotonic time (`performance.now()`) within a session.
- Treat suspicious backward or huge forward jumps as "no time passed" or a capped value.
- **Never grant anything valuable from the local clock alone.** Care Days use per-batch Firestore server timestamps (Sections 10.3 and 12.1).

## 7.4 Personality drives behavior

- **High mischief:** steals items, hides objects, moves small things, interrupts.
- **High affection:** follows the player, seeks attention, sleeps near them.
- **High curiosity:** explores, investigates new furniture, finds hidden items.

`PetAI` weights actions by traits, needs, time of day, and nearby furniture. Behavior is visible when the app is open and summarized as history events for time away.

## 7.5 Interactions (MVP)

| Interaction | Effect |
|---|---|
| Feed | choose food, eating animation, hunger up, happiness if preferred, small chance of a personality reaction |
| Water | refill bowl, drinking animation, hydration up |
| Pet (tap, long press) | affection reaction, sound, bond gain with diminishing returns |
| Play | toy interaction, energy down, happiness up. Runs the mini-game in Section 7.8, and its outcome feeds `FinishPlay(result)` |
| Sleep | "Put to bed" (a hammock or bed tap) sets `sleepState` to `asleep` earlier than the pet would choose. Energy recovers at the asleep rate. The pet wakes on its own when energy is high, or when tapped (a small happiness cost if energy is still low). Owner and caretaker use the command `PutToBed`; wake-up is automatic and never a command. |
| Groom (Tier B) | brush, visual feedback, bond and happiness up |
| Clean (Tier B) | remove **mess** from the room (Section 7.6) |

**Bond farming protection:** the first meaningful session of a type per day gives full bond, the second gives less, and repeated taps give none.

## 7.6 Home and furniture

Furniture creates behavior, not just decoration: hammock (more sleep), tunnel (exploration and play), toy box (toy interactions), blanket (comfort), climbing structure (activity). MVP has one room.

**Room state and mess.** The room has a small saved state: which furniture is placed where, and a `mess` count (0 to about 5 items, for example scattered toys, a knocked-over bowl, a dug-up pile). Mess is created by the pet's autonomous behavior (weighted by `mischief`) and by eating and playing. It has **no effect on needs or survival**. Its only role is expression: a messy room is visible, cleaning it gives a small bond and happiness gain (with the diminishing returns in 7.5), and history logs the cause ("Mochi dug up the plant"). `mess` and furniture placement live in `home` in the save, and `mess` is included in `summary` so the caretaker can see it and clean.

## 7.7 History and passport

- **History:** log memorable events only ("Mochi stole Jamie's sock"), never low-level stat changes. Cap stored history (for example the last 500 events) so the transfer bundle stays small. Each event has an id, timestamp, type, actor (owner, caretaker, or the pet itself), and a small payload. Starter type catalog (final list in `PET_BEHAVIOR.md`): `PET_ADOPTED`, `PET_FED`, `PET_PLAYED`, `PET_GROOMED`, `PET_DRESSED`, `ROOM_CLEANED`, `PET_STOLE_ITEM`, `PET_FOUND_ITEM`, `MILESTONE_REACHED`, `CARETAKER_ADDED`, `CARETAKER_REMOVED`, `TRANSFER_REQUESTED`, `TRANSFER_ACCEPTED`, `OWNERSHIP_TRANSFERRED`.
- **Passport:** name, species, coat, born and adopted dates, owner and caretaker names, bond, Care Days, favorite food, toy, and activity. A shareable image card generated on device (Tier B).
- **Share moments:** small generated lines for the passport and share card, such as "Mochi stole 7 socks this week", built from history counts on device. There is no social feed in the MVP.

## 7.8 Core loop, items, onboarding, appearance

**Core loop.** A session is short (1 to 3 minutes): open, see what the pet did while away (the "what happened" summary), care for the one or two needs that are low, play the mini-game once, watch the pet. A daily surprise (a "found item" the pet brings, chosen from the seeded RNG and its traits) gives a reason to return without a streak penalty. There are no timers that gate care and no punishment for skipping days.

**Retention comes from the pet, not from pressure.** Strong reasons to return: the pet learned a new behavior, found a new hiding place, reacted to a new toy, remembered a person, reached a milestone, or the friend cared for it. Avoid: energy timers, aggressive daily streaks, forced ads, fake scarcity, and constant notifications. Skip generic daily-reward systems until the core pet loop works.

**Mini-game.** One small game behind `StartPlay(toyId)` / `FinishPlay(result)`, about 20 seconds, pointer-only (for example dragging a toy for the ferret to chase). Candidates: *tunnel chase*, *find the treat* (hide a treat, the ferret searches), *sock thief*, *hide the toy*, *digging*. Build **one** for the MVP, and add a second only after testers ask for it. `result` is a coarse score band (0 to 3), never a raw score, and the owner clamps its effect. The caretaker plays the same game locally, and the owner validates only the band and the cooldown, not the play itself.

**Items and the economy.** Cosmetics (outfits, toys, furniture) come from three sources: **shinies** (the ferret's stash of small shiny things, a soft currency earned only by caring, capped per day, never sold, never required for survival), Care Day milestone unlocks (Section 12.1), and cosmetic IAP packs (Section 14). **Basic food and water are always free and unlimited**, so shinies never gate survival. Shinies live in `inventory` in the save. `EquipOutfit` and similar commands check that the owner owns the item. The specific prices and earn rates go in `GAME_DESIGN.md`.

**First launch: two routes.** The pet is visible in the room behind two clear buttons: **"Adopt a pet"** and **"Care for a friend's pet"** (opens QR and code pairing). This lets a friend try shared care without buying anything first. The QR code is only a pairing mechanism and never replaces the store purchase. Adoption is free until Phase 6, when the purchase is added behind the same button.

```text
Adopt: Launch -> Adopt a pet -> ferret preview -> (purchase, Phase 6) -> create pet
       -> name pet -> personality shown as a short intro -> tutorial -> home
Care:  Launch -> Care for a friend's pet -> scan QR or enter code -> owner approves -> enter pet
```

**Onboarding and creation.** First run: a short scripted introduction (about 30 seconds), the player names the pet (limit 1 to 16 characters, no leading or trailing spaces, validated on the owner and in rules), and the pet's traits and coat are generated from the pet id seed. No tutorial screens beyond one tap prompt per interaction, shown the first time it is possible.

**Appearance variation.** The ferret has a small set of coats (for example sable, albino, cinnamon, panda), chosen from the seed at creation and stored in `pet.coat`. Coats are palette swaps of the same rig (tint or a small extra texture), so they cost almost no bytes. Coat is included in `summary`.

---

# 8. Save and storage

Versioned save with migrations from the first release, behind a **`SaveStore` interface** so the browser and native app use different storage without touching game logic.

```ts
interface SaveStore {
  load(): Promise<SaveFile | null>;
  save(file: SaveFile): Promise<void>;   // atomic
  export(): Promise<Blob>;               // backup file
  import(blob: Blob): Promise<SaveFile>; // validates checksum and schema
}
```

- **Browser:** IndexedDB (async, does not block rendering). `localStorage` is synchronous and small, so do not use it for the save. Call `navigator.storage.persist()` where available.
- **Capacitor app:** a native filesystem or preferences plugin, behind the same interface (verify current plugin options).
- **Browser storage can be evicted** by the browser or OS, especially for sites not opened for a while (verify current behavior). Treat the browser build as a preview. Provide **Export backup and Import from Phase 1** so testers never lose a pet and can restore one.
- **iOS Safari deletes site data after about 7 days without use** for sites not added to the Home Screen (Intelligent Tracking Prevention; verify current behavior). A tester on an iPhone can lose the pet in a week. In the browser build, detect iOS Safari outside an installed PWA and show a plain message: "Add to Home Screen, and export a backup." Count this as a known limitation in the Phase 1 gate (Section 25.3).
- **Moving from the browser build to the native app** uses a different storage origin, so the two never share data automatically. The only path is Export backup in the browser and Import in the app (Section 25.8).

```json
{
  "schemaVersion": 1,
  "installId": "",
  "pets": [
    {
      "pet": { "id": "", "name": "", "species": "ferret", "coat": "sable", "born": "" },
      "personality": {},
      "state": {},
      "inventory": { "shinies": 0, "items": [] },
      "home": { "furniture": [], "mess": 0 },
      "ownership": { "role": "owner", "ownerUid": "", "epoch": 1, "deviceId": "", "caretaker": null, "status": "active" },
      "careDays": { "count": 0, "dates": [] },
      "history": [],
      "sync": { "outbox": [], "lastAppliedSeq": {}, "lastPairRevision": "" },
      "timestamps": { "lastSimulationTime": "", "lastSaved": "" },
      "tzOffsetMin": 0
    }
  ],
  "activePetId": "",
  "settings": {}
}
```

- **`installId`** is a random id created once per install, and it is what `seq` and `deviceId` are keyed to (Sections 10.6 and 13.5).
- **`pets` is a list** (at most 2 in the MVP, see Open Decision 11). Every per-pet field lives inside its entry. Global things (settings, `installId`) sit at the top level. UI shows only the `activePetId` pet.
- **`ownership.status`** is `active`, `locked` (transfer or device move in progress), or `tombstone` (read-only, authority moved elsewhere).

Rules:

- Every save has `schemaVersion` and a migration chain. Never assume old saves have new fields.
- **Atomic writes:** write the new version, verify, then swap. Keep one previous version as a fallback and store a checksum. Fall back if the newest is corrupt.
- Do not rely on save obfuscation for security (Section 16).
- Save on meaningful change (debounced) and when the page becomes hidden. Do not save every frame.
- In the native app, enable platform backup (Android Auto Backup, iCloud) and test that the save file is included.
- **Platform backup must not clone `installId`.** A backup restored on a new phone would otherwise carry the old `installId`, pass the `activeDeviceId` check while the old phone is still alive, and fork the pet (Section 13.6). Keep `installId` **outside** the backed-up save: in a no-backup location (Android `noBackupFilesDir` or a backup-rules exclusion, and the iOS equivalent excluded from iCloud backup, verify both), and generate a new one whenever it is missing. A restored save therefore always starts on a new `installId`, which does not match `activeDeviceId`, so it opens as a tombstone and offers "Move Mochi to this device" or "Take over" (Section 13.6). In the browser build, `installId` lives in the same IndexedDB as the save, and export files never contain it.

---

# 9. Rendering and art

## 9.1 Approach

- **Renderer:** PixiJS (or Canvas 2D if the budget demands, Section 3). A single canvas, one scene: the room, the pet, small props, particles.
- **Pet rig:** layered sprites (body, head, ears, tail, legs) moved by code-driven tweens, with squash and stretch, plus a few frame swaps (blink, mouth open, eyes closed). Author 8 to 12 excellent, personality-rich behaviors before adding more. Quality of movement matters more than quantity.
- **Starter animation list** (seed for `ART_ASSET_LIST.md`): idle breathing, blink, ear movement, head tracking, sniff, walk, run, sleep, eat, drink, scratch, groom, and the reactions happy, annoyed, curious, playful, surprise. **Build first (Phase 1):** idle breathing, blink, walk, sniff, sleep, eat, drink, happy, playful, curious, plus one mischief behavior (for example stealing an item). The rest come in Phase 2.
- **Audio starter list:** footsteps, sniffing, squeaks and chirps, eating, drinking, item interaction, and room ambience. Use audio sparingly, the pet should not make noise constantly.
- **UI:** Preact components over the canvas for HUD, menus, and dialogs, with plain CSS. The canvas does not contain UI text (better for localization and accessibility).

## 9.2 Asset pipeline

- Free authoring tools only (for example Krita, Inkscape, or a free pixel tool). Verify licenses.
- Pack sprites into atlases (each at most 2048x2048), compress (WebP where supported), and track the size of every asset in `docs/ART_ASSET_LIST.md`.
- First-run assets are a separate small bundle from the rest.

## 9.3 Mobile-first layout

Design for a portrait phone viewport from day one, even in the desktop browser preview.

- Test in DevTools device mode at common phone sizes, with CPU throttling.
- Handle safe areas, touch targets (at least about 44 px), and both portrait and (later) landscape.
- Use pointer events (works for mouse and touch), and never rely on hover.

**Main screen.** The pet always comes first, and menus stay out of the way.

```text
+--------------------------------+
| Hunger      Water       Energy |   HUD (Preact)
|                                |
|            PET                 |   canvas: room + pet
|        [interactive room]      |
|                                |
| Food  Play  Groom  Dress  Home |   action bar (Preact)
+--------------------------------+
```

The pet is directly touchable: **tap** = reaction, **long press** = petting, **drag** = the pet follows or is repositioned, **tap an item** = contextual interaction. MVP has one room, so there is no camera panning. Avoid menu-heavy interaction. Needs in the HUD use an icon plus a label or shape, never color alone.

---

# 10. Shared care (owner and caretaker)

## 10.1 Backend abstraction

All backend access goes through one interface so nothing else depends on Firebase:

```ts
interface Mailbox {
  // pairing
  createInvite(petId: string, perms: Permission[]): Promise<Invite>;
  claimInvite(code: string): Promise<InviteClaim>;
  approveInvite(code: string): Promise<void>;
  watchInvite(code: string, onChange: (i: Invite) => void): () => void; // pairing screen only

  // shared pair document
  readPair(petId: string): Promise<PairDoc>;
  pushCommands(petId: string, cmds: Command[]): Promise<void>;           // caretaker
  publishSummary(petId: string, s: PetSummary, lastAppliedSeq: number): Promise<void>; // owner

  // ownership
  beginTransfer(...): Promise<TransferResult>;
  acceptTransfer(...): Promise<TransferResult>;
  cancelTransfer(...): Promise<TransferResult>;
}
```

Implementations: `FirebaseMailbox` (real, dynamically imported) and `MemoryMailbox` (development and tests, able to simulate latency and quota failures).

## 10.2 Roles and permissions

| Role | Description |
|---|---|
| Owner | Device and account currently authoritative for the pet |
| Caretaker | Temporarily trusted player who sends commands |
| Bonded Owner | The caretaker after a completed transfer. From then on, just "Owner" |

| Action | Owner | Caretaker |
|---|:-:|:-:|
| Feed, water, play, groom, pet, use toys, dress | Yes | Yes |
| Rename pet | Yes | No |
| Invite, revoke, or transfer | Yes | No |
| Delete pet or export backup | Yes | No |
| Buy cosmetics | Yes | Later |

Enforce permissions **in code** (`validateCommand` on the owner) and **in security rules** (Section 10.4).

## 10.3 Data model (one small document per pair)

Design for **one document per pet** so rules never need extra `get()` calls. Each `get()` inside a rule may bill as a read (verify). Denormalize what rules need.

`pairs/{petId}`:

```json
{
  "ownerUid": "uidA",
  "activeDeviceId": "installId-of-the-owner-device",
  "caretakerUid": "uidB",
  "epoch": 1,
  "transferState": "none",
  "transferTo": null,
  "permissions": ["feed", "water", "play", "groom", "pet", "dress"],
  "names": { "owner": "Alex", "caretaker": "Jamie" },
  "claimedAt": "server timestamp (set when the caretaker was approved)",
  "summary": {
    "name": "Mochi",
    "coat": "sable",
    "traits": { "mischief": 0.8, "curiosity": 0.5, "affection": 0.4 },
    "needs": { "hunger": 62, "hydration": 71, "energy": 40, "happiness": 80 },
    "mood": "playful",
    "sleepState": "awake",
    "currentActivity": "idle",
    "favoriteFood": "chicken",
    "favoriteToy": "ball",
    "furniture": ["hammock", "tunnel"],
    "mess": 1,
    "outfit": "scarf_red",
    "tzOffsetMin": 330,
    "lastSimulationTime": "2026-10-01T10:00:00Z",
    "bond": 72,
    "careDays": 23
  },
  "batches": {
    "b_9f2c": {
      "t": "server timestamp (== request.time, enforced by rules)",
      "installId": "caretaker-install-id",
      "cmds": [
        { "id": "uuid", "seq": 41, "type": "FeedPet", "payload": { "foodId": "chicken" },
          "localDate": "2026-10-01", "clientTs": "2026-10-01T09:58:11Z", "epoch": 1, "v": 1 }
      ]
    }
  },
  "lastAppliedSeq": { "caretaker-install-id": 40 },
  "ownerSyncedAt": "server timestamp",
  "updatedAt": "server timestamp"
}
```

**Why `batches` is a map, not an array of commands.** Two problems are solved at once:

- **No lost commands.** The owner removes only the batches it applied, using field-level deletes (`batches.b_9f2c` = delete). A caretaker adding a new batch key at the same moment touches a different key, so neither write overwrites the other. Rewriting a whole array would silently drop anything the caretaker appended between the owner's read and write.
- **A real delivery timestamp per batch.** `serverTimestamp()` is not allowed inside array elements, and `updatedAt` changes on every write. A map entry can hold a server timestamp, and the rules require `batches.<id>.t == request.time` on creation (Section 10.4). The owner therefore knows when each batch actually arrived, which Care Days need (Section 12.1).

Limits, enforced by rules: at most 40 batches in the document and at most 25 commands per batch (so at most 1,000 commands, and in practice far fewer because the owner clears applied batches on every sync). Keep the document well under the 1 MiB limit. **If the batch cap is reached, the caretaker's outbox simply holds and waits**: the caretaker cannot remove batches, and only the owner prunes. The owner may also merge or drop the lowest-value commands (for example repeated pets) while processing.

**Fields added in v3.1:**

- `activeDeviceId`: the `installId` of the one device allowed to act as the owner device (Section 13.5). Every owner device compares this to its own `installId` before publishing or applying anything.
- `ownerSyncedAt`: rules-enforced `request.time`, set on each owner write-back. It marks that every batch older than this was already seen (applied or dropped).
- `claimedAt`: server time when the caretaker was approved, set in the approval write. Care Days use it as the earliest valid date (Section 12.1).
- `lastAppliedSeq` is a **map from caretaker `installId` to seq**. A reinstalled caretaker gets a new `installId` and starts at seq 1 without colliding with the old install's history.
- `summary` now carries every input the simulation needs (coat, favorites, furniture, mess, current activity, time zone offset), so the caretaker's predicted copy runs the same `simulate()` with the same inputs and drifts less.

`invites/{code}`: `petId`, `ownerUid`, `permissions`, `expiresAt`, `status` (`open`, `claimed`, `approved`, `rejected`, `cancelled`), `claimedByUid`, `claimedName`.

`transfers/{petId}`: `kind` (`ownerChange` or `deviceMove`), `fromUid`, `toUid`, `epoch`, `status` (`pending`, `accepted`, `cancelled`), `bundle` (Firestore **Bytes** holding the gzipped save, not base64, which would add about 33%), `sha256`, `createdAt`. After acceptance the receiver replaces `bundle` with empty bytes and sets `status = accepted`, and the document stays as a small **receipt** so the sender can discover the outcome (Section 13.3, step 6). Either side deletes it afterwards. Use the browser's built-in `CompressionStream` where available (verify support in the Capacitor WebView) instead of shipping a compression library.

## 10.4 Security rules (starting point)

This is a **draft for Claude Code to refine and test in the Firestore emulator**. It is not final. Verify syntax and behavior before use.

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() { return request.auth != null; }

    match /pairs/{petId} {
      function isOwner()     { return request.auth.uid == resource.data.ownerUid; }
      function isCaretaker() { return request.auth.uid == resource.data.caretakerUid; }
      function changed()     { return request.resource.data.diff(resource.data).affectedKeys(); }
      function batchDiff()   { return request.resource.data.batches.diff(resource.data.batches); }

      allow get: if signedIn() && (isOwner() || isCaretaker());
      allow list: if false;

      allow create: if signedIn()
        && request.resource.data.ownerUid == request.auth.uid
        && request.resource.data.epoch == 1
        && request.resource.data.caretakerUid == null
        && request.resource.data.batches.size() == 0;

      allow update: if signedIn() && (ownerUpdate() || caretakerBatch() || caretakerAcceptsTransfer());
      allow delete: if signedIn() && isOwner();

      // Owner: publish summary, approve or revoke a caretaker, clear applied batches
      // (field-level deletes), start or cancel a transfer, move to another device.
      // Batches may only be removed here, never added or edited by the owner.
      function ownerUpdate() {
        return isOwner()
          && request.resource.data.ownerUid == resource.data.ownerUid
          && request.resource.data.epoch == resource.data.epoch
          && changed().hasOnly(['summary','batches','lastAppliedSeq','caretakerUid','names',
                                'permissions','transferState','transferTo','activeDeviceId',
                                'claimedAt','ownerSyncedAt','updatedAt'])
          && batchDiff().addedKeys().size() == 0
          && batchDiff().changedKeys().size() == 0
          && (!('ownerSyncedAt' in changed()) || request.resource.data.ownerSyncedAt == request.time)
          && (request.resource.data.transferState == 'none'
              || request.resource.data.transferTo == resource.data.caretakerUid);
      }

      // Caretaker: add exactly one new batch. Its timestamp must be the server time.
      // Cannot edit or remove any batch, so a full doc means the caretaker's outbox waits.
      function caretakerBatch() {
        return isCaretaker()
          && changed().hasOnly(['batches','updatedAt'])
          && batchDiff().addedKeys().size() == 1
          && batchDiff().changedKeys().size() == 0
          && batchDiff().removedKeys().size() == 0
          && request.resource.data.batches.size() <= 40
          && request.resource.data.batches[batchDiff().addedKeys().toList()[0]].t == request.time
          && request.resource.data.batches[batchDiff().addedKeys().toList()[0]].cmds.size() <= 25;
      }

      // Caretaker accepts an ownerChange transfer. Pair change and transfer receipt
      // are written in ONE transaction (see transfers rules below).
      function caretakerAcceptsTransfer() {
        return isCaretaker()
          && resource.data.transferState == 'pending'
          && resource.data.transferTo == request.auth.uid
          && request.resource.data.ownerUid == request.auth.uid
          && request.resource.data.epoch == resource.data.epoch + 1
          && request.resource.data.caretakerUid == null
          && request.resource.data.transferState == 'none'
          && changed().hasOnly(['ownerUid','activeDeviceId','caretakerUid','epoch','transferState',
                                'transferTo','batches','lastAppliedSeq','updatedAt']);
      }
    }

    match /invites/{code} {
      allow get: if signedIn();
      allow list: if false;

      allow create: if signedIn()
        && request.resource.data.ownerUid == request.auth.uid
        && request.resource.data.status == 'open'
        && request.resource.data.expiresAt <= request.time + duration.value(15, 'm');

      allow update: if signedIn() && (
        ( resource.data.status == 'open'
          && request.time < resource.data.expiresAt
          && request.resource.data.status == 'claimed'
          && request.resource.data.claimedByUid == request.auth.uid
          && request.resource.data.diff(resource.data).affectedKeys()
               .hasOnly(['status','claimedByUid','claimedName']) )
        ||
        ( request.auth.uid == resource.data.ownerUid
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status'])
          && request.resource.data.status in ['approved','rejected','cancelled'] )
      );
      allow delete: if signedIn() && request.auth.uid == resource.data.ownerUid;
    }

    // transfers/{petId}: rare, so a get()/getAfter() here is acceptable.
    //  - create: by the current owner (get() the pair: ownerUid == auth.uid, transferState
    //    == 'pending', transferTo == toUid), bundle size capped.
    //  - read: by fromUid or toUid stored in the document itself.
    //  - update to status 'accepted': only by toUid, and only when
    //    getAfter(/pairs/{petId}).data.ownerUid == request.auth.uid and
    //    getAfter(/pairs/{petId}).data.epoch == resource.data.epoch + 1 (deviceMove:
    //    activeDeviceId changed instead). This makes a fake "accepted" receipt impossible,
    //    which matters because the old owner tombstones its pet when it sees one.
    //  - update to status 'cancelled': by fromUid only, together with the pair transaction.
    //  - delete: by fromUid or toUid.
  }
}
```

Rules cannot verify cryptographic signatures, so identity is the Firebase `uid`. Handle everything else in client code.

**Losing read access is information, not an error.** After a transfer completes, the old owner is no longer `ownerUid` or `caretakerUid`, so a `get` on the pair doc returns permission-denied. A revoked caretaker gets the same result. Clients must handle this on purpose: a caretaker who gets permission-denied clears its caretaker state and shows "You no longer have access to this pet". An owner whose pet is `locked` for a transfer treats permission-denied as "check `transfers/{petId}` for the receipt" (Section 13.3, step 6).

## 10.5 Invite and pairing flow

```text
Owner: "Invite" -> creates invites/{code} (expires in 15 min)
       shows QR + short code, listens to this ONE doc
Caretaker: "Care for a friend's pet" -> anonymous sign-in -> scan QR / enter code
       -> claims the invite (status = claimed) -> listens to this ONE doc
Owner: sees claim -> "Jamie wants to care for Mochi. Allow?"
       -> approve (batched write: invite.status = approved, pair.caretakerUid = claimed uid)
Caretaker: sees approval -> reads pair doc -> enters the pet
```

- QR payload: `protocolVersion`, `petId`, `inviteCode`, `expiry`, `permissions`. **Never** any persistent secret or key.
- Code: 8 characters from an unambiguous alphabet (no `0/O`, `1/I/L`). Invites are fetched by exact id only (rules block listing), which makes guessing impractical. Verify this reasoning.
- Generate QR codes with a tiny library or a small in-house encoder, and lazy-load it. QR scanning uses the camera. In the browser use `getUserMedia` plus a small decoder (lazy-loaded), and in the native app a camera plugin. Always offer the typed code as a fallback.
- Use a snapshot listener **only on the invite doc, only on the pairing screens**. Note that the smaller Firestore "lite" build may not support listeners or transactions (verify), so use the full SDK inside the lazy chunk.
- Owner deletes expired or used invites on next open.
- Revoke: owner sets `caretakerUid = null`. The old caretaker loses access immediately.

## 10.6 Commands

The caretaker sends **commands**, never state. MVP types: `FeedPet(foodId)`, `GiveWater`, `PetTouch`, `StartPlay(toyId)`, `FinishPlay(result)`, `PutToBed`, `GroomPet`, `CleanRoom`, `EquipOutfit(outfitId)`.

Fields: `id` (UUID), `seq`, `type`, `payload`, `localDate`, `clientTs`, `epoch`, `v` (protocol version). Each batch also carries the caretaker's `installId`. **`seq` is monotonic per caretaker `installId`** and is persisted in the caretaker's local save, so a reload never repeats a number. A reinstall creates a new `installId`, so its `seq` restarts at 1 without colliding with the old install (the owner tracks `lastAppliedSeq` per `installId`).

Owner-side processing on each sync or app open:

1. Read the pair document (one read). Check `activeDeviceId == my installId` and `epoch` first. If not, stop and tombstone (Section 13.5).
2. Collect the commands of all batches. Ignore commands with `seq <= lastAppliedSeq[installId]`, unknown protocol versions, or a stale `epoch`.
3. **Order by `(batch.t, installId, seq)`, never by `clientTs`.** `clientTs` comes from an untrusted clock and is used only for display and sanity bounds.
4. Validate each command against permissions, item ownership, cooldowns, and diminishing returns.
5. **Apply without rewinding time.** The owner simulates forward to *now* once, then applies commands in order at the current simulation time. A command is never applied "in the past", because the owner's state has usually already moved beyond the command's `clientTs`. The command's `localDate` matters only for Care Days (Section 12.1). Record history events with the actor's name.
6. Write back once: `summary`, `lastAppliedSeq` (per install), `ownerSyncedAt = request.time`, and a **field-level delete for each batch that was fully processed** (applied or dropped). Do not rewrite the batches map. A batch that arrives during this write is a different key and is untouched.

Invalid commands are dropped silently, never crash the owner, and never mutate state directly. Duplicates are harmless (idempotent by id and seq).

**The caretaker's predicted copy uses the same rule.** It runs `simulate()` forward to now from the latest summary, then applies its own pending commands at the current time. It never simulates or applies anything in the past.

## 10.7 Caretaker experience

The caretaker's app shows a **predicted copy** of the pet. It takes the latest `summary`, runs the same deterministic simulation forward to now, and applies the caretaker's own pending commands locally so the pet reacts instantly.

- The predicted copy is **never saved as canonical**. Each new summary replaces it.
- The UI is honest: "Last updated 3h ago", and pending actions show as "Waiting for Alex to open Mochi".
- If the owner has not opened the app for a long time, the caretaker still sees a believable pet and can still care for it. Commands wait in the mailbox until the owner opens the app.
- Caretaker actions that need the owner's result (a Care Day being credited) show as pending, then confirmed.

## 10.8 Outbox

- Every caretaker action goes into a local persistent **outbox** first (survives reloads).
- The outbox flushes in **batches** (Section 11) by adding **one new `batches.<id>` entry** (with the batch's commands inside), so ten actions cost one write. Batch ids are random, so a retried flush of the same batch is idempotent (the rules allow adding a key once, and the owner de-duplicates by command id).
- A failed write (offline, quota exhausted, error) keeps the commands with exponential backoff. Queued commands expire after about 7 days.
- The UI shows "waiting to deliver" rather than an error.
- Flush on `visibilitychange` (hidden), and treat unload as best-effort only, because browsers do not guarantee async work on unload.

---

# 11. Quota management and sync budget

The free tier resets daily. One bug or one busy evening can degrade shared features for everyone. Owners are unaffected because single-player never touches Firebase.

## 11.1 Rough capacity

Assuming about 4 to 8 writes and 6 to 8 reads per active pair per day, writes run out first: roughly **2,500 to 5,000 pairs active on the same day**. Installed pairs can be several times higher. **Measure it in Phase 3**, do not trust these numbers. Check the current Spark quotas (Section 24).

## 11.2 Rules for low usage

- Local-first: apply everything locally at once. Only sync what the other person must see.
- Batch commands. Flush when the page is hidden, at session end, or at most every 10 to 15 minutes while foregrounded with pending commands.
- Write the summary only on meaningful change, at most every 30 minutes, and at session end.
- No always-on listeners. Fetch once on app open. Listeners exist **only** for the invite doc during pairing.
- Skip unchanged writes by comparing with the last published summary.
- Never write per tick, per stat change, or per tap.

## 11.3 Sync levels (Remote Config)

Remote Config has a minimum fetch interval (the default is long, roughly hours; verify), so treat it as a slow dial, not a real-time switch.

| Level | Behavior |
|---|---|
| `normal` | The schedule above |
| `reduced` | Intervals about 3x longer, no summary writes except at session end |
| `critical` | Only command flush on hide and ownership operations |

Also fetch `minProtocolVersion` (prompt for an update if the protocol changes) and a `syncDisabled` kill switch.

## 11.4 Client-side write budget

To protect against runaway bugs, each device keeps a local counter per UTC day (for example about 30 writes and 60 reads, tunable). Above the cap, sync pauses until the next day and everything queues. Ownership and invite operations get a small reserved allowance.

## 11.5 At the quota

Firestore requests fail until the daily reset. Show friendly messages, keep queuing commands, and refuse to *start* a transfer rather than leave one half-done. Nothing is charged. Never solve this by enabling billing without the developer's explicit decision.

Add a debug screen showing today's local read/write counts and the current sync level.

---

# 12. Care Days and Bond

## 12.1 Care Day

A Care Day is earned by the **caretaker** when, on a qualifying calendar date, they perform at least **2 distinct meaningful action types** among feed, water, play, and groom, and the owner's device validates and applies them.

**Anti-cheat with an untrusted clock:**

- Each command carries the caretaker's `localDate`.
- The owner uses the **per-batch server timestamp** `batches.<id>.t` (rule-enforced to equal `request.time`, Section 10.3) to bound dates:
  - A command's date cannot be more than 1 day ahead of the date of its batch's `t`.
  - It cannot be more than 7 days behind the date of its batch's `t` (matching outbox expiry).
  - It cannot be earlier than the date of `claimedAt`.
- Bounds are evaluated in UTC dates with a one-day tolerance, because `localDate` is in the caretaker's time zone.
- If the owner is away for weeks, each batch keeps its own `t`, so honest Care Days from the whole absence still count (bounded by the 40-batch cap). Dropping to a single shared timestamp would either cheat-proof nothing or discard honest days, which is why per-batch timestamps exist.
- At most one Care Day per calendar date.
- Result: faking 30 Care Days needs about 29 or more real days. Setting the clock forward cannot skip time.
- The count lives in the owner's save and is mirrored in `summary.careDays`.

**Milestones:** 7 days (a new tunnel), 14 (a new sleeping behavior), 30 (transfer eligible), 50 (passport memory), 100 (special animation). Rewards should make the pet feel more personal, not just raise a number.

## 12.2 Bond

Awarded for meaningful care with diminishing returns (Section 7.5), for both owner and caretaker. Meaningful care means feeding, play, grooming, cleaning the room, mini-game success, discovering something new with the pet, and consistent care over days. Repeated taps never count. Bond belongs to the pet's relationship with its people and survives ownership transfer.

---

# 13. Ownership, transfer, and recovery

## 13.1 Model

Store entitlement and pet ownership are separate. The adoption purchase belongs to the buyer's store account. Pet ownership is game state and can move to another person. The store license is never treated as transferable.

## 13.2 Eligibility

A transfer can start when **either** the pair's Care Days reach 30 **or** the caretaker has bought the fast-transfer entitlement (verified on device in the MVP, so this is an honor system, acceptable because pets carry no cash value).

## 13.3 Transfer protocol (epoch and transaction)

The pet state lives only on the owner's device. To transfer it, hand the new owner a copy through the cloud, then flip authority with **one atomic transaction**.

```text
State: none -> pending -> none (with epoch + 1)

1. OWNER  taps "Give Mochi to Jamie" (eligible).
          Owner app applies every pending batch one last time (so no caretaker commands
          are stranded), then LOCKS the pet locally ("Mochi is getting ready to move").
2. OWNER  writes transfers/{petId} (status "pending"): gzipped save as Bytes + sha256,
          and sets pair.transferState = "pending", pair.transferTo = caretakerUid.
3. CARETAKER  sees pending -> downloads the bundle, verifies sha256,
          imports it as an INACTIVE local copy.
4. CARETAKER  runs ONE TRANSACTION (runTransaction, never a plain batched write,
          because a batched write can be queued offline and commit later while the
          owner cancels; a transaction fails when offline and cannot commit late):
          a) pairs/{petId}: if transferState == "pending" && transferTo == me && epoch == e
             then ownerUid = me, activeDeviceId = my installId, caretakerUid = null,
             transferState = "none", epoch = e + 1, batches = {}, lastAppliedSeq = {}.
          b) transfers/{petId}: status = "accepted", bundle = empty bytes (receipt only).
          Rules check (b) against the new pair state with getAfter(), so a receipt can
          only exist if the transfer really happened (Section 10.4).
5. CARETAKER  activates the imported pet locally, and discards its own old outbox
          (those commands carry the old epoch and can never apply).
6. OLD OWNER  on next open sees permission-denied on the pair doc, reads
          transfers/{petId}, finds status "accepted", then marks the local copy
          TRANSFERRED (read-only tombstone), stops all writes, and deletes the receipt.
          (The receiver deletes it after 30 days if the old owner never returns.)
```

**Cancel:** the owner can cancel while pending with a transaction (`pending` to `none`, same epoch) that also sets the receipt to `cancelled`. Accept and cancel race in the database: **exactly one wins.** The loser sees the transaction fail and re-reads the pair doc to learn the outcome.

**Receiving device rules.** The caretaker's save must have room for the pet (at most 2 pets, Open Decision 11). If it does not, the caretaker's app refuses to begin step 3 and tells the owner-side receipt to stay `pending` (the owner can cancel). The imported pet keeps its `pet.id`, `personality`, `bond`, history, and inventory, but `careDays` resets for the new pair.

Guarantees to test:

- Two owners can never exist. Authority is decided by the transaction and the epoch, not by either device's belief.
- Zero owners is transient at worst. The pet is locked and the state is `pending` until accepted or cancelled.
- Every command and write carries `epoch`. Anything stale is rejected or ignored.
- Old owner offline for a long time: nothing was lost (pet locked at step 1), and it becomes a tombstone when it reconnects. It learns this from the receipt, not from the pair doc, which it can no longer read.
- A fake or premature "accepted" receipt cannot be written (`getAfter()` rule), so a malicious caretaker cannot make the owner tombstone a pet that was not transferred.
- Caretaker commands still in the mailbox at transfer time are cleared by the accept transaction (the owner applied them in step 1). Commands sent after step 1 are lost by design, and the caretaker's UI says so.
- Owner closes the tab or app mid-transfer: state persists in the save and pair doc, and the flow resumes.
- Caretaker goes offline mid-accept: the transaction fails and nothing changes. The transfer stays `pending`, and it can be retried or cancelled. No queued write can commit later.
- Caretaker never accepts: the owner can cancel at any time. Consider a "pending expires after N days" rule the owner can trigger.
- Bundle too large: cap history and inventory so the compressed bundle stays well under 1 MiB, and fail early with a clear message if not.

## 13.4 After a transfer

The new owner can invite a new caretaker (the old owner can be invited as the caretaker). Care Days reset for the new pair and bond is kept.

## 13.5 Identity and recovery

This is a **core feature**. Losing a phone or clearing browser data must not mean losing the pet.

- Identity is the Firebase Auth `uid`. Anonymous accounts **do not survive clearing site data, a reinstall, or a new device**. So the owner is prompted to **link a Google account (and Apple ID on iOS)**, which keeps the same `uid` through Firebase account linking. On the web, linking uses a popup or redirect. In the Capacitor app it needs a native sign-in plugin (verify current options and store policy, including Sign in with Apple requirements on iOS).
- **Soft gate:** before the first invite, show "Protect Mochi" with the link-account step and the backup export step.
- **Reclaim flow:** after reinstall or clearing data, the owner signs in with the linked account (same `uid`), the pair doc still names them owner, and they restore the save from a backup.
- **Backup sources, in order of preference:**
  1. Platform backup in the native app (Android Auto Backup, iCloud), enabled and tested.
  2. Manual export file (free), with a checksum. Import validates it.
  3. Optional later: a small cloud backup document. This uses quota and storage, so cap and rate-limit it if built.
- If neither a link nor a backup exists, the pet is unrecoverable. The UX must say this plainly at invite time.
- A caretaker who loses their device just re-pairs with a new invite.
- An old backup restored on an owner device whose epoch has since changed, or whose `installId` no longer matches `activeDeviceId`, must be rejected as a tombstone.

## 13.6 One owner, one active device

Linking a Google account keeps the same `uid` on every device, so signing in on a second device could create a second, diverging copy of the pet and break "one canonical pet state" (Principle 3). The pair doc therefore names the single device allowed to act as owner: `activeDeviceId`.

- **Owner device check.** Before any publish, command apply, or invite, the owner device compares `pair.activeDeviceId` with its own `installId`. If they differ, it becomes a read-only **tombstone** (`ownership.status = "tombstone"`) and offers "Move Mochi to this device" or "Restore a backup here".
- **Move to a new device (both devices alive).** The old device locks the pet and writes a `transfers/{petId}` bundle with `kind = "deviceMove"`, `fromUid == toUid`. The new device signs in (same `uid`), downloads and verifies the bundle, then runs one transaction (never a plain batched write) that sets `activeDeviceId` to its own `installId` and marks the receipt `accepted`. The epoch does not change, so the caretaker's commands keep working. The old device sees the receipt (or a changed `activeDeviceId`) and tombstones itself.
- **A restored backup is never trusted as the active device.** Because `installId` is kept outside the backup (Section 8), a save restored from platform backup or an export file arrives with a fresh `installId`, and always opens as a tombstone until the player chooses "Move" or "Take over".
- **Take over (old device lost).** The new device signs in with the linked account, restores the latest backup, and writes `activeDeviceId = my installId`. Care after the backup was made is lost, and the UI says so. If the old device ever comes back, it sees the mismatch on its first sync and tombstones itself.
- **Residual race.** Rules cannot identify a device, so two devices could publish in the same short window before either reads the change. This is accepted: the loser tombstones on its next read, and the next accepted summary replaces the other. Both writes are summaries, not authority.

---

# 14. Purchases

Principle: **pay for adoption and expression, not survival.**

| Product | Store type | Purpose |
|---|---|---|
| Ferret adoption | Non-consumable | Initial pet entitlement |
| Fast-transfer entitlement | Non-consumable | Skip the 30 Care Days |
| Outfit, furniture, toy, or room-theme packs | Non-consumable | Cosmetics |

Never sell: food or water needed to keep the pet well, mandatory health items, energy timers, forced ads, loot boxes, or subscriptions for basic ownership. **Basic food and water are always free and unlimited.**

**Shop design.** It should feel like a pet store, not a casino. Sections: Adopt, Food (free basics plus favorites), Toys, Clothes, Home, Special. Premium items are cosmetic, collectible, humorous, animation-based, or environment-based, and never affect survival. Humor is part of the brand, for example a "RIDICULOUSLY LARGE CHICKEN" toy ("Mochi can carry it. Probably."). Items can be bought with shinies (earned) or through IAP packs, and no item exists only behind real money if it is needed for care.

Implementation:

- Behind a platform-neutral `PurchaseService` interface. The browser build uses a mock that grants entitlements locally for testing.
- **Do a small IAP spike first** (start of Phase 6): wrap a trivial build with Capacitor, and test one purchase, restore, and cancel using Google Play's test tools. Capacitor purchase plugins are less proven than Unity's, so de-risk this before building the shop. Evaluate the current plugin options and any third-party purchase service's free tier and terms (verify), noting that a third-party service is not a server the developer runs but has its own terms.
- **Entitlement logic is separate from ownership logic.**
- **Verification is on device** (no backend). Accept the cheating risk and document it as a deliberate trade-off. Re-check entitlements on launch. Restore purchases must work.
- Test purchase, cancel, failure, restore, duplicate callbacks, refund, and reinstall using store test tools.
- Review current Google Play and Apple policies on digital goods and transfer mechanics before release.

---

# 15. Notifications

Local notifications only in the MVP (in the native app via Capacitor's local notifications plugin, verify). They come from the on-device simulation ("Mochi found something behind the couch"), with granular settings and a hard cap on frequency. The browser preview does not need notifications.

**Not possible without a server:** "Your friend just fed Mochi." The owner sees this when they next open the app. This is a known, accepted limitation.

Possible later, post-MVP: the owner pastes their own Discord webhook URL, stored only on their device and used to post pet events. It is opt-in and the developer runs no bot.

Never send continuous hunger alerts.

---

# 16. Security and abuse

| Threat | Mitigation |
|---|---|
| Fake caretaker | Short-lived invite, owner approval, `uid` binding, rules |
| Guessing invite codes | High-entropy code, exact-id lookup only, no listing |
| Replay or duplicate commands | Command ids, monotonic `seq`, `lastAppliedSeq`, epoch checks |
| Unauthorized transfer | Owner-initiated, caretaker-accepted, transaction plus epoch, rules |
| Malformed commands | Validator on the owner, rules on size and fields, never crash |
| Save tampering | Accepted. Local game, no cash-value assets. The browser makes this trivial, so do not pretend otherwise |
| Purchase spoofing | On-device verification, accepted risk |
| **Quota-exhaustion attack** | Someone with the API could burn the shared free quota using anonymous accounts |

The last row is a real risk for a free-tier design. Evaluate:

- **Firebase App Check** (reCAPTCHA-based on web, Play Integrity on Android) if free on Spark (verify), enforced on Firestore.
- Strict rules (document size, array caps, allowed fields).
- Monitoring the usage dashboard, and the `syncDisabled` and `reduced` levels.
- Accept residual risk. Owners are unaffected either way.

Never put private keys or persistent secrets in QR codes. Never trust remote timestamps blindly. Every network message carries a protocol version. Do not commit secrets. Firebase web config values are not secrets, but access is governed by rules and App Check.

---

# 17. Privacy, accessibility, localization

**Privacy:** no public profiles, no directory, no chat, no location. The only cloud data is the small pair doc, the invite, and any in-flight transfer bundle. Store only nicknames, not real names. Analytics are minimal, opt-in where required, and never used to identify people. The privacy policy must accurately describe Firebase (Auth, Firestore, Analytics, Crashlytics, Remote Config) and purchases. Age and audience rules depend on Open Decision 4.

**Analytics** (anonymous, batched): `first_pet_created`, `first_feed`, `first_play`, `first_customization`, `pairing_started`, `pairing_success`, `pairing_failure`, `care_day_7`, `care_day_30`, `transfer_started`, `transfer_completed`, `purchase_started`, `purchase_completed`, `purchase_restored`. The key question is whether people form a relationship with the pet and use shared care.

**Accessibility:** adjustable text size, high-contrast option, haptics toggle (native), reduced-motion option (respect `prefers-reduced-motion`), separate sound and music controls, semantic HTML and labels for UI, and **never encode state by color alone.**

**Localization:** English and Hindi from the start. No text baked into images or the canvas. Test Devanagari rendering and font loading early (use system fonts or a small subset, and count the bytes against the budget).

---

# 18. Project structure and engineering rules

```text
src/
  core/          pure TS, NO DOM/Preact/Pixi imports:
                 simulation, personality, bond, care days, ownership state machine,
                 command validation, seeded RNG, save schema + migrations, PetAI
  sync/          Mailbox interface, MemoryMailbox, Outbox, BudgetManager
                 firebase/  FirebaseMailbox (dynamically imported only)
  platform/      SaveStore, PurchaseService, Notifications, Share, Camera
                 web/  capacitor/  implementations
  render/        Pixi scene, room, pet rig, particles, asset loader
  ui/            Preact components (HUD, menus, shop, passport, settings)
  i18n/          t() helper + en.json, hi.json
public/          atlases, audio, icons, manifest, service worker
docs/            PLAN.md GAME_DESIGN.md PET_BEHAVIOR.md SYNC_PROTOCOL.md
                 OWNERSHIP_SPEC.md IAP_SPEC.md SAVE_SCHEMA.md
                 ART_ASSET_LIST.md ART_STYLE.md ASSET_LICENSES.md PERFORMANCE.md PRIVACY.md
firebase/        firestore.rules  firestore.indexes.json  tests/ (rules tests)
```

## Engineering rules

1. `core/` must not import from `render/`, `ui/`, `platform/`, or DOM APIs. Enforce with a lint rule (for example restricted imports).
2. The simulation never depends on the network.
3. The UI never mutates canonical pet state directly. It goes through the command layer.
4. The caretaker sends commands, never state.
5. Ownership transitions are explicit and atomic (Section 13).
6. Saves are versioned with migrations.
7. Purchase entitlement logic is separate from ownership logic.
8. Every network message has a protocol version.
9. Invites expire. No secrets in QR codes.
10. Do not trust remote or local timestamps blindly.
11. All Firebase access goes through `Mailbox`, and the game core never imports Firebase.
12. The renderer owns per-frame animation. Preact does not.
13. Never add a paid service or enable billing.
14. Write ownership tests before cosmetics.
15. Every dependency justifies its bytes, and budgets fail the build when exceeded.

---

# 19. Testing

## Unit tests (Vitest, fast, no browser)

- **Simulation:** one hour, one day, several days, 30-day cap, sleep recovery, decay, floors, bounds, invalid or negative timestamps, and **determinism** (same input, same output, run twice and compare).
- **Command validation:** permissions, unknown types, stale epoch, duplicate ids, oversized payloads, cooldowns, diminishing bond.
- **Care Days:** two-action rule, one per date, forward and backward date bounds, clock-forward cheating attempts.
- **Ownership state machine:** every state and transition, including invalid ones.
- **Outbox and budget:** persistence across reload, retry and backoff, expiry, batching, budget caps, sync levels.
- **Save:** migrations from every prior version, corrupt-file fallback, atomic write, export and import round trip.

## Firestore rules tests (Firebase Emulator Suite, free, local)

- Owner and caretaker can only do their allowed writes.
- A stranger cannot read or write a pair doc or list anything.
- Invite: claim only when open and not expired, and only once.
- Transfer: accept works only when pending and addressed to the caller, and epoch increments by exactly 1.
- **Race:** accept versus cancel. Exactly one succeeds.
- **Offline accept:** an accept attempted while offline must fail and never commit later.
- **Batches:** a caretaker can add only one new batch per write, with `t == request.time`, and cannot edit or remove batches. The owner can remove batches but not add or edit them. Two concurrent writes (caretaker adds, owner clears) both succeed without losing data.
- **Receipt:** a fake `accepted` receipt (no matching pair change) is rejected by the `getAfter()` rule.
- Old owner cannot write after the epoch changes.
- Oversized arrays and disallowed fields are rejected.

## Browser and end-to-end tests (Playwright, free)

- Smoke tests: the app loads, the pet appears, feed/water/play work, save survives reload.
- **Two browser profiles** (owner and caretaker) against the Firebase emulator: full pairing, commands, sync, transfer, and reconnect.
- Offline mode during outbox flush. Tab hidden and shown (elapsed simulation runs).
- System clock changed forward and backward.
- Simulated quota exhaustion, checking the UI shows friendly states.
- Basic visual screenshot checks for key screens.

## Performance checks

- The bundle-size check runs in CI or on build.
- Lighthouse (or equivalent) recorded at each phase gate.
- Manual DevTools check with 4x CPU throttling and mobile emulation. At the end of Phase 1, and before locking the art style, **one check on a real low-end Android phone** via the free hosted preview link. (The developer wants to avoid device testing early, and that is fine. This is a single confirmation before the art is locked, not ongoing testing.)

## Purchase tests (native, Phase 6)

Success, cancel, failure, restore, duplicate callback, refund or revocation, reinstall, using store sandbox and test tools.

---

# 20. Phases and gates

## Phase 0: Decisions and design docs

Resolve the open decisions (Section 3), including the art source and style (Section 25.1). `git init` and set up the free remote, hosting, and CI (Section 25.2). Set up Vite, TypeScript, Vitest, lint rules, and the bundle-size check. Produce `docs/PLAN.md` and the specs needed for Phase 1 (`GAME_DESIGN.md`, `PET_BEHAVIOR.md`, `SAVE_SCHEMA.md`, `ART_ASSET_LIST.md`, `ART_STYLE.md`, `PERFORMANCE.md`).
**Gate:** the developer approves the plan.

## Phase 1: Browser visual prototype (single-player vertical slice)

One room, one ferret, five excellent interactions (tap/pet, feed, water, play with one toy, sleep). Pure-TS simulation with tests. Elapsed-time simulation. IndexedDB save with **Export and Import backup**, the first-run naming and creation flow (Section 7.8), the dev clock tools (Section 25.7), and the tester feedback mechanism (Section 25.3). Personality-driven autonomous behavior. Layered-sprite rig with code-driven animation. Render-on-demand loop. PWA caching. Portrait mobile layout in the desktop browser. Hosted on a free static host for sharing (verify limits). No network game features, no shop.

**Scenario that must work:** open the page, a ferret walks around, tap it and it reacts naturally, feed it and it eats, play with a toy and it gets tired, close the tab, time passes, return, and it has slept and its needs changed with a short "what happened" summary.

**Gate (fun and speed):**
- The developer plays it, then about 5 to 10 other people try it via the hosted link. Agree pass criteria up front (for example most testers re-open it the next day and describe it as alive or cute), and record them in `docs/PLAN.md`. Measure them with the mechanism in Section 25.3, since Firebase Analytics is not in the web build.
- Budgets from Section 4 are met or consciously adjusted, with measured numbers in `PERFORMANCE.md`.
- **One real low-end Android confirmation** before the art style is locked.
- **If the pet is not fun, do not continue.** Iterate on the pet.

## Phase 2: Complete single-player

Groom, clean (with room mess), basic customization (clothing, toys, furniture) and the shinies economy, history, passport, accessibility basics, English and Hindi. (Backup import moved to Phase 1.)
**Gate:** stable for a week of daily use, budgets still met.

## Phase 3: Shared care (Firebase mailbox)

1. Firebase project (Spark only), anonymous auth, `Mailbox` with both implementations, emulator, rules with tests. Firebase loaded lazily.
2. Invite, claim, and approve flow with QR and typed code.
3. Commands, `validateCommand`, owner-side apply loop.
4. Outbox, caretaker predicted view, honest sync-status UI.
5. Budget manager, sync levels, Remote Config, debug usage screen.
6. App Check evaluation.

Tested with **two browser profiles against the Firebase emulator**, then against the real free project.
**Gate:** two browser profiles can pair, the caretaker feeds and plays while the owner's tab is closed, the owner sees the effects on next open, and write count per active pair per day is measured and reported. Firebase stays out of the initial bundle.

## Phase 4: Care Days, bond, ownership, recovery

Care Days with anti-cheat, milestones, transfer protocol, epoch and tombstone logic, Google account linking (web), reclaim flow, and the "Protect Mochi" step.
**Gate:** all ownership tests pass, including race and interruption tests, and transfer works end to end between two browser profiles with offline interruptions. Do not proceed until this is reliable.

## Phase 5: Native packaging (Capacitor, Android first)

Wrap the same code with Capacitor. Native `SaveStore`, local notifications, share sheet, camera scanning, back button and safe-area handling, platform backup, native Google sign-in for account linking. Measure startup, memory, battery, and frame rate on real Android devices, including a low-end one. Fix WebView-specific problems.
**Gate:** the native app matches the browser behavior, meets the performance budgets on a low-end phone, and passes the save and recovery tests.

## Phase 6: Monetization

Start with the **IAP spike** (Section 14). Then adoption IAP, transfer entitlement, cosmetic packs, restore purchases, and a shop that feels like a pet store, not a casino.
**Gate:** the purchase test matrix passes.

## Phase 7: Release preparation

Performance pass, accessibility pass, privacy policy, store listing and metadata, store policy review of the purchase and transfer flow, and a closed beta.
**Gate:** the MVP definition of done (Section 23). iOS only if funded.

---

# 21. Risks

| Risk | Mitigation |
|---|---|
| **The pet isn't fun** (biggest risk) | Phase 1 gate. Nothing multiplayer until it passes. |
| Free quota exhausted | Sparse sync, budget manager, sync levels, friendly failure. Owners unaffected. |
| Quota-exhaustion abuse | App Check evaluation, strict rules, monitoring |
| Bundle bloat, slow startup | Budgets enforced in the build, lazy Firebase, code splitting, dependency discipline |
| Slow on cheap phones | Render on demand, layered-sprite rig, capped DPR, one real low-end check before locking art |
| Browser build loses the pet | Export backup from Phase 1, `storage.persist()`, treat the browser as a preview |
| Losing a phone loses the pet | Account linking, backups, and the "Protect Mochi" gate |
| Transfer bugs create bad states | Epoch and transaction design, tombstones, race and interruption tests |
| Capacitor IAP plugin immaturity | Early IAP spike at the start of Phase 6 |
| Store-policy conflict with ownership design | Keep entitlement and ownership separate, review before release |
| Cross-engine simulation drift | Basic arithmetic and integer RNG only, determinism tests |
| Animation cost | One species, one room, layered rig, a few excellent behaviors |
| Notification fatigue | Local, rare, and meaningful only |
| Free-tier terms change | `Mailbox` abstraction, re-verify at Phase 3 and before release |
| Solo-developer overload | Small phases with gates, and cut scope rather than add it |

---

# 22. Documents to produce (in `docs/`)

1. `PLAN.md`: phased task list (Section 0, step 3).
2. `GAME_DESIGN.md`: exact needs, rates, interaction effects, bond and Care Day rules, progression, tuning numbers.
3. `PET_BEHAVIOR.md`: `PetAI` behavior state machine, personality weights, furniture effects, history event catalog.
4. `SYNC_PROTOCOL.md`: pair document, commands, versions, outbox, budget, sync levels.
5. `OWNERSHIP_SPEC.md`: owner, caretaker, and transfer state machine, epoch rules, recovery.
6. `IAP_SPEC.md`: products, entitlements, store flows.
7. `SAVE_SCHEMA.md`: versioned structure and migrations.
8. `ART_ASSET_LIST.md`: rig parts, animations, audio, UI, with sizes.
9. `ASSET_LICENSES.md`: the license of every third-party asset.
10. `PERFORMANCE.md`: budgets, measurements per phase, and decisions made to stay within them.
11. `ART_STYLE.md`: resolution, palette, line style, rig layout, coat list (Section 25.1).
12. `PRIVACY.md`: the privacy policy source, data inventory, and deletion flow (Section 25.5).

---

# 23. MVP definition of done

- A new player can create a ferret and it persists across restarts.
- Time-based simulation works while the app is closed. The pet has visible needs and personality-driven behavior, and never dies or is permanently harmed by absence.
- The player can feed, water, play, groom, and clean, and can customize the pet. Content floor: about 10 cosmetic items, 10 or more distinct pet behaviors/animations, and one mini-game.
- The game records meaningful history and shows a pet passport.
- The owner can back up and restore, and the recovery path is tested.
- A second player can pair using a secure, expiring invite. The owner approves and can revoke.
- The caretaker can care for the pet while the owner's app is closed. Commands queue and apply later.
- The caretaker cannot directly overwrite canonical pet state.
- Care Days and bond persist and resist local-clock cheating.
- Ownership transfer cannot produce two simultaneous owners, survives interruptions, and leaves the old owner with a read-only tombstone.
- Purchase and restore work, and basic refund paths were tested.
- The owner's game is fully playable offline, and no gameplay depends on a server the developer runs.
- **The game meets the light-and-fast budgets** (Section 4) on a low-end Android phone, and the bundle checks pass.
- Sync usage is measured and within a safe fraction of the free quota, and the app degrades gracefully when the quota is hit.
- No billing account is attached to the Firebase project.
- An owner signed in on two devices cannot run two live copies of the pet (`activeDeviceId`, Section 13.6).
- Account and data deletion works in the app and from a public web page (Section 25.5).
- The privacy policy is hosted at a public URL and matches what the app actually collects.

---

# 24. Verify before relying on it

Do not trust memory or this guide for the following. Check official documentation first.

- Firebase Spark limits (Firestore reads, writes, storage, per-day quotas), which products are free, and which need Blaze (Cloud Functions, Cloud Storage, App Check).
- Whether `get()` calls inside security rules bill as reads.
- Firestore transaction and security-rule semantics for the accept-versus-cancel race. Prove it in the emulator.
- Firebase JS SDK bundle sizes, tree-shaking behavior, and whether the "lite" build supports listeners or transactions.
- Remote Config default minimum fetch interval and free limits.
- Anonymous auth and account-linking behavior, plus auth and account-creation limits.
- Capacitor: current version, plugin support for storage, local notifications, camera, Google sign-in, in-app purchases, and Android WebView behavior on low-end devices.
- Browser storage eviction behavior (IndexedDB persistence) on the browsers and WebViews you target.
- `CompressionStream` support in target browsers and the Capacitor WebView.
- Free static hosting options and limits for the hosted preview.
- PixiJS current version, tree-shaking options, and measured bundle contribution. Preact compatibility with anything else you add.
- Apple and Google developer program fees, digital-goods and in-app-purchase policies, and Sign in with Apple requirements.
- Google Play Billing guidance on purchase verification without a backend.
- Child privacy rules (COPPA and store family policies) for the chosen audience.
- Discord webhook terms of service, if the optional webhook feature is built.
- Starting points for store documentation (recheck, they change): Google Play Billing (https://developer.android.com/google/play/billing, one-time products and lifecycle pages under it, and the backend-integration page for verification guidance) and Apple StoreKit (https://developer.apple.com/documentation/storekit/in-app-purchase, plus its sandbox testing page).
- Firestore: whether `serverTimestamp()` inside a map entry works with `request.time` equality in rules, whether field-level deletes on `batches.<id>` and `getAfter()` inside a multi-document transaction behave as designed, and whether `getAfter()` bills as a read. Prove all of these in the emulator before building on them.
- iOS Safari storage eviction (the 7-day rule) and whether an installed Home Screen PWA is exempt.
- Google Play's current account-deletion requirements, and Apple's, for apps that create accounts (anonymous accounts included).
- Minimum supported Android, WebView, and browser versions (Section 25.6).

---

# 25. Production and ops

Things the game needs that are not game design. None of them costs money.

## 25.1 Art plan

Art is the product, and it is the largest practical risk for a solo developer with no budget. Decide this in Phase 0.

- **Source.** Free pre-made ferret rigs basically do not exist. Options: the developer draws the rig in a free tool (Krita, Inkscape); a collaborator draws it; or a commissioned artist is paid from revenue later, with a placeholder-quality rig until then. Record the choice and the license of every asset in `docs/ASSET_LICENSES.md`.
- **`docs/ART_STYLE.md` before any final art.** It fixes the base resolution (for example a 2x asset for a 360 by 640 logical portrait viewport, capped DPR 2), the palette (keep it small, it also shrinks WebP files), the line style, the rig part list (body, head, ears, tail, four legs, eyes, mouth) with pivot points, and the coat list (Section 7.8).
- **Placeholder first.** Phase 1 can start with a flat-color placeholder rig to prove movement and personality before any polish. The gate asks whether the *movement* feels alive, and only then is the art style locked (after the low-end phone check).
- **Budget per coat.** Coats are tints or a tiny overlay atlas, not new full atlases.

## 25.2 Hosting, repository, CI

- `git init` in Phase 0, with a remote on a free host.
- Hosting for the browser build: **Firebase Hosting (Spark)**, **GitHub Pages**, or **Cloudflare Pages** (all have free tiers, verify limits and terms). Prefer whichever fits the repo host, and note that Firebase Hosting shares the project's Spark limits.
- CI on the free tier of the repo host (for example GitHub Actions): typecheck, lint (including the `core/` import restriction), Vitest, bundle-size check, and the Firestore rules tests from Phase 3.
- Never store secrets in the repository. Firebase web config is public, but service accounts and signing keys are not, and no service account is needed anyway.

## 25.3 Measuring the Phase 1 gate

The gate asks whether testers come back. The web build contains no Firebase, so it needs its own light measurement:

- **Local counters only** in the save (`sessions`, `firstOpenDate`, `lastOpenDate`, `interactionCounts`), shown on a tester-visible "About my pet" screen.
- **A one-tap feedback form** (a free hosted form or a `mailto:` link) that includes those counters, sent only if the tester chooses. No account and no tracking pixels.
- **Manual follow-up:** the developer asks each tester the next day whether they reopened it and how they would describe the pet.
- If real analytics are wanted later, add a tiny first-party opt-in ping or the lazy Firebase Analytics module, not before the privacy policy covers it.
- **Error reporting in the web build:** a small `window.onerror` handler that offers "copy error details" to the tester. Crashlytics is native-only.
- **iOS Safari testers:** tell them to use Add to Home Screen and Export backup, because their storage can be deleted after about 7 days (Section 8). Do not count a lost pet on non-installed iOS Safari as a gate failure.

## 25.4 Web build and paid adoption

Adoption is a paid in-app purchase in the native app (Section 14). If the public web build is fully playable and free, it bypasses that purchase. Decide one of these (Open Decision 13):

- **Closed preview.** The web build stays behind an unlisted link for testers and is not promoted. Recommended.
- **Free web tier.** The web build is a free, permanent version, with monetization only on cosmetics and the transfer entitlement.
- **Web is the product.** Adoption is sold on the web through a free-tier-compatible payment method. This needs a separate review, and this guide does not cover it.

## 25.5 Privacy policy and account deletion

- Google Play (and Apple) require an in-app way to start account deletion, and a public web page for it, when the app creates accounts. Verify current wording, since anonymous accounts may count (Section 24).
- **Delete flow:** signed in as the owner, "Delete my pet and data" removes `pairs/{petId}`, any open `invites/*` for it, `transfers/{petId}`, the local save, and the Firebase Auth user. A caretaker's "Leave" removes the caretaker from the pair and deletes their Auth user and local data. The deletion runs client-side, subject to the rules, because there is no server. Pair docs stranded by users who simply vanish get an `expiresAt`-style check where the owner deletes stale docs on next open. Document that gap honestly.
- **Privacy policy:** hosted at a public URL (the same free host works). It must match the data inventory in `docs/PRIVACY.md`: nicknames, pet summary, invites, transfer bundles, Auth uid, analytics and crash data if enabled, and purchases.

## 25.6 Minimum platform targets

Set and record these in Phase 0, and test against them:

- **Browsers:** current and previous major versions of Chrome, Edge, Firefox, and Safari (including iOS Safari), verified against the features in Section 24 (`CompressionStream`, IndexedDB persistence).
- **Android:** an explicit minimum OS version and minimum WebView version, chosen after checking Capacitor's requirement and what a low-end phone in the developer's region actually runs.
- Below the minimum, the app shows a plain "please update your browser or WebView" screen instead of a broken pet.

## 25.7 Developer tools

Testing time-based game rules by waiting is impractical. Ship a **debug panel** (excluded from production builds, or behind a hidden gesture in the closed preview) with:

- **Clock control:** advance the simulated clock by N hours or days, and set a fake "now" (used for elapsed-time tests, Care Day date bounds, and outbox expiry). It must route through the same single time source the game uses, never patch `Date` globally.
- **Seed override** for the RNG and personality.
- **Need setters** (set hunger or energy directly) and a "trigger this behavior now" list for `PetAI`.
- **Sync counters** (Section 11.5) and a switch to force `MemoryMailbox` failure modes: offline, quota exhausted, latency.
- **Save inspector:** view, export, and corrupt-on-purpose the save file, to test migrations and fallback.

## 25.8 PWA updates and native migration

- **Service worker updates:** use a versioned cache. On a new version, show "Update available" and reload when the player agrees, never mid-interaction. A new deploy that changes the sync protocol also raises `minProtocolVersion` (Section 11.3). Old cached clients must then prompt for an update before syncing, and the game stays playable offline.
- **Save migrations run before the new UI loads.** A failed migration keeps the old save untouched and offers Export.
- **Moving testers from the browser build to the native app:** the two have different storage, so the path is Export backup in the browser, then Import in the app. Test this round trip, including a save from an older `schemaVersion`. Publish it as a one-screen "Move to the app" guide.

## 25.9 Localization and accessibility details

- **Hindi translation:** decide who translates and reviews it (Phase 2 needs it). Machine translation alone is not acceptable for the shipped strings.
- **Screen readers:** expose pet state changes in an `aria-live="polite"` region ("Mochi is hungry", "Mochi fell asleep"), because the canvas itself is not readable. Keep updates infrequent so it does not chatter.
- **Names:** limit pet and player nicknames to 1 to 16 characters, validated on the client, on the owner, and in rules, with Devanagari and emoji counted as grapheme clusters, not bytes.

---

**The first target is not the shop and not multiplayer. It is: open the page and immediately feel like there is a little creature living there, loading fast and running smoothly.**
