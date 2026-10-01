# Game design: the Roblox slice

Same game as the main project, cut to the smallest version that can answer the four questions in `README.md`. Numbers come from `docs/GAME_DESIGN.md` (sections 2 to 4) so that what we learn on Roblox applies to the real game. If a number changes there, change it here too.

## 1. The slice in one paragraph

You adopt a ferret and name it. It lives in a cozy room, walks around, sniffs, plays, eats, drinks, and sleeps by itself. You can feed it, give it water, pet it, play a short toy-chase game, or put it to bed. It gets hungry and sleepy slowly, never dies, and is always fine when you come back. You can invite **one** other person with a code. They can care for the same pet any time, even when you are offline. When you come back, you see what they did.

## 2. Screens

All screens are built with Roblox UI (ScreenGui), portrait-friendly, readable on a phone. No avatar walking around: the camera is fixed on the room (`04_TECH_PLAN.md`).

| # | Screen | What it does |
|---|---|---|
| 1 | Title | Two buttons: **Adopt a ferret**, **Care for a friend's ferret** (enter a code). Shows the room and a ferret behind the buttons |
| 2 | Name | Text box, 1 to 16 characters. Filtered by Roblox before it is saved. Clear errors ("Pick a shorter name"). One-line personality intro after ("Mochi is curious and a bit shy") |
| 3 | Home | The room, the ferret, a needs bar at the top (hunger, water, energy, happy, each with an icon and a word), an action bar at the bottom (Feed, Water, Play, Sleep), a menu button |
| 4 | Menu | Share care, Wardrobe, About my pet, Feedback, Credits |
| 5 | Share care (owner) | "Invite someone": shows a 6-character code with the text "Share this with one person. It works for 24 hours." Then shows status: waiting, or "Riya is caring for Mochi", with a "Stop sharing" button |
| 6 | Join (caretaker) | Type the code. Success: "You are now helping care for Mochi, Sam's ferret". Failure: plain message (wrong code, expired, already has a helper) |
| 7 | Welcome back | Shows when you return after 30 minutes or more: "Mochi slept 7 hours", the partner's care first ("Riya fed Mochi at 9:12"), then one mood line. Never mentions how long you were away, never guilt |
| 8 | Wardrobe | The shop test (section 6) |
| 9 | About my pet | Name, owner, helper, favorite food, favorite toy, personality words, days together. Also the place for the tester counters |
| 10 | Feedback | Three questions, a text box, the Google Form link as selectable text |
| 11 | Credits | Author credit if any third-party art is used (`07_LAUNCH_AND_TESTING.md`) |

## 3. The pet

### 3.1 State (hundredths, as in the main game)

| Field | Range | Start |
|---|---|---|
| hunger, hydration, energy, happiness | 0 to 10000 (display 0 to 100) | 7500, 8000, 8000, 7000 |
| bond | 0 to 10000 | 1000, never decays |
| sleepState | awake or asleep | awake |
| traits: mischief, curiosity, affection | 0 to 100 | from the pet's seed |
| favoriteFood, favoriteToy | from a short list | from the seed |
| coat | sable, cinnamon, panda, albino | from the seed (weights 40, 25, 20, 15) |

The pet **cannot die**. Needs never go below 1000 from time passing alone.

### 3.2 Time passing (the simulation)

Runs in 10-minute steps from the stored `lastSimulationTime` to now, so being away is simply many steps at once. Same as `docs/GAME_DESIGN.md` §3. Per step:

| Need | Awake | Asleep |
|---|---|---|
| hunger | -50 | -17 |
| hydration | -67 | -25 |
| energy | -67 | +167 |

Happiness each step moves toward `baseline = (needsAvg x 70 + bond x 30) / 100` by one twelfth of the gap, at least 1. Floor 1000 on all four. A run is capped at 30 days.

Sleep, in local time of the owner:

| Time class | When | Falls asleep per step | Minimum sleep | Energy to wake | Wake chance per step |
|---|---|---|---|---|---|
| night | 22:00 to 06:59 | 30% | 2 h | 8500 | 15% |
| nap | 12:00 to 15:59 | 12% | 1 h | 6500 | 40% |
| day | other | 1% | 30 min | 6500 | 60% |

Energy 2000 or less forces sleep at once. Goal: about 10 to 11 hours of sleep a day, heavy at night, one midday nap. Sleep is texture: any care action wakes the pet.

### 3.3 Actions

| Action | Rule | Effect |
|---|---|---|
| Feed | Refused if hunger is 9000 or more. Wakes a sleeping pet | hunger +2500. Favorite food: +3500 and happiness +500 |
| Water | Refused if hydration is 9000 or more. Wakes a sleeping pet | hydration +3500 |
| Pet | Tap the ferret. Always a reaction. A **session** is a 2-second press, or 3 taps within 10 seconds | Session: happiness +300, bond by the table below. A tap on a sleeping pet wakes it, and costs happiness 300 only when energy is under 5000 |
| Play | Energy must be 2000 or more. Wakes a sleeping pet | Starts the mini-game. On finish: energy -1500, happiness +500 + band x 400, bond by the table. Reward at most once per 30 minutes |
| Sleep | Pet awake and energy under 9000 | Puts the pet to bed. It wakes by itself |

Bond per action type per local day (repeat taps never count): pet session 100, then 50, then 0. Feed (hunger under 9000) 50, 25, 0. Play (band 1 or more) 150, 75, 0. Bond max 10000.

**Both players follow the same rules.** The helper's actions count the same as the owner's. The daily bond limits are shared (one counter per pet, not per person), so two people cannot double the bond by taking turns.

### 3.4 Behavior (what the ferret does on its own)

Keep it small. Eight states, picked with weights from the traits, the needs, and the time of day: `idle`, `wander`, `sniff`, `curious`, `run` (zoomies), `eat` (only after a feed), `drink` (only after water), `sleep`.

| Trait | Effect |
|---|---|
| curiosity | more `sniff` and `curious`, a little less likely to fall asleep (up to 4 points) |
| mischief | more `run` |
| affection | settles to sleep a bit sooner at night, comes toward the player's tap |

Rules: no state repeats more than twice in a row, each state has a short cooldown, needs come first (a hungry pet goes to its bowl). Details of the main game's version are in `docs/PET_BEHAVIOR.md`. Cut for the Roblox slice: stealing the sock, the daily found item.

### 3.5 Mini-game: toy chase, lite

About 20 seconds. The player taps a spot on the floor. A toy lands there. The ferret runs to it and pounces. A **catch** counts when the ferret reaches a toy that has just landed. The toy must move at least 3 studs from the last catch before the next one counts, so tapping the same spot does nothing. Result band from catches: 0 to 1 is band 0, 2 to 4 is band 1, 5 to 7 is band 2, 8 or more is band 3. Only the band goes to the server, and the server checks it (`04_TECH_PLAN.md` section 6). Failing is gentle: band 0 still gives the energy cost and a small happiness gain, and the ferret does something cute.

## 4. Sharing: the flow

```text
Owner                                   Helper
-----                                   ------
Menu > Share care > Invite someone
Code shown: K7M2QX  (24 hours)  ──────► (owner tells them, in person or by message)
                                        Title > Care for a friend's ferret
                                        Types K7M2QX
                                        "You are now helping care for Mochi"
                                        Helper's home shows Mochi, labeled "Sam's Mochi"
                                        Helper feeds Mochi
Owner joins later:
Welcome back: "Riya fed Mochi at 9:12"
```

Rules:

- One helper per pet. A code works once and expires after 24 hours.
- The owner can **Stop sharing** any time. The helper can **Leave** any time. Nothing is lost.
- The helper can also adopt their own ferret. They then have "My ferret" and "Sam's Mochi" and switch between them.
- A **partner-care toast** appears when the other person's care arrives while you are in the game ("Riya fed Mochi 2 minutes ago"). It is shown at most once per event and never nags.
- Show "last cared for by Riya, 3 hours ago" on the About screen. This is the visible-care feeling players of Pengu and Pokipet praise (`docs/MARKET_RESEARCH.md`).
- Ownership transfer (the helper becomes the owner) is **cut** for this test.

## 5. Tone and rules from the main project

- No death, no guilt, no streaks, no timers that block care, no punishment for skipping days.
- No ads. Basic food and water are always free and unlimited.
- All text through a `t()`-like table so Hindi can follow later (keep strings in one ModuleScript).
- Never encode state by color alone: each need has an icon, a label, and a word (Low, Okay, Good).
- Touch first: buttons at least 44 by 44 pixels on a phone, no hover.
- No chat and no free text except the filtered pet name and the feedback box.
- Ferret-specific charm comes before features. If time is short, spend it on animation polish, not new systems.

## 6. The money test

Open "Wardrobe" from the menu. It shows three pet items with prices in Robux, all clearly cosmetic:

| Item | Price | Type |
|---|---|---|
| Red bow | 25 Robux | **Real** Developer Product. Buying it puts the bow on the ferret |
| Tiny hat | 35 Robux | **Not for sale yet.** Pressing Buy shows "Coming soon, thanks for telling us!" and logs `shop_click` |
| Cozy scarf | 35 Robux | Same as the hat |

Rules: never block care, never use scarcity or countdowns, never show random items, always say clearly when something is not yet available. The aim is to count interest (`01_VALIDATION_PLAN.md` H4), not to make money.

## 7. Mapping to the main game

| Main game | Roblox slice |
|---|---|
| Shared care by Firebase mailbox, invite by QR or code | One DataStore record, invite code in MemoryStore |
| Owner authoritative, caretaker predicted view | One record, atomic updates, every viewer sees the same state |
| Care Days, bond milestones, ownership transfer | Cut. Bond exists, Care Days and transfer do not |
| Shinies, shop, packs | One real product and two interest buttons |
| Mini-game: toy chase by dragging | Tap-to-place toy chase |
| History, passport, share card | Cut. "About my pet" only |
| English and Hindi | English only, strings in one table |
| Canvas or three.js ferret | Parts and joints ferret, moved by code |

## 8. Cut list (do not build for this test)

Ownership transfer, Care Days, shinies, a history screen, a passport or share card, photos, more than one pet species, more than one room, eggs, rarity, trading, chat, limited-time pets, groom and clean, daily found item, stealing the sock, sound effects (add one or two later only if testers ask), notifications.

If you feel the urge to add something, write it in a "later" list in your notes and keep going.
