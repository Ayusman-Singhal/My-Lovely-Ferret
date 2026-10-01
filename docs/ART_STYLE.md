# Art Style

> **Note (2026-10-01):** the pet is now a cute blocky 3D ferret (`animation/`, three.js). Sections 1, 4, 5 and 7 below describe the old 2D layered-sprite rig and are superseded for the pet by `animation/RIG_SPEC.md` and `animation/CLIPS.md`. The palette (§3), the room (§6) and the UI rules still apply. Size limits are relaxed (`PERFORMANCE.md`). Full rewrite is task 1K.5.

Fixed before any final art (guide §25.1). Decided in the setup session: **soft flat vector**, small palette, layered-sprite rig animated in code. Phase 1 uses a **code-drawn placeholder rig** (no image files). The developer draws the final rig later in a free tool (Krita or Inkscape), before the art style is locked (guide §25.1, after the real low-end phone check).

## 1. Look

- Flat shapes with rounded edges. No outlines. One soft shade tone per shape for form (a darker belly or under-side), no gradients and no blur.
- Warm, cozy palette. The room is calm so the pet stands out.
- Big readable silhouettes. A ferret is long, low, and curvy, so the body reads as a capsule with a slightly thicker chest.
- Expressive eyes and ears carry personality. Small frame swaps (blink, mouth open, eyes closed) plus code-driven squash and stretch (guide §9.1).
- No text inside the canvas (guide §9.1).

## 2. Resolution

- Logical viewport **360 by 540** (portrait, 2:3), changed from 360 by 640 in Part 1G: with the needs bar above and the action bar below, a taller room left a large empty wall and a small pet on real phone screens. Assets authored at **2x** (720 by 1080 room).
- Device pixel ratio capped at **2** (guide §4.4).
- Texture atlases at most 2048 by 2048 (guide §4.4). Prefer WebP.
- Safe areas: keep important content 16 px inside the logical edge, and keep the pet out of the top HUD band (about 64 px) and the bottom action bar (about 88 px).

## 3. Palette (16 colors)

| Name | Hex | Use |
|---|---|---|
| cream | `#F6ECDC` | app background, highlights |
| wall | `#EBD3B5` | room wall |
| wall-shade | `#DDBF9C` | wall shadow band |
| floor | `#C9A07A` | floor |
| floor-shade | `#A9805C` | floor boards, furniture wood |
| ink | `#3B2F26` | text, eyes, nose outline-free details |
| sable | `#8A6244` | sable coat body |
| sable-dark | `#4A3626` | sable mask, feet, tail tip |
| cinnamon | `#B9743C` | cinnamon coat body |
| albino | `#F4EBDD` | albino coat body |
| panda-dark | `#3E3A3F` | panda coat dark parts |
| belly | `#E8D2B0` | belly, inner ear |
| nose-pink | `#E59AA0` | nose, tongue, albino eyes tint |
| water-blue | `#6FA8C8` | water bowl, drink effects |
| bowl-red | `#D9604C` | food bowl, ball toy |
| gold | `#F2C75C` | toy highlights, found items, later "shinies" |

All UI colors are drawn from this palette or from CSS variables with the same values, with a high-contrast variant defined in Phase 2 (guide §17). State is never shown by color alone (guide §9.3).

## 4. Rig (guide §9.1, §25.1)

Parts, drawn back to front. Pivot = the point the part rotates or scales around, given as a fraction of the part's own width and height from its top-left corner. Values are starting points for the placeholder.

| # | Part | Pivot | Motion notes |
|---|---|---|---|
| 1 | tail | (0.1, 0.5) | Sways, arcs up when playful, droops when tired. Slightly bushy. |
| 2 | far-back-leg | (0.5, 0.1) | Walk cycle, phase-offset from near leg. |
| 3 | far-front-leg | (0.5, 0.1) | Walk cycle. |
| 4 | body | (0.5, 0.5) | Long capsule. Breathing (scale Y), arches when curious, curls to sleep, squash on landing. |
| 5 | near-back-leg | (0.5, 0.1) | Walk cycle, push-off. |
| 6 | near-front-leg | (0.5, 0.1) | Walk cycle, reach to sniff, hold item. |
| 7 | head | (0.25, 0.75) | Attached to the front of the body. Bobs, tilts, tracks the pointer. |
| 8 | far-ear, near-ear | (0.5, 0.9) | Rotate independently: twitch, perk, flatten. |
| 9 | eyes | (0.5, 0.5) | Frames: open, half, closed. Blink, sleepy, happy squint. |
| 10 | nose and mouth | (0.5, 0.5) | Frames: closed, open (eat, drink, pant). Nose twitch when sniffing. |

Facing: the rig faces right. Facing left is a horizontal flip of the whole rig.

Placeholder rendering: each part is a primitive shape (rounded rectangle or ellipse) drawn at runtime, so the art costs **0 KB**. The rig API (part names, pivots, frame names) is designed so that replacing a shape with a sprite from an atlas changes only the asset loader, not the animation code.

## 5. Coats are tints

Coats are palette swaps of the same rig, chosen from the pet id seed (guide §7.8). A coat is defined by three values, so it costs almost no bytes (guide §25.1).

| Coat | body | dark parts (mask, feet, tail tip) | eyes |
|---|---|---|---|
| sable | `sable` | `sable-dark` | `ink` |
| cinnamon | `cinnamon` | `sable` | `ink` |
| albino | `albino` | `nose-pink` (nose and ears only) | `nose-pink` |
| panda | `albino` | `panda-dark` (legs, mask, tail) | `ink` |

If the final art needs a small overlay atlas for masks, it is still one shared atlas, not one per coat.

## 6. Room (Phase 1)

One room, side view. Back wall in `wall` with a `wall-shade` band, wooden floor in `floor` with `floor-shade` lines, a window shape for a cozy focal point. Props: food bowl, water bowl, toy, hammock, sock. No camera panning (guide §0).

## 7. Motion principles

- Personality first. A shy pet moves small and slow, a mischievous one moves in quick starts.
- Every action anticipates (small wind-up), acts, and settles (small overshoot).
- Sleeping is nearly still and costs almost no CPU (render on demand, guide §4.4).
- `prefers-reduced-motion` shortens or removes bounces and particles, and the pet stays fully readable.

## 8. Files and tools

Free tools only (Krita, Inkscape). Source files (`.kra`, `.svg`) live in `art-src/` when they exist. Exported atlases go to `public/`. Every third-party asset is recorded in `ASSET_LICENSES.md`, and every asset's size in `ART_ASSET_LIST.md`.
