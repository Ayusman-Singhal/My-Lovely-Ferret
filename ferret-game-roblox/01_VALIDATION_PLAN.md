# Validation plan

This is a small, honest test with friends and friends of friends. It will not give statistics. It will tell you, directionally, whether the idea is worth the next six months. Decide the pass numbers **before** you see the results, so the numbers cannot be bent afterwards.

## Limits you must remember

- **Friends are kind.** People who know you rate things higher. Ask for what they **did**, not what they liked.
- **Small sample.** Target 5 to 10 pairs (10 to 20 people). One pair behaving oddly can swing a result. Look for patterns across pairs, not averages.
- **Only 16+ and Trusted Friends can play** (`README.md`). The result describes that audience only.
- **Roblox is a different place from a phone app.** A good result on Roblox suggests the idea works. It does not prove the web and Android versions will do the same.

## Hypotheses, measures, pass numbers

Targets are for 5 to 10 pairs. "Pair" means an owner plus the person they invited.

### H1: two people sharing one pet

| Measure | How | Pass |
|---|---|---|
| Invite redeemed | Owners who created a code and shared it: share whose code was used within 24 hours | at least 60% |
| Second person keeps caring | Pairs where the second person did at least one care action on **2 or more different days** in the first 7 days | at least 50% of pairs |
| Owner notices | Survey: "Seeing that my partner cared for the pet made me feel connected" (1 to 5) | at least 60% answer 4 or 5 |
| Both return | Pairs where **both** people played on at least 3 different days in 7 | at least 40% of pairs |

If H1 fails, stop and think hard: the core promise of the whole project is in question. Ask "why" in the interviews before touching anything else.

### H2: the pet feels alive and cute

Same bar as the Phase 1 gate in `docs/PLAN.md`.

| Measure | How | Pass |
|---|---|---|
| Day-1 return | Testers who open the game again the next calendar day | at least 6 of 10 |
| Warm words | In the interview, before any prompt, how many say "cute", "alive", "real", "love", or similar | at least 6 of 10 |
| Naming | Testers who give the pet a name | at least 90% (expected, it is a forced step) |
| Session length | Roblox analytics, average session | 1 to 4 minutes is healthy. Under 30 seconds means the pet does not hold attention |

### H3: platform fit

This one is mostly facts and friction, not a score.

| Measure | How | What it tells you |
|---|---|---|
| Could they get in | Count invited people who could **not** play because of age checks, no Roblox account, or other blockers | If more than 30% of the people you want to reach cannot join, Roblox is a poor entry point for this audience |
| Time to first shared care | Minutes from "invite created" to "second person's first care action" | Median at most 10 minutes is good. Over 30 means pairing is too hard |
| Where the audience is | Ask: "Would you rather have this on your phone as an app, or on Roblox?" | Counts, with reasons |
| Discovery | Note how many players came from outside your own invites (Roblox analytics, source) | Expected 0 to 3. If zero, Roblox will not find players for you at this size |
| Money and cost | Compare in `02_ROBLOX_FACTS.md`: 30% platform cut, DevEx rate, minimum cash-out | Roblox is a weak money path for a small game. Useful as marketing and learning |

### H4: early money signal

Treat this as the weakest signal of the four. Testers are friends, may have no Robux, and may be unwilling to spend.

| Measure | How | Pass |
|---|---|---|
| Shop viewed | Share of active testers who open the shop screen | at least 70% |
| Fake-door click | Share of those who press "Buy" on the cosmetic that is not actually for sale | at least 20% |
| Real purchase | Anyone buys the cheap real cosmetic (25 Robux) | at least 1 purchase is a bonus, not required |
| Survey | "I would pay a small amount for pet outfits" (1 to 5) | at least 30% answer 4 or 5 |

## Events to log

Log these from the server with `AnalyticsService:LogCustomEvent(player, name, value, fields)` (checked to exist in the Roblox reference on 2026-10-01) and also count them in the player's DataStore record, so you can read the numbers even if analytics is slow.

| Event | When |
|---|---|
| `session_start` | Player joins |
| `pet_adopted` | Pet created and named |
| `care_feed`, `care_water`, `care_pet`, `care_play`, `care_sleep` | Each successful action. Add field `role` = `owner` or `caretaker` |
| `minigame_done` | Mini-game ended, field `band` 0 to 3 |
| `invite_created` | Owner generates a code |
| `invite_redeemed` | Second person joins the pet |
| `partner_care_seen` | Owner opens the game and sees at least one care event by the partner |
| `shop_view`, `shop_click` | Shop opened, "Buy" pressed |
| `feedback_sent` | In-game feedback submitted |

Collect **no** personal data. Roblox user ids are enough. Do not store real names, emails, or ages.

## Spreadsheet

One row per tester. Columns:

`tester id (T1..)`, `pair id (P1..)`, `role (owner or caretaker)`, `invited by`, `age group (16-17, 18-24, 25+)`, `first session date`, `could join without trouble (y/n)`, `blocker`, `minutes to first care`, `days played in first 7`, `care actions total`, `partner care seen (y/n)`, `returned day 1 (y/n)`, `returned day 7 (y/n)`, `warm words (list)`, `shop viewed (y/n)`, `fake door clicked (y/n)`, `bought (y/n)`, `survey scores`, `quote`, `top confusion`.

## Schedule (about 2 weeks of testing)

| Day | What |
|---|---|
| 0 | Build is done (`05_BUILD_GUIDE.md` M0 to M9). You and one friend test it with two real accounts |
| 1 to 2 | Fix what broke. Invite 2 pairs as a smoke test (4 people). Watch them if possible (screen share) |
| 3 | Fix. Invite 5 to 8 pairs, staggered over 3 days |
| 4 to 9 | Do not change the game except for crashes and data loss. Changing it mid-test ruins the comparison |
| 5 to 10 | Interviews, one per person, 10 minutes, after their second day |
| 10 | Send the survey to everyone |
| 14 | Read day-7 returns. Fill the spreadsheet |
| 15 | Decide (matrix below), write one page: what we learned, what we do next |

## Interview script (10 minutes, same order for everyone)

Do not explain the game before they play. Do not defend it. Take notes of their words.

1. "Tell me what you did in your first two minutes." (Where did they get stuck?)
2. "Describe the pet in three words." (Do not suggest words.)
3. "Was there a moment you felt something for the pet? What was it?"
4. (Owners) "When you saw that your partner had cared for it, what did you do or think?" (Caretakers) "What made you come back to it, or not?"
5. "What confused you or annoyed you?"
6. "What would make you open it again tomorrow?" (This is the C4 question from `docs/MARKET_RESEARCH.md`.)

## Survey (8 questions, 1 to 5 unless noted)

1. The pet felt cute or alive.
2. I wanted to come back and check on the pet.
3. Caring for the pet with another person made it more fun.
4. Seeing that my partner cared for the pet made me feel connected. (Skip if solo.)
5. It was easy to get my partner into the game.
6. I would pay a small amount for outfits or decorations for the pet.
7. I would prefer this as a phone app instead of on Roblox. (1 = strongly prefer Roblox, 5 = strongly prefer a phone app.)
8. Free text: "What one thing would make this better?"

Use a free Google Form. Put the link in the in-game feedback screen as selectable text (players can copy it) and also send it to testers directly.

## Decision matrix (day 15)

| H1 pairing | H2 alive and cute | Meaning | Next step |
|---|---|---|---|
| Pass | Pass | The idea works. | Continue the main plan (web and Android). Optionally keep a Roblox version as a free taste for later growth |
| Pass | Fail | People like sharing, but the pet is not charming enough. | Do not build more features. Improve the pet (Blender animations are the priority). Retest |
| Fail | Pass | They like the pet but not the sharing. | Rethink the core promise. Ask "why" in interviews. Consider that sharing needs a stronger reason (a shared goal, preset reactions, a visible thank you) |
| Fail | Fail | The idea is not landing. | Stop. Write down what you learned. Do not build the full game on this idea as is |

H3 and H4 adjust the plan but do not decide it alone:

- Many testers could not join (H3): Roblox is not the place to grow this. The web and Android route stays, and the Roblox build stays a learning tool.
- Strong money signal with passing H1 and H2: add the money questions to the main plan sooner (guide §14, cosmetic packs).
- Weak money signal: expected. Not a reason to stop.

## What to write down at the end

One page: the numbers, 3 quotes, 3 surprises, the decision, and what changes in `docs/PLAN.md` because of it (for example "add a thank-you reaction to the Phase 3 list").
