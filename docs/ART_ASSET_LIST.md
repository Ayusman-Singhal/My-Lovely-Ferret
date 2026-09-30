# Art and Audio Asset List

Every asset the game needs, with its size once it exists (guide §9.2, §22). Update the **Size** column whenever an asset is added or changed, and keep the totals in `PERFORMANCE.md` current. Budget for first-run art: about 1 to 1.5 MB (guide §4.1).

Status values: `todo`, `placeholder` (drawn in code, 0 KB), `final` (real art, in `public/`).

## Phase 1: rig parts (see `ART_STYLE.md` section 4)

| Asset | Status | Size |
|---|---|---|
| tail | placeholder | 0 KB |
| far-back-leg, near-back-leg | placeholder | 0 KB |
| far-front-leg, near-front-leg | placeholder | 0 KB |
| body | placeholder | 0 KB |
| head | placeholder | 0 KB |
| far-ear, near-ear | placeholder | 0 KB |
| eyes (frames: open, half, closed) | placeholder | 0 KB |
| nose and mouth (frames: closed, open) | placeholder | 0 KB |

## Phase 1: animations (code-driven tweens, guide §9.1)

| Animation | Type | Status |
|---|---|---|
| idle breathing | loop | todo |
| blink | timed frame swap | todo |
| ear movement (twitch, perk) | timed | todo |
| walk | loop, faster variant for playful | todo |
| sniff | loop, nose twitch | todo |
| sleep | loop, curled, slow breathing | todo |
| eat | loop with mouth frames | todo |
| drink | loop with mouth frames | todo |
| happy | reaction | todo |
| playful (zoomies, hop) | burst | todo |
| curious | walk then sniff at a prop | todo |
| steal (pick up, carry, stash) | mischief behavior | todo |
| annoyed | reaction (woken up, refusal) | todo |
| surprise | reaction | todo |

Phase 2 additions (guide §9.1): scratch, groom, more reactions.

## Phase 1: room and props

| Asset | Status | Size |
|---|---|---|
| room background (wall, floor, window) | placeholder | 0 KB |
| food bowl (empty, filled) | placeholder | 0 KB |
| water bowl (empty, filled) | placeholder | 0 KB |
| toy: ball, sock, feather, ring (favorite toy is one of these) | placeholder | 0 KB |
| hammock | placeholder | 0 KB |
| sock (stealable item) | placeholder | 0 KB |
| particles: hearts, sparkles, zzz (pooled, guide §4.4) | placeholder | 0 KB |

## Phase 1: UI icons

Icons must pair with a label or shape, never color alone (guide §9.3, §17). Drawn as inline SVG in the Preact components.

| Icon | Use |
|---|---|
| hunger (bowl) | HUD |
| water (drop) | HUD |
| energy (bolt) | HUD |
| happiness (heart) | HUD |
| feed, water, play, sleep | Action bar |
| settings, backup | Menu |

Phase 2 adds groom, dress, home, history, passport.

## Audio (guide §9.1)

Lazy-loaded, compressed, unlocked on the first user gesture (guide §4.3). Use sparingly. Phase 1 can ship with **no audio**, and add a small set only if testers ask for it. Starter list for later: footsteps, sniffing, squeaks and chirps, eating, drinking, item interaction, room ambience.

| Asset | Status | Size | License |
|---|---|---|---|
| (none yet) | | | |

## Totals

| Group | Size |
|---|---|
| First-run art | 0 KB (code-drawn) |
| Total installed art and audio | 0 KB |
