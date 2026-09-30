# Pet Behavior (Phase 1)

How the ferret chooses what to do, and what the game remembers. Source: guide §7.4, §7.6, §7.7, §9.1. Numbers are starting values, tuned in Part 1E. Needs and sleep rules are in `GAME_DESIGN.md`.

## 1. Two layers

| Layer | Runs | Purpose |
|---|---|---|
| **Coarse simulation** (`simulate`, in `core`) | on open, on tab visible, when applying commands | Needs, sleep, and a few memorable events for time away. Deterministic. |
| **PetAI** (in `core`, driven by the app) | while the app is open, every decision tick | Picks the visible behavior. Personality lives here. |

PetAI is pure TypeScript: it takes state, room, time, and an RNG, and returns the next behavior. The renderer plays it. The renderer never decides behavior.

PetAI is seeded with `hash(petId, decisionCounter)` so tests can replay it. It does not need to match across devices, because only the owner runs it and the caretaker sees just `currentActivity` from the summary (guide §10.7).

## 2. Behaviors (Phase 1)

Matches the "build first" animation list in guide §9.1.

| Behavior | Animation | Notes |
|---|---|---|
| `idle` | idle breathing, blink, ear movement | Default. Blink and ear twitch run on their own timers inside the renderer. |
| `wander` | walk | Moves to a random point in the room. |
| `sniff` | sniff | Short, stops at a point of interest. |
| `curious` | walk, then sniff at a prop | Goes to investigate a prop. |
| `eat` | eat | Only when a bowl has food (player put it there). |
| `drink` | drink | Only when the water bowl is filled. |
| `playful` | walk fast, hop (zoomies) | Short energetic burst. |
| `steal` | walk, pick up, carry, stash | The mischief behavior. Carries an item (toy or sock) toward the hammock. Logs `PET_STOLE_ITEM`. |
| `sleep` | sleep (curled, breathing) | Chosen by the sleep rules in `GAME_DESIGN.md`, not by weights. |

Reactions triggered by interactions, not chosen by AI: `happy`, `annoyed` (woken up, refused), `surprise`.

## 3. Choosing a behavior

Every decision tick (each time the current behavior ends, at least 2 seconds and usually 4 to 12), PetAI scores each allowed behavior with integers, then picks one **at random weighted by score** using the seeded RNG. A behavior with a score of 0 or less is not eligible.

```text
score(b) = base(b) + traitTerm(b) + needTerm(b) + timeTerm(b) + roomTerm(b)
```

| Behavior | base | traitTerm | needTerm | timeTerm | roomTerm |
|---|---|---|---|---|---|
| `idle` | 30 | +20 when `affection` under 30, plus `(100 - mischief) / 8` (calm pets settle) | +20 when `energy` under 3000 | +10 in the day class | none |
| `wander` | 25 | `curiosity / 4` | none | -10 in the night class | none |
| `sniff` | 15 | `curiosity / 3` plus `(100 - mischief) / 10` | none | none | +10 when a prop is nearby |
| `curious` | 5 | `curiosity / 2` | none | none | +20 when any prop is in the room |
| `eat` | 0 | none | `(10000 - hunger) / 100` when hunger is below 6000 | none | requires food in the bowl |
| `drink` | 0 | none | `(10000 - hydration) / 100` when hydration is below 6000 | none | requires water in the bowl |
| `playful` | 5 | `mischief` | `energy / 400` when happiness is at least 6000. Needs `energy >= 2500` | +10 in the nap and night wake bursts | none |
| `steal` | 0 | `mischief / 2` when `mischief >= 50` | none | none | requires a stealable item and no steal in the last 12 hours |

Rules on top of the table:

- **High affection:** while the player's pointer is in the room and `affection >= 60`, add `affection / 3` to `wander` and move toward the last touch point. The pet sleeps near the player's last touch when it goes to sleep. (Guide §7.4.)
- **Needs first:** if `hunger` or `hydration` is under 3000 and the matching bowl has content, the matching behavior gets +50, and `playful` and `steal` are switched off until it is fed. A pet never plays or schemes while urgently hungry with a stocked bowl.
- **No back-to-back repeats** of `steal` or `playful`: at least 2 decisions between two of the same kind (`AI_COOLDOWN_TICKS = 2`). A 3 tick cooldown was tried first, and it flattened the personality difference (both a mischievous and a calm pet reached the cap).
- **Sleep** is not scored here. The sleep rules from `GAME_DESIGN.md` run first each tick.
- **Asleep:** PetAI does nothing except check the wake rule. The render loop stops (guide §4.4) until the pet wakes or the player touches it.

Personality has to be visible. Test target for Part 1E, met and guarded by tests: over 1000 decisions, a high-mischief pet (85) against a low one (15) steals far more (about 137 against 0), plays about 1.5 times as often (219 against 145), and idles and sniffs less (idle 146 against 213, sniff 163 against 189).

**Tuning history (2026-09-30):** the first weights (`playful` = `5 + mischief / 3 + energy / 200`, cooldown 3) gave almost the same playful count for every pet, because the energy term was shared and the cooldown capped everyone. `steal` was distinct from the start because it needs `mischief >= 50`.

**Steals have two sources, kept separate.** While the app is open, PetAI performs them on screen. The elapsed-time simulation (`simulate`) logs unseen steals for time away, with the same rules (`mischief >= 50`, 12 hours apart). The brain turns the simulation's steals off for gaps under 30 minutes, so nothing is counted twice.

## 4. Traits, favorites, coat: generated from the pet id

`seed = hashString(petId)`. Values are drawn with `createRng(seed)` in this fixed order, so the same pet id always gives the same pet:

1. `mischief` = `range(5, 95)`
2. `curiosity` = `range(5, 95)`
3. `affection` = `range(5, 95)`
4. coat by the weights in `GAME_DESIGN.md` section 10
5. `favoriteFood` = one of `chicken`, `egg`, `salmon`, `kibble`
6. `favoriteToy` = one of `ball`, `sock`, `feather`, `ring`
7. `favoriteActivity` = one of `chase`, `dig`, `hide`, `climb`

Never reorder these draws after release. Changing the order changes every existing pet. Adding a draw at the end is safe.

## 5. Room (Phase 1)

One room, fixed layout, no customization yet (guide §7.6, §5).

| Prop | Purpose | Behavior effect |
|---|---|---|
| Food bowl | Feed target | Enables `eat` while it holds food. |
| Water bowl | Water target | Enables `drink` while it holds water. |
| Toy (the pet's favorite toy) | Play target | Enables `playful`, mini-game via `StartPlay`. |
| Hammock | Bed and sleep spot | Pet goes there to sleep. `PutToBed` walks the pet to it. |
| Sock | Stealable item | Enables `steal`. |

Furniture that changes behavior (tunnel, blanket, climbing structure) and `mess` arrive in Phase 2. `mess` is not simulated in Phase 1.

## 6. History (guide §7.7)

Memorable events only, never low-level stat changes. Each event: `id`, `t` (epoch ms), `type`, `actor` (`owner`, `caretaker`, or `pet`), small `payload`. Store the last 500 events (guide §7.7).

Phase 1 events:

| Type | Actor | When | Payload |
|---|---|---|---|
| `PET_ADOPTED` | owner | Pet created | name |
| `PET_FED` | owner | First feed of the local day, or a favorite food | foodId |
| `PET_PLAYED` | owner | A play session with band 1 or higher | band |
| `PET_STOLE_ITEM` | pet | `steal` behavior ends | itemId |
| `PET_FOUND_ITEM` | pet | Daily found item | itemId |

Full starter catalog for later phases is in guide §7.7 (`PET_GROOMED`, `PET_DRESSED`, `ROOM_CLEANED`, `MILESTONE_REACHED`, `CARETAKER_ADDED`, `CARETAKER_REMOVED`, `TRANSFER_REQUESTED`, `TRANSFER_ACCEPTED`, `OWNERSHIP_TRANSFERRED`). Add them when their feature exists.

## 7. Daily found item

Once per owner-local calendar date, at the first awake step of that date, the pet "brings" something. Chosen from a small list with the seeded RNG, weighted by traits (curiosity raises odds of odd items):

`button`, `bottle cap`, `hair tie`, `paper scrap`, `feather`, `foil ball`, `single earring`.

In Phase 1 it is flavor only: a history event and a line in the welcome-back summary. In Phase 2 the item feeds the shinies economy (guide §7.8). No streak, no penalty for missing a day.

## 8. Welcome-back summary rules

Built from the `simulate` event list plus the need change, shown when the time away is at least 30 minutes.

1. Time asleep, in hours, rounded.
2. Up to 3 notable events, newest first: stole an item, found an item, slept long.
3. One mood line from the derived mood.
4. Never mention how long the player was gone in a guilt-inducing way. Say what the pet did.

Example shape (text keys in `en.json`, using the pet's name): "Mochi slept about 7 hours. Mochi stole a sock and found a bottle cap."

## 9. Debug hooks (Part 1H)

The dev panel can trigger any behavior now and override the seed (guide §25.7). PetAI must expose a `force(behavior)` entry point for that, kept out of production builds.
