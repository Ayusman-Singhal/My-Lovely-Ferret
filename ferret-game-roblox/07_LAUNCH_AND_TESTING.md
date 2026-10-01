# Launch and testing

How to get the game to real testers, run the sessions, collect what you need, and decide. Roblox's publishing rules changed in 2026 and may change again. Re-check the list in `02_ROBLOX_FACTS.md` ("Verify on publish day") before you start.

## 1. Who can play (read this first)

The plan is to publish for **age-checked 16+ users and Trusted Friends**, which is free. The 1,000 Robux route that opens the game to players under 16 is **not planned**.

What that means for you:

| Tester | Can they play? |
|---|---|
| 16 or older, Roblox account, age check done (face estimate or ID) | Yes |
| 16 or older, has not done the age check | No, until they do it. Tell them to do it first (Roblox account settings, Verify age). It takes a couple of minutes |
| Under 16, and a Trusted Friend of the account that owns the game | Yes, reported as allowed regardless of age |
| Under 16, not a Trusted Friend | No |
| No Roblox account | They must make one, verify the email, and do the age check. This is real friction, so count it as an H3 result (`01_VALIDATION_PLAN.md`) |

Do not ask anyone under 16 to take extra steps to join. Do not message minors you do not know. Keep the whole test among adults and people you already know and trust.

## 2. Setting up access in the Creator Hub

Steps in Roblox change names. This is the order and the idea.

1. **Finish the creator requirements:** age check, 2-step verification, account in good standing and at least 2 days old.
2. **Fill in the maturity questionnaire** for the experience (Creator Hub, your experience, Settings or "Maturity and compliance"). Honest answers for this game: no violence, no blood, no scary content, no romance, no gambling or random paid items, no user chat, no user-created content other than the filtered pet name, no social hangout. The pet cannot die. Expect the lowest maturity label (Minimal or Mild).
3. **Choose who can play.** Start with **Private** while you build. For the first two testers, use **Limited** with the playtesters list (add testers by their Roblox username). When it is stable, switch to **Public** with no fee: the game then reaches age-checked 16+ users and Trusted Friends only (`02_ROBLOX_FACTS.md`).
4. **Name and thumbnail.** Name it "Ferret Test" or "Mochi, a ferret to share" (a placeholder, see `CLAUDE.md`). A screenshot of the room and ferret for the thumbnail. A short description: "Adopt a ferret and take care of it together with one other person. Closed test."
5. **Description honesty:** say it is an early test. Say what data you keep (below).
6. **Safety review:** a new public game goes through a review (about 48 hours according to the docs). Plan for that delay before your first wave.
7. **Test the real link** on a different account on a different device before you invite anyone.

## 3. Privacy and data

- You store only what the game needs: the Roblox user id, the pet, and play counters. Roblox analytics also shows aggregate numbers.
- Do not collect names, emails, ages, or locations.
- Put one sentence in the game's description and the Feedback screen: "This test stores your pet and simple play counts so we can improve the game."
- If a tester asks you to delete their data, delete their `Player_<id>` and `Pet_<id>` records (a small admin script in Studio, ask Claude to write it).
- Roblox has its own rules for data and children. Because the audience here is 16+ and Trusted Friends, stay away from anything that could attract younger players (no kid-targeted marketing).

## 4. Credits

If you use **any** third-party art (for example the LandyStudio ferret model, CC BY 4.0), add its credit to the Credits screen: author, title, license, a link, and whether you changed it. Example:

> "Black Footed Ferret" by LandyStudio, CC BY 4.0 (creativecommons.org/licenses/by/4.0), modified.

If the ferret is built from your own Parts, no credit is needed. Record any third-party asset in `docs/ASSET_LICENSES.md` before you use it (project rule).

## 5. Finding testers

Aim for **5 to 10 pairs**. Everyone needs to know someone they would share a pet with.

| Source | How |
|---|---|
| Couples and close friends you know | Best fit. Ask both to try it for a week |
| Long-distance pairs | The strongest use case. Ask specifically |
| Friends who play Roblox | Easiest for the platform side, so you learn the least about friction |
| Friends who do **not** play Roblox | You learn the most about H3 (platform fit), but expect dropouts at sign-up |

Ask each owner to pick their own partner. Do not match strangers: you would test a different thing.

Message to send (edit freely):

> I'm testing a small game idea: you adopt a ferret and take care of it together with one other person. It's free and takes a few minutes a day. It's on Roblox, so you need a Roblox account with the age check done. Would you try it for a week with someone you'd like to share a pet with? I'd also like a 10-minute chat afterwards. No pressure, and tell me honestly what you think.

## 6. Running a session

Best: watch the first session of 2 or 3 people on a video call (screen share). Do not help unless they are stuck for over a minute.

1. They open the link and start. Say nothing about the game.
2. Note the time they join, when they name the pet, and when they first feed it.
3. For pairs: the owner creates a code and sends it to the partner themselves, using whatever they normally use. Note how long that takes.
4. Write down every hesitation, every smile, and every confusing moment.
5. After 10 minutes, ask only: "What did you think was going on?"

For everyone else: send the link and the code, do not watch.

## 7. Collecting the numbers

| Where | What |
|---|---|
| Creator Hub, Analytics | Players, retention (day 1, day 7), session length, custom events (allow hours for data) |
| In your own records | `stats` in each `Player_<id>`: sessions, `daysPlayed`, care counters. Read them with a small admin script in Studio |
| Spreadsheet | The columns in `01_VALIDATION_PLAN.md` |
| Interviews | The six questions, notes in the tester's own words |
| Survey | The 8 questions in a Google Form |

Do not change the game during the main wave except for crashes and data loss. If you do change something, write the date in your notes.

## 8. After the test

1. Fill the spreadsheet and compare with the pass numbers you wrote before the test.
2. Use the decision matrix in `01_VALIDATION_PLAN.md`.
3. Write the one-page summary. Put what you learned into `docs/PLAN.md` (for example, a new task or a dropped idea) and `docs/MARKET_RESEARCH.md`.
4. Decide what to do with the Roblox game: keep it as a small free taste, leave it private, or retire it. Leaving it public costs nothing, but it needs minimal care (bug fixes, rules changes). Set it back to Private if you will not maintain it.

## 9. If it goes well: going beyond 16+ (not planned)

Only if you later decide you want younger players. Roblox's rules at the time of writing:

- A one-time **1,000 Robux** publishing fee, or Plus or Premium for two months, or a 50,000 Robux expedited review.
- An engagement threshold (about 500 highly engaged players in 60 days).
- Stricter content and monetization rules apply to younger audiences, for example around random paid items and chat.
- Our rules still hold: no ads, no pay-to-care, no timers.

This is a business decision for later, not part of this test.

## 10. Launch checklist

- [ ] Age check and 2-step verification done on the owner account.
- [ ] Maturity questionnaire answered.
- [ ] M0 to M9 of `05_BUILD_GUIDE.md` done and tested with 2 clients in Studio.
- [ ] Studio API access on, and DataStore saves a pet across restarts.
- [ ] `debug_skip` cannot be used by anyone but you (it checks Studio or your user id).
- [ ] Credits screen added if any third-party art is used, and the asset is in `docs/ASSET_LICENSES.md`.
- [ ] Feedback form link works and is copyable in the game.
- [ ] Description explains the test and the data stored.
- [ ] Tested the real link with another account on another device.
- [ ] Sheet and calendar ready (`01_VALIDATION_PLAN.md`).
- [ ] Only people you know, and only 16+ or Trusted Friends, are invited.
