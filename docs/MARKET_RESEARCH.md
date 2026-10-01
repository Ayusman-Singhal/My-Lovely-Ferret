# Market Research: shared virtual pet apps

Researched 2026-10-01 from public store listings, review aggregators, and trade write-ups. Review numbers are snapshots and may be skewed toward complaints, since aggregators surface long reviews. Every proposal below is **pending developer approval**. Nothing here changes `docs/PLAN.md` tasks until the developer adopts it (CLAUDE.md workflow rule 7).

## 1. The market

| App | What it is | Scale and money | Loved for | Hated for |
|---|---|---|---|---|
| **Pengu / "Friends"** (Slay, Germany) | Raise one penguin with a partner or friend. Chat, mini-games, outfits, rooms, widgets, "AI companion" | 4.8 stars from 238K US App Store ratings, reached #1 US App Store, $5M raised in June 2024. IAP $1.99 to $9.99, Pengu Pass $9.99 a month | Co-parenting idea, cuteness, outfits, "helps strengthen our relationship", long-distance check-ins | Ads after most actions, ad-gated coins and chests, coin rewards cut from 200-300 to 2-3, mini-game cooldowns of hours, a pet that "dies" minutes after feeding, notifications at 4 am and repeated, no notification settings, **partners seeing different pet states**, widget hours out of date, pet lost on a new phone, level cap at 25 then "just feeding", no-ads purchase that still shows ads |
| **Widgetable** | Home-screen widgets, co-parent pets and plants | Large, Android and iOS | Widget as a daily ritual, seeing the other person | About 5 ads to feed once, 30 to 60 second ads, unsafe ads, Pro paywall, **only the inviter gets level perks**, ad rewards that fail |
| **Pokipet** | Co-parent a cat or dog, chat, mini-games | 4.6 stars, about 12K ratings, Editor's Choice | Fewer ads than rivals, simple shared duties | **Co-parents see different states** (one sees a sick cat, the other a healthy one), crashes lose progress, health falls minutes after sleep, paid medicine, ads before treats, few cosmetics |
| **Finch** | Self-care bird, real tasks feed the pet | $30-40M ARR, bootstrapped, 4.95 stars from 550K+ reviews | Gentle and guilt-free, egg-to-adult growth, 8-hour adventures that bring players back, generous free tier | Trial-to-paid billing confusion, can fade into a chore |
| **Neko Atsume** | Leave food, cats visit, take photos | Classic hit | No punishment, no nagging notifications, a collection album, photos to share | Little direct interaction |
| **Tamagotchi Paradise** (2025 device) | Bandai's newest | n/a | Old pets stay around, calm theme | Low challenge, only one active pet |
| **Nuzzle, Lovegotchi** | Couples creature apps | Small, subscriptions (Nuzzle $29.99 a year) | Growth stages, both-partners-same-day bonus, memory vault, many rooms | Subscriptions, drifting toward relationship-therapy apps |

## 2. What players want (patterns across all reviews)

1. **Do it together, and see the other person's care.** Most praised feeling in the category.
2. **Cute first.** Every winner leads with character appeal, not mechanics.
3. **Fair and generous.** Cosmetics for money are accepted. Gated care, shrinking rewards, and ads are not.
4. **No guilt, no death, no night notifications.** The angriest reviews are about pets dying fast and nagging alerts. Research on pet-companion design calls the punishing "virtual pet treadmill" a known retention trap; a pet that forgives lapses and celebrates care works better.
5. **The same pet on both phones.** Desync is the top technical complaint of Pengu and Pokipet.
6. **Never lose the pet** (new phone, logout).
7. **Something new after week 4.** Pengu players quit at the level cap.
8. **A daily ritual under two minutes,** ideally visible without opening the app (widgets).
9. **Keepsakes:** photos, memories, a certificate to share.

## 3. Where Project Ferret already stands

| Pain in the market | Ferret |
|---|---|
| Death, fast decay | Solved. Floors at 10, slow rates, no death (guide §7.2, `GAME_DESIGN.md` §3) |
| Ads, gated care | Solved. No forced ads, food and water free forever (guide §14) |
| Mini-game cooldowns | Solved. Play any time, only the reward has a 30 minute cooldown |
| Notification spam | Planned local-only and rare (guide §15). Quiet hours not yet explicit |
| Desync | Designed for: owner is authoritative, deterministic `simulate`, caretaker predicted view (guide §10). Must stay a top Phase 3 priority |
| Lost pet | Backup export and import done. Google link in Phase 4 |
| Co-parent gets nothing | Partly. The caretaker can become owner, but earns no credit yet |
| Late-game emptiness | Partly. Care Day milestones to 100. More needed |
| Visual appeal | Weakest point. Flat code-drawn rig. Addressed by the 3D decision of 2026-10-01 |

Unique angles no competitor has: a ferret with real ferret behavior (stealing and stashing, war dance, dead-sleep), and a real ownership handover to the person who helped.

## 4. Proposals (none adopted yet)

**Add, cheap**

- **A1. Ferret signature clips.** War dance when very happy, "dook" (visual only, sound later), dead-sleep pose, post-nap shake. Blender clips now that the pet is 3D. Best marketing material too.
- **A2. The stash.** Stolen and found items pile up in a visible hiding spot with "first found" dates. Neko Atsume's album, born from the pet's personality. Reuses `PET_STOLE_ITEM` and `PET_FOUND_ITEM`. Phase 2.
- **A3. Kit to adult.** Bigger head and shorter body for the first two weeks of Care Days (scale and a blend shape in 3D). Phase 2.
- **A4. Tricks unlocked by bond.** Small learned behaviors (guide §7.8 "learned a new behavior"). Gives a late-game reason to return. Phase 2 or 4.
- **A5. Photo mode and memory book.** Snapshot the canvas, keep about 30 on device, share through the share sheet. Extends the passport (guide §7.7). Phase 2.
- **A6. Quiet hours.** No notifications 22:00 to 08:00 owner time by default, at most one or two a day, positive wording only. Phase 5.
- **A7. Make the partner's care loud.** The welcome-back summary leads with "Riya fed Mochi at 9:12". Phase 3.

**Add, bigger**

- **A8. Preset reactions instead of chat.** A few fixed stickers (heart, thank you, look!) riding in the command batch. No free text, so no moderation, no privacy cost, no extra writes. Chat stays dropped (guide §0). Phase 3.
- **A9. Android home-screen widget** from the local save, with no extra Firestore reads. Needs small native code in the Capacitor shell. Phase 5.
- **A10. Seasonal decorations by local date** (Diwali, Holi, Halloween, winter). Client-side, free cosmetics. Phase 2 onward.
- **A11. Both-cared-today bonus.** Small extra when owner and caretaker both care on the same Care Day. Reward only, never a penalty. Phase 4.

**Change**

- **C1. Caretaker gets equal credit.** Earns shinies and appears by name in history and passport. Avoids Widgetable's "only the inviter benefits".
- **C2. Reconsider paid adoption at Phase 6.** Every competitor is free to download. A paid gate cuts installs and the word of mouth from invites. Weigh free adoption plus cosmetic packs and the transfer entitlement. The "care for a friend's pet" path stays free either way.
- **C3. Sync honesty in the UI.** When the caretaker sees a prediction, say so ("last synced 9:40"). Add a Phase 3 test that owner and caretaker screens match after sync.
- **C4. Ask testers at the Phase 1 gate:** "What would make you open it tomorrow?" It validates A1 to A5 before they are built.

**Do not build** (each one appears in the worst reviews): ads of any kind, energy timers, shrinking rewards, mini-game cooldowns, death or vet bills, free-text chat, an AI chatbot pet, subscriptions for basic care, many rooms, location features, streak penalties.

**Growth note.** Pengu grew mainly through TikTok: a mascot, short animated couple clips, 71M+ views across three channels. Short clips of ferret behavior cost a solo developer almost nothing. Not a plan task.

## 5. The 3D decision (2026-10-01)

The developer judged that a flat 2D look will not satisfy users and that quality now outranks the smallest bundle. First choice was stylized-real 3D. After seeing a cute blocky ferret ("Black Footed Ferret" by LandyStudio, CC-BY 4.0, 132 triangles) the developer chose **cute blocky 3D** instead: Blockbench style, small pixel texture, animated by the developer in Blender, rendered with three.js. This reverses the Canvas 2D decision D5 and the "3D art dropped" rule. A blocky model keeps the download tiny and runs on low-end phones, so only three.js (169 KB gzip) costs real bytes. It also makes limited-time pets cheap later (a new pet is a small model and a texture), though extra pets stay outside the MVP. Use original blocky models only, never Mojang's assets. The spike and budgets are Part 1K in `docs/PLAN.md`, and the Blender instructions are in `animation/`.

## 6. How other apps show the pet (researched 2026-10-01)

Question from the developer: is it 3D, 2D or 2.5D that users want, and how do apps avoid showing the pet restricted? Evidence is thin on "what users prefer" (no study found comparing 2D and 3D pet apps), so this is what the apps do and what reviews praise.

| Style | Examples | What it gives | What it costs |
|---|---|---|---|
| Close-up 3D character stage | My Talking Tom 2 (Outfit7), Nintendogs | The strongest emotional hook: big face, voice, reactions. Rooms are a backdrop; the pet mostly stays in front of the camera | Little room to roam or decorate |
| 3D or isometric home you decorate | Animal Crossing Pocket Camp (fixed isometric "miniature" camera), Pokipet and Pengu-style rooms, Sims Mobile | Decorating is the main long-term hook. Pets walk around the home and use furniture | Pet small unless the camera helps |
| Flat 2D scene | Neko Atsume (fixed yard), Pou, Finch | Simple, cozy, cheap to make. Neko Atsume and Finch prove 2D can be a huge hit | Little feeling of depth |
| Open 3D world | Adopt Me! | Social and collecting | Not a fit for care of one pet |

Findings:

1. **2D versus 3D does not decide success.** Finch (2D, $30-40M a year) and Neko Atsume (2D) sit next to 3D hits. What reviews praise is cuteness, detail, outfits and decorating, seeing a partner's care, and a pet that feels alive.
2. **Research on virtual pets** (Beyond cute, VR pet games): players who can see the pet roam freely enjoy the surprise of finding it somewhere; engagement lasts longer when the player has some control; players lose interest in pets they can only watch.
3. **Restricted movement is what makes a pet feel like a sprite.** A pet that only slides along one line reads as a toy. A pet that crosses the whole room, turns, visits things, and goes to bed reads as an animal.
4. **Close-ups carry the emotion.** Apps that stay zoomed out lose the face. So: whole room while it roams, close-up while it eats, sleeps, is petted or reacts.

Decision (developer, 2026-10-01): keep the 2.5D room, let the pet roam the whole floor, and add automatic zoom during care (no player panning). Implemented in Part 1K follow-up: `src/render/layout.ts`, `plan.ts`, `brain.ts`, `scene3d.ts`.

## Sources

- Pengu: https://apps.apple.com/us/app/pengu-raise-virtual-pets/id6462927800 , https://play.google.com/store/apps/details?id=com.slay.pengu , https://justuseapp.com/en/app/6462927800/pengu-virtual-pets/reviews
- Pengu growth: https://growwithplutus.com/blog/pengu-app-strategy-breakdown , https://www.shortimize.com/blog/tiktok-strategies-pet-penguin-app-generating-millions-in-revenue
- Widgetable: https://www.smileblogs.com/article/1400 , https://apps.apple.com/us/app/widgetable-besties-couples/id1641107226
- Pokipet: https://apps.apple.com/us/app/pokipet-raise-virtual-pets/id6443760470 , https://game-solver.com/pokipet-social-pet-game/
- Finch: https://blog.sparrowapps.io/p/finch-how-a-self-care-app-hit-30m-arr-without-vc-money , https://habitbox.app/blog/finch-app-review
- Neko Atsume: https://alexiamandeville.medium.com/game-design-breakdown-the-simplicity-of-neko-atsume-a8616a937a47
- Tamagotchi Paradise: https://www.engadget.com/gaming/tamagotchi-paradise-trades-stressful-virtual-pet-parenting-for-nature-and-tranquility-130049511.html , https://www.themachomom.com/tamagotchi-paradise-review-worth-it-in-2025/
- Couples apps: https://trynuzzle.app/ , https://lovegotchi.com/blog/best-virtual-pet-apps-for-couples
- Overview: https://thesmartsnout.com/2026/02/21/virtual-pet-apps-guide-2026-ai-coparenting/
