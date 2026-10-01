# Roblox facts (checked 2026-10-01)

Project rule (`CLAUDE.md`, guide §24): facts that change must be checked before relying on them. This file lists what was checked, where, and what could **not** be confirmed. Roblox changes publishing and safety rules often. Re-check the "verify on publish day" list before you publish.

Status key: **Confirmed** = read on an official Roblox page. **Reported** = from a news or community source that cites Roblox. **Unverified** = from general knowledge or not reachable, check it yourself.

## 1. Cost and publishing

| Fact | Status | Source |
|---|---|---|
| Roblox Studio is free. Building, scripting, and test playing cost nothing. No Robux needed to create a game | Reported | https://generalistprogrammer.com/tutorials/how-to-make-a-roblox-game-for-free |
| Audience settings for an experience: Private (people with Edit permission), Limited (playtesters, or friends or community), Public | Confirmed | https://create.roblox.com/docs/production/publishing/publish-experiences-and-places |
| To publish publicly the creator needs: account in good standing at least 2 days old, age verification (face estimation or government ID), the content maturity questionnaire, and 2-step verification (for all-ages eligibility) | Confirmed | same page |
| A new public game **without** a fee or subscription can reach **age-checked 16+ users and Trusted Friends** | Reported (quoted from the Roblox developer forum announcement) | https://devforum.roblox.com/t/alternate-publishing-requirements-for-roblox-kids-and-select/4630944 |
| To reach **users under 16** (Roblox Kids and Select): a one-time **1,000 Robux** publishing fee, **or** active Roblox Plus, or Premium for 2 consecutive months. Plus an engagement threshold (about 500 highly engaged players in 60 days, where "highly engaged" means a minimum purchase amount on Roblox) | Reported | same forum post, https://bloxbot.ai/guide/roblox-new-publishing-requirements-2026 |
| The 1,000 Robux fee is refunded after about 90 days if the game stays eligible and is not removed for severe Community Standards violations | Reported. **Sources differ**: the Create docs page says refundable if the game keeps 25 engaged players for 60 days | the three pages above |
| An expedited review fee of 50,000 Robux exists, to speed up the 48-hour safety review | Confirmed | Create docs page above |
| Rollout began 2026-05-19, global early June 2026 | Reported | https://bloxbot.ai/guide/roblox-new-publishing-requirements-2026 |
| Private games are visible only to people with Edit permission. Playtest audiences still need the standard publishing eligibility | Reported | devforum post above |

**Decision (developer, 2026-10-01):** publish for 16+ and Trusted Friends. Do not pay Robux. Under-16 reach is not planned.

## 2. Age checks and chat

| Fact | Status | Source |
|---|---|---|
| Since January 2026, an age check (face estimation or ID) is required to use any chat on Roblox. After the check users chat mainly within their own age group | Reported | https://www.biometricupdate.com/202511/roblox-to-make-age-assurance-for-chat-mandatory-as-of-january-2026 |
| An unverified account may not get access to experiences with higher content maturity | Reported | search results, same period |

This game has **no chat**. Our design has no need for the chat checks. The 16+ audience limit comes from the publishing rule in section 1, not from chat.

## 3. DataStore limits

Source (Confirmed): https://create.roblox.com/docs/cloud-services/data-stores/error-codes-and-limits

| Limit | Value |
|---|---|
| Reads per minute (experience level) | `300 + concurrentUsers x 40` |
| Writes per minute | `300 + concurrentUsers x 20` |
| Server-level default | `60 + numPlayers x 40` per minute |
| Max data per key | 4,194,304 characters of JSON |
| Per-key throughput | reads 25 MB per minute, writes 4 MB per minute |
| Storage | 500 MB base plus 1 MB per lifetime player (changed 2026-07-29, Reported: https://bloxbot.ai/guide/roblox-datastore-limits-july-2026) |
| Request queue | 30 per type. If exceeded, the request fails with error 301 to 306 instead of waiting |

Our use is tiny. A pet record is well under 5 KB. With 20 players in a server we have room for over 1,000 reads and 700 writes per minute. See `04_TECH_PLAN.md` for the math.

## 4. Other services we use

| Fact | Status | Source |
|---|---|---|
| `AnalyticsService:LogCustomEvent(player, eventName, value = 1, customFields = nil)` exists. Rate limits and name length limits are not in the page | Confirmed (signature only) | https://create.roblox.com/docs/reference/engine/classes/AnalyticsService |
| `MemoryStoreHashMap:SetAsync(key, value, expiration)`, `GetAsync(key)`, `UpdateAsync(key, fn, expiration)`, `RemoveAsync(key)` exist. The page did not say the unit of `expiration`, it is **seconds** in the Roblox docs, confirm when you write the code | Confirmed (signatures), Unverified (unit) | https://create.roblox.com/docs/reference/engine/classes/MemoryStoreHashMap |
| `TextService:FilterStringAsync(text, fromUserId, context)` returns a `TextFilterResult`. For a string shown to many players, use the result's `GetNonChatStringForUserAsync(toUserId)` for each viewer, or `GetNonChatStringForBroadcastAsync()` for everyone. The page does not say how often to re-filter stored text. The safe habit is to filter on entry and filter again when loading a saved name | Confirmed (signature), Unverified (re-filter rule) | https://create.roblox.com/docs/reference/engine/classes/TextService |
| Developer Products and `MarketplaceService:PromptProductPurchase` and `ProcessReceipt` | Unverified here (standard Roblox feature), read the docs when you reach M9 | https://create.roblox.com/docs/production/monetization |
| "Enable Studio Access to API Services" must be on (Game Settings, Security) for DataStore to work while testing in Studio | Unverified here (standard step), you will see an error in the Output window if it is off | |

## 5. Money

| Fact | Status | Source |
|---|---|---|
| DevEx (cashing out earned Robux) needs at least 30,000 earned Robux, age 13 or older, a verified email, a DevEx portal account, good standing | Reported | https://generalistprogrammer.com/tutorials/roblox-devex-guide-how-to-cash-out-robux |
| Rate about $0.0035 per Robux. One source also quotes $0.0054 for US 18+ verified accounts from 2026-06-08. **Sources conflict** | Reported | same page, https://www.exitlag.com/blog/devex-roblox/ |
| Whether **India** is a DevEx-supported country | **Unverified.** The official help page returned HTTP 403. Check the DevEx Terms of Use yourself: https://en.help.roblox.com/hc/en-us/articles/115005718246 | |
| Roblox keeps 30% of Robux spent on game items | Unverified here (long-standing, but confirm) | https://create.roblox.com/docs/production/monetization |

Rough scale: 30,000 Robux is about $105 at $0.0035. To earn 30,000 Robux after the 30% cut, players must spend roughly 43,000 Robux. For a game with 10 to 20 friend testers, money from Roblox is not realistic. This test measures the **interest** in paying, not income.

## 6. Competitors and demand

| Fact | Status | Source |
|---|---|---|
| Adopt Me! is Roblox's biggest pet game (record 1.6 million players online, peaked near 1.5 million in February 2026, reported revenue in the hundreds of millions of dollars) | Reported | https://en.wikipedia.org/wiki/Adopt_Me! , https://www.playadopt.me/news/cute-pet-collecting-roblox-game-adopt-me-sets-new-record |
| Adopt Me! released a limited **Black-Footed Ferret** pet on 2026-02-28 | Reported | https://adoptme.fandom.com/f/t/Black-Footed%20Ferret |
| Pet Simulator 99 and others are collect-and-hatch games | Reported | search results |

What it means: ferret demand exists, and the shelf is crowded. Adopt Me! is about collecting and trading. Our game is about **raising one pet with one person**, which is a different promise. Do not copy Adopt Me!'s egg and rarity loop.

## 7. Licensing of art

| Fact | Status | Source |
|---|---|---|
| A CC-BY model needs credit to the author. On Roblox, credit must go in the game itself, for example an in-game credits screen, because Roblox asset pages have no place for it | Reported | Roblox developer forum threads, for example https://devforum.roblox.com/t/roblox-cc-right-atribution-i-need-help/2064646 |
| Roblox's rules make it hard to meet some Creative Commons conditions when **uploading** such assets to the Creator Store | Reported | same threads |

The developer chose to use the same blocky ferret as the real game (LandyStudio, CC BY 4.0), imported as separate mesh pieces (Path A in `06_FERRET_RIG_AND_ANIMATION.md`), with the credit shown in the game's Credits screen. Building the ferret from your own Parts (Path B) needs no credit and is the fallback.

| Fact | Status | Source |
|---|---|---|
| Roblox's importer imports FBX with several meshes as one Model ("Import Only as Model" on by default). Each piece keeps its pivot ("Use Imported Pivot", on by default). Suggested Blender FBX settings: -Z Forward, Y Up, FBX Units Scale, Limit to Selected, no leaf bones, embed textures | Confirmed (importer settings), Reported (Blender settings) | https://create.roblox.com/docs/studio/importer , https://gmmarket.me/community/post/complete-guide-importing-blender-meshes-into-roblox-studio-fbx-obj-scale-fix-pbr |
| Textures on mesh pieces use smooth filtering, so 64 by 64 pixel art looks blurry. A `SurfaceAppearance.ResampleMode` property is listed in the Roblox reference. A forum feature request from 2025-10-27 said Pixelated mode was planned, not released. **Check in Studio whether it works** | Confirmed (property listed), Unverified (whether Pixelated works on MeshParts) | https://create.roblox.com/docs/reference/engine/classes/SurfaceAppearance , https://devforum.roblox.com/t/pixelated-resamplemode-for-surfaceappearances-pixel-art-meshes/4028314 |
| Upload fees of 80 Robux (2026-07-14) are reported for **avatar items for the Marketplace**. Whether meshes and textures used only inside your own experience cost Robux or need ID verification is **not stated** in the sources found | Unverified | https://devforum.roblox.com/t/building-a-safer-marketplace-updates-to-2d-avatar-items-uploading-and-publishing-requirements/4474667 |

## 8. Tooling

| Fact | Status | Source |
|---|---|---|
| roblox-ts (TypeScript to Luau compiler) is at 3.0.0 and active | Reported | https://www.npmjs.com/package/roblox-ts , https://roblox-ts.com/docs/ |
| Rojo syncs files on disk into Studio, so scripts can live in git and VS Code | Reported | https://kitsblox.com/blog/how-to-use-rojo-roblox |

We do not use roblox-ts (`04_TECH_PLAN.md` explains why). Rojo is optional.

## Verify on publish day

- [ ] Publishing tiers: the 16+ and Trusted Friends route is still free.
- [ ] Your account has the age check, 2-step verification, and the maturity questionnaire done.
- [ ] How testers join a Limited audience (playtesters list, friends) in the current Creator Hub.
- [ ] The Studio API access setting and the DataStore behavior in Studio.
- [ ] Developer Product creation and the receipt callback, if you run the real purchase test.
- [ ] Whether text filtering rules for saved names changed.
- [ ] Whether importing and uploading the ferret meshes and textures costs Robux or needs ID verification (read the importer's cost line before confirming).
- [ ] Whether `SurfaceAppearance.ResampleMode = Pixelated` works on imported mesh pieces.

After checking, add a dated section to `docs/VERIFY_LOG.md`.
