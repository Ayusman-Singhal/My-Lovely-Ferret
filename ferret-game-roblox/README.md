# Ferret on Roblox: a side track to test the idea

Started 2026-10-01. This folder is a **validation prototype**, not the shipped product. The shipped product is still the web and Android game described in `CLAUDE.md` and `docs/PLAN.md`. Nothing here changes `src/`, the stack, or the phases. The goal is simple: put a small version of the ferret game in front of real people, cheaply, and learn whether the idea works before spending months on the full build.

## What we want to learn

| # | Question | One line |
|---|---|---|
| H1 | Do two people sharing one pet work? | Does the second person keep caring, and does the owner enjoy seeing it? (The core promise: raise one pet with someone you care about.) |
| H2 | Does the pet feel alive and cute? | Do testers name it, describe it warmly, and come back the next day? |
| H3 | Is Roblox a good platform for this? | How hard is it to get two people into the game, and does it reach the right audience compared to a web and Android app? |
| H4 | Is there an early sign that people would pay? | Do testers look at and click a cosmetic item? Does anyone buy a cheap one? |

How we measure each one, and what counts as a pass, is in `01_VALIDATION_PLAN.md`.

## Do we pay Robux to publish? (checked 2026-10-01)

**No.** The plan is to publish for **age-checked 16+ players and Trusted Friends**, which costs nothing.

| What | Cost |
|---|---|
| Roblox Studio, building, scripting, test playing | Free |
| Publishing to yourself, or to a limited audience (playtesters, friends) | Free |
| Public game for age-checked 16+ users and Trusted Friends | **Free** (you need an age-checked account, 2-step verification, and a content maturity questionnaire) |
| Opening to players **under 16** | 1,000 Robux one time (refundable if the game stays eligible), or Roblox Plus or Premium for 2 months, plus an engagement threshold. **Not planned.** |

Consequence: every tester must be 16 or older with an age-checked Roblox account, or be a Trusted Friend of the account that owns the game. Details and sources are in `02_ROBLOX_FACTS.md` and `07_LAUNCH_AND_TESTING.md`. Roblox changes these rules often, so re-check on the day you publish.

## Files

| File | Read it when |
|---|---|
| `README.md` | First |
| `01_VALIDATION_PLAN.md` | Before building, so you know what you are testing and what counts as success |
| `02_ROBLOX_FACTS.md` | When you need a number (limits, fees, rules) and where it came from |
| `03_GAME_DESIGN.md` | What exactly gets built, and what is cut |
| `04_TECH_PLAN.md` | How the pet, saving, and sharing work under the hood |
| `05_BUILD_GUIDE.md` | While building. Starts with Roblox Studio basics for a complete beginner |
| `06_FERRET_RIG_AND_ANIMATION.md` | When building the blocky ferret and making it move |
| `07_LAUNCH_AND_TESTING.md` | When it is time to invite people, collect feedback, and decide |

## The short version of the approach

1. **The pet is data, not a place.** The pet lives in one Roblox DataStore record. The owner and the caretaker can both change it, safely, one at a time. So there is no "two phones disagree" problem, which is the top complaint about Pengu and Pokipet.
2. **Same rules as the main game.** Same needs, same 10-minute simulation steps, same interactions (`docs/GAME_DESIGN.md`). Results on Roblox then say something real about the main game.
3. **The ferret is the Blender model.** The same blocky ferret as the real game (your work in `animation/`), imported as separate pieces, joined by Motor6D joints in Studio, and moved by code. The Blender animation clips are not imported (that part of Roblox's importer is fragile), the formulas reproduce the same feel. If the import or an upload cost blocks you, a ferret built from plain Parts is the fallback.
4. **Pair with a code.** The owner gets a 6-character code and shares it with one person. No chat.
5. **Small.** One room, one ferret, four needs, five actions, one tiny mini-game, one shop item for the money test.

## Time

For a complete beginner, roughly **30 to 45 hours** spread over 3 to 4 weekends, plus about 2 weeks of testing. The build guide gives estimates per milestone. If time runs short, cut in this order: the mini-game, the sleep and wake-up animation polish, the shop test, the welcome-back summary. Never cut pairing, saving, or the ferret animations (they are the whole test).

## Glossary

| Term | Meaning |
|---|---|
| **Roblox Studio** | The free program you build Roblox games in |
| **Experience** | Roblox's word for a game |
| **Part** | A 3D block. The ferret is made of Parts |
| **Motor6D** | A joint that connects two Parts and lets one rotate around the other. These are the ferret's "bones" |
| **Script** | Code that runs on the **server** (Roblox's computer). Trusted. Handles saving and rules |
| **LocalScript** | Code that runs on one player's device. Handles drawing, animation, buttons. Not trusted |
| **ModuleScript** | A reusable file of code that other scripts load with `require` |
| **Luau** | Roblox's programming language (close to Lua) |
| **DataStore** | Roblox's free cloud save. Keys and values. Works across servers |
| **MemoryStore** | Short-lived shared storage. Used for invite codes that expire |
| **RemoteEvent** | The pipe a LocalScript uses to ask the server to do something |
| **Trusted Friend** | A Roblox friend relationship that lets someone of any age access your limited games |
| **Robux** | Roblox's money. Not needed to build or test |

## Rules from the main project that still apply

No ads. No timers that block care. No pay-to-care. No random-item crates. The pet cannot die. Basic care is always free. All text that players type (the pet name) is filtered through Roblox's filter. No chat. See `03_GAME_DESIGN.md`.
