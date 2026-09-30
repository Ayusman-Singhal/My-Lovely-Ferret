# Game Design (Phase 1 numbers)

Exact rules and starting numbers for the Phase 1 single-player slice. Source: guide §7, §12, §20. Every number here is a **starting value**, tunable during Phase 1. When a number changes, change it here in the same commit. Items marked *Phase N* are decided later and only sketched.

## 1. Conventions

- **Fixed point.** Needs and bond are integers in hundredths: 0 to 10000 means 0.00 to 100.00 (guide §7.1). Display divides by 100 and rounds down.
- **Time in the simulation is integer epoch milliseconds.** The simulation never reads a clock. Time is passed in. (Proposed deviation D1: the guide's save example shows ISO strings. See `SAVE_SCHEMA.md`.)
- **Step.** The simulation advances in steps of 10 minutes (600,000 ms).
- **Traits are integers 0 to 100** (the guide says 0 to 1). Proposed deviation D2, so no floats appear in core.
- **Local time.** Time of day, and the calendar date used for daily limits, come from the owner's fixed offset `tzOffsetMin`, never the device zone (guide §7.2). `localMinuteOfDay = ((utcMs / 60000 + tzOffsetMin) mod 1440 + 1440) mod 1440`.

## 2. Pet state (Phase 1)

| Field | Range or type | Notes |
|---|---|---|
| `hunger`, `hydration`, `energy`, `happiness` | 0 to 10000 | Higher is better. `hunger` 10000 means full. |
| `bond` | 0 to 10000 | Starts at 1000 (10.00). Never decays. |
| `sleepState` | `awake` or `asleep` | |
| `currentActivity` | enum | See `PET_BEHAVIOR.md`. Used for display and the later summary. |
| `favoriteFood`, `favoriteToy`, `favoriteActivity` | enum | Fixed at creation. |
| `lastInteractionTime`, `lastSimulationTime` | epoch ms | |
| Traits: `mischief`, `curiosity`, `affection` | 0 to 100 | Fixed at creation from the pet id. |
| `mood` | derived | Never stored. See section 5. |

`trust`, `hygiene`, `enrichment` do not exist (guide §7.1, §0).

New pet starting values: hunger 7500, hydration 8000, energy 8000, happiness 7000, bond 1000, awake.

## 3. Elapsed-time simulation

`simulate(state, elapsedMs, tzOffsetMin)` returns the new state and a list of memorable events (guide §7.2).

1. `elapsedMs` below 0 becomes 0. Above 30 days (4320 steps) it is capped at 30 days.
2. `steps = floor(elapsedMs / 600000)`. The remainder is **not** consumed: `lastSimulationTime` advances by exactly `steps * 600000`. This makes `simulate(simulate(s, a), b)` equal `simulate(s, a + b)` when `a` and `b` are multiples of a step, which the caretaker's predicted copy relies on (guide §10.7).
3. Each step uses its own RNG, seeded from `petId` and the start time of that step (`simulationSeed`). The guide says "seed from petId + lastSimulationTime". Seeding per step keeps chunked and one-shot runs identical. (Refinement R1, no deviation from intent.)
4. Per step, in this order: sleep transition, need decay or recovery, happiness drift, autonomous events.

### 3.1 Need rates

Per 10-minute step, in hundredths. Rounded from the guide's hourly rates so every value is an integer. "Hourly equivalent" is for reference only.

| Need | Awake | Hourly equivalent | Asleep | Hourly equivalent |
|---|---|---|---|---|
| hunger | -50 | -3.00 | -17 | -1.02 |
| hydration | -67 | -4.02 | -25 | -1.50 |
| energy | -67 | -4.02 | +167 | +10.02 |

**Floor.** Decay from inactivity never takes hunger, hydration, energy, or happiness below **1000 (10.00)** (guide §7.2). Values already below the floor (impossible in normal play) are left alone. Interactions can raise needs up to 10000. No death and no permanent damage.

### 3.2 Happiness

Happiness does not decay directly. Each step it moves toward a baseline:

```text
needsAvg  = (hunger + hydration + energy) / 3            (integer division)
baseline  = (needsAvg * 70 + bond * 30) / 100            (integer division)
gap       = baseline - happiness
delta     = trunc(gap / 12)                              (about a 2 hour time constant)
if gap != 0 and delta == 0: delta = sign(gap)
happiness = clamp(happiness + delta, 1000, 10000)
```

Enrichment is not an input in Phase 1 (guide §7.1).

### 3.3 Sleep

Local hour classes (owner time). Numbers live in `src/core/tuning.ts`.

| Class | Local time | Fall asleep per step (awake) | Minimum sleep* | Energy needed to wake* | Wake chance per step (once rested) |
|---|---|---|---|---|---|
| night | 22:00 to 06:59 | 30% | 2 hours | 8500 | 15% |
| nap | 12:00 to 15:59 | 12% | 1 hour | 6500 | 40% |
| day | all other hours | 1% | 30 minutes | 6500 | 60% |

\* By the class the sleep **started** in. The wake chance uses the class at the moment of waking.

**Design goal (developer request, 2026-09-30):** realistic but not a time sink, and not so little that the pet feels lifeless. Target about 40 to 45% asleep (10 to 11 hours a day), heavy at night with one midday nap, and awake when players usually open the app (mornings after about 08:30, and 16:00 to 22:00). Sleep is texture, never a gate: any care action wakes a sleeping pet (section 4.2).

- Awake with `energy <= 2000`: falls asleep at once, whatever the hour class.
- Asleep with energy below the "energy needed to wake" for its start class: keeps sleeping, however long it has slept.
- Asleep with enough energy **and** the minimum sleep for its start class served: wakes with the class's wake chance each step. Full energy alone never wakes the pet.
- Naps stay short because a nap or daytime snooze needs only 6500 energy to end. With the night threshold, a nap from 60% energy would last 2.5 hours or more.
- Why the minimum exists: without it a rested pet fell asleep by chance at night, hit full energy, and woke on the next step, flipping awake and asleep every 10 minutes (16 to 30 sleep blocks per day in the first measurement, found by a test on 2026-09-30). The minimum gives ferret-like long sleeps with short bursts (guide §7.2).
- Personality tilt, in percentage points: `-trunc((curiosity - 50) / 10)` on the fall-asleep chance in every class (curious pets stay up a little longer, up to 4 points), and `+trunc((affection - 50) / 10)` at night (affectionate pets settle sooner).
- **Measured** with 24 sample pets over 30 days untouched (2026-09-30), after the retune for the developer request: asleep 45% of the time on average (10.8 hours a day; 39% to 52% across pets), about 5 sleep blocks per day, longest block about 6.5 hours. By local hour: 23:00 to 06:59 about 81% to 95% asleep, 08:00 about 23%, 09:00 to 11:59 about 6% to 7%, midday nap 12:00 to 15:59 about 30% to 52%, 17:00 to 21:59 about 6% to 7%, 22:00 about 55%. Real ferrets sleep 14 to 18 hours; 10 to 11 is the deliberate compromise. First measurement, before the request, was 50% to 61%.
- This is a tuning starting point. Revisit after playing it (Part 1J), and if testers say the pet is asleep too often or feels lifeless, change `fallAsleepPct` in `src/core/tuning.ts` and update this section.
- Test guards: a night sleep starting at 22:00 with energy 4000 lasts at least 4 hours; the availability test bounds blocks per day, the overall share (35% to 55%), and the night, morning, nap, and evening shares.

### 3.4 Long absence

The pet mostly sleeps, wakes for a few bursts, and drifts toward mild neediness. After a long absence needs sit near the floor at worst, and the welcome-back summary (section 8) explains what happened. Nothing is lost.

### 3.5 Events returned by `simulate`

Only memorable things (guide §7.7). Phase 1 catalog:

| Event | When |
|---|---|
| `PET_SLEPT_LONG` | A continuous sleep of 6 hours or more ended. Payload: hours. |
| `PET_STOLE_ITEM` | Autonomous steal during time away (see `PET_BEHAVIOR.md`). Only pets with `mischief >= 50`. Chance per awake step is `mischief / 20` percent, at most once per 12 hours. While the app is open PetAI performs steals on screen instead, and the simulation's steals are off for gaps under 30 minutes. |
| `PET_FOUND_ITEM` | Daily found item, once per local calendar date, at the first awake step of that date. |

## 4. Interactions

All effects are applied by the command layer in `core` (guide §18 rule 3). "Refuse" means the pet plays a refusing animation and nothing changes.

| Command | Preconditions | Effect (hundredths) |
|---|---|---|
| `FeedPet(foodId)` | `hunger < 9000`. A sleeping pet is woken first (section 4.2). | hunger +2500. Favorite food: hunger +3500 and happiness +500. |
| `GiveWater` | `hydration < 9000`. A sleeping pet is woken first (section 4.2). | hydration +3500. |
| `PetTouch` | any state | Reaction animation always plays. A **session** (long press of 2 seconds or more, or 3 or more taps within 10 seconds) gives happiness +300 and bond by the diminishing table below. Single taps give the reaction only. If asleep: wakes the pet, happiness -300 when `energy < 5000`. |
| `StartPlay(toyId)` | `energy >= 2000`. A sleeping pet is woken first (section 4.2). | Starts the mini-game (section 7). Otherwise the pet refuses (too tired). |
| `FinishPlay(band)` | after `StartPlay` | energy -1500. happiness +500 + `band` * 400. Bond by the diminishing table when `band >= 1`. Band is clamped to 0 to 3. Reward applies at most once per 30 minutes of simulation time. |
| `PutToBed` | pet awake, `energy < 9000` | Sets `sleepState` to `asleep`. Wake-up is automatic. Refuses (not sleepy) otherwise. |

Basic food and water are always free and unlimited (guide §7.8, §14). Refusing at 9000 is a comfort rule, not a limit on how often the player may care.

*Phase 2:* `GroomPet` (bond and happiness), `CleanRoom`, `EquipOutfit`.

### 4.1 Bond and diminishing returns

Counted **per interaction type, per owner-local calendar date**. Repeated taps never count (guide §7.5, §12.2).

| Type | 1st meaningful session that day | 2nd | 3rd and later |
|---|---|---|---|
| pet session | +100 | +50 | 0 |
| feed (with hunger below 9000) | +50 | +25 | 0 |
| play (band 1 or higher) | +150 | +75 | 0 |

Bond is capped at 10000. The daily counters live in the pet state and reset when the local date changes.

### 4.2 Waking a sleeping pet (sleep never blocks care)

Players must never have to wait for the pet to wake up, and never need an extra "wake up" step before caring (developer request, 2026-09-30).

- **Feed, water, and play wake the pet and then apply their effect in the same action.** No happiness cost. The pet wakes with a short sleepy animation, then does the thing.
- **A plain tap or pet session on a sleeping pet wakes it.** Costs happiness -300 only when `energy < 5000` (the pet was truly tired). A gentle tap on a rested pet is free.
- Waking sets `sleepState` to `awake` and clears `sleepStartedAt`. The normal sleep rules then apply again: a woken pet may fall asleep again on its own, and one at `energy <= 2000` falls asleep at once (play refuses at that energy anyway).
- Wake-ups by the player are never logged as history events.

## 5. Mood (derived)

First matching rule wins. All thresholds are hundredths.

1. `needy`: hunger or hydration below 3000.
2. `sleepy`: energy below 3000.
3. `playful`: happiness at or above 7000, energy at or above 6000, and `mischief >= 60`.
4. `happy`: happiness at or above 7500.
5. `content`: otherwise.

## 6. Core loop (guide §7.8)

A session is 1 to 3 minutes: open, read the "what happened" summary, care for the one or two needs that are low, play the mini-game once, watch the pet. A daily found item gives a reason to return. **No timers gate care, no streak penalties, no punishment for skipping days.** No notifications in the web build.

## 7. Mini-game: toy chase (guide §7.8)

- About 20 seconds. Pointer only. The player drags a toy around the room, and the ferret chases it and pounces.
- One **catch** = the ferret reaches the toy while it is still or slow. Score is the number of catches.
- Result band from catches: 0 to 1 catches is band 0, 2 to 4 is band 1, 5 to 7 is band 2, 8 or more is band 3.
- The band is the only thing sent to `FinishPlay`. Raw scores never leave the mini-game (guide §7.8).
- Failing is gentle: band 0 still gives energy cost and a small happiness gain, and the pet does something cute.

## 8. Welcome-back summary

Shown when the time away is at least 30 minutes (3 steps). Built from the events list and the change in needs. Content: total time asleep (in hours, rounded), notable events (stole an item, found an item), and one line about current mood. Tone: warm, never guilt. Text keys live in `en.json` (Part 1G).

## 9. Onboarding and creation (guide §7.8)

```text
Adopt: Launch -> "Adopt a pet" -> ferret preview -> create pet -> name it
       -> short intro showing its personality -> one tap prompt per interaction
       (shown the first time it is possible) -> home
```

- The first-launch screen shows the pet in the room behind two buttons: "Adopt a pet" and "Care for a friend's pet". In Phase 1 the second button is present but disabled with a "coming soon" note.
- **Name rules:** 1 to 16 **grapheme clusters** (Devanagari and emoji count as clusters, not bytes, guide §25.9), no leading or trailing spaces, no control characters. The UI trims input, and the same validator runs again in core.
- Traits, coat, and favorites come from the pet id seed (see `PET_BEHAVIOR.md` and `SAVE_SCHEMA.md`).
- The pet id is a random UUID made at creation with `crypto.randomUUID()` in the platform layer and passed into core.

## 10. Coats (palette swaps, guide §7.8)

Chosen from the seed. Weights (out of 100): sable 40, cinnamon 25, panda 20, albino 15. Tints are defined in `ART_STYLE.md`.

## 11. Deferred numbers

| Topic | Phase | Note |
|---|---|---|
| Shinies earn rates and daily cap, item prices | 2 | Earned only by caring. Never bought, never needed for survival. |
| Groom and clean effects, mess creation | 2 | Mess has no effect on needs (guide §7.6). |
| Care Day rules and milestones (7, 14, 30, 50, 100) | 4 | Guide §12.1. |
| Ownership transfer eligibility | 4 | 30 Care Days or the fast-transfer entitlement. |
