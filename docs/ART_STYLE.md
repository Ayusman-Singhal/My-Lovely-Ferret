# Art Style

Fixed before any final art (guide §25.1). Decided 2026-10-01 (decision D6 in `PLAN.md`): a **cute blocky 3D ferret** in a small warm box room, drawn with three.js. The earlier plan (soft flat vector, a layered 2D rig drawn in code) is gone.

## 1. Look

- **Blocky and toy-like.** Boxes with crisp pixel textures, in the spirit of Blockbench models. Not realistic, not smooth. The pet is the product, so it is the biggest and most detailed thing on screen.
- **Warm, cozy palette** (section 3). The room is calm so the pet stands out. Flat colours for room surfaces, one soft light, no outlines, no glossy materials.
- **Big readable silhouette.** A ferret is long and low. Large head, big dark mask, small ears, a bushy two-part tail.
- **Expression comes from motion.** Eyes (they close and squint by scaling), ears, tail, and jaw carry the personality. No text in the scene (guide §9.1), no text baked into textures.
- **Pixel textures stay crisp.** Nearest-neighbour filtering, no mipmap blur on the pet.

## 2. The view

- The room is shown in **portrait**, 2:3 (360 by 540 logical px). The 3D camera is fixed: a perspective view from the front, tilted down about 30 degrees, pulled back until the room's width fits across the screen. No panning (guide §0).
- Everything that thinks about position (PetAI, the plan, the mini-game, touch) uses the **logical 360 by 540 px room**. `src/render/stageMap.ts` maps it to the 3D floor: 1 logical px is 3.2 mm, so the room is 1.152 m wide and the ferret (0.62 m) about 194 px long.
- Device pixel ratio capped at **2** (guide §4.4). Antialiasing on.
- Safe areas: the pet keeps clear of the top HUD band (about 64 px) and the bottom action bar (about 88 px). The canvas sits between them.
- A touch is turned into a point on the vertical plane through the pet (`stageMap.ts`), so touching the body counts as touching the pet.

## 3. Palette (16 colors)

| Name | Hex | Use |
|---|---|---|
| cream | `#F6ECDC` | app background, highlights |
| wall | `#EBD3B5` | room wall |
| wall-shade | `#DDBF9C` | wall base band |
| floor | `#C9A07A` | floor |
| floor-shade | `#A9805C` | floor boards, window frame, furniture wood |
| ink | `#3B2F26` | text, eyes, shadow |
| sable | `#8A6244` | sable coat body |
| sable-dark | `#4A3626` | sable mask, feet, tail tip |
| cinnamon | `#B9743C` | cinnamon coat body |
| albino | `#F4EBDD` | albino coat body |
| panda-dark | `#3E3A3F` | panda coat dark parts |
| belly | `#E8D2B0` | belly, hammock |
| nose-pink | `#E59AA0` | nose, tongue, albino eyes tint |
| water-blue | `#6FA8C8` | window, water bowl, drink effects |
| bowl-red | `#D9604C` | food bowl, toys |
| gold | `#F2C75C` | ball toy, found items, later "shinies", the mini-game timer |

All UI colours are drawn from this palette or from CSS variables with the same values, with a high-contrast variant defined in Phase 2 (guide §17). State is never shown by colour alone (guide §9.3).

## 4. The ferret

- **Model:** "Black Footed Ferret" by LandyStudio (CC BY 4.0), modified and rigged in Blender. Credit it in the credits screen and keep `ASSET_LICENSES.md` current. It faces +Z, stands on y = 0, 0.62 m long.
- **Rig and clips:** exact bone names, hierarchy, limits and the 13 clips are in `animation/RIG_SPEC.md`, `animation/CLIPS.md`, and `animation/clips.json`. The game reads `clips.json` and a test checks the exported file against it (`src/render/clipSpec.test.ts`).
- **No skinning.** Each box follows one bone, so the model stays crisp and cheap. Squash and stretch goes on the `torso` bone only, so head, legs, and tail never squash with it.
- **One-shot clips (`happy`, `annoyed`, `surprise`, `blink`) play additively** on top of the running loop, from the rest pose.
- **Walking pace:** `walk`, `sneak`, and `run` carry a stride and a ground speed in `clips.json`. The scene scales playback with the pet's real speed so paws stay planted.
- **Facing:** the whole ferret turns to face left or right; the camera never rotates.

## 5. Coats

Four coats (sable, cinnamon, albino, panda), chosen from the pet id seed (guide §7.8).

- **Today:** the model has one 64 by 64 texture (sable). The other coats are a **colour multiplied over it** (`src/render/coats3d.ts`), a stand-in that keeps them distinguishable.
- **Planned:** real textures with the same layout, `coat_cinnamon.png`, `coat_albino.png`, `coat_panda.png` (`animation/BLENDER_GUIDE.md` §9, colours as in the table below). Only the pet's own coat is loaded.

| Coat | body | dark parts (mask, feet, tail tip) | eyes |
|---|---|---|---|
| sable | `sable` | `sable-dark` | `ink` |
| cinnamon | `cinnamon` | `sable` | `ink` |
| albino | `albino` | `nose-pink` (nose and ears only) | `nose-pink` |
| panda | `albino` | `panda-dark` (legs, mask, tail) | `ink` |

## 6. Room (Phase 1)

One room, built in code from boxes and low-poly shapes in the palette (`src/render/scene3d.ts`):

- Floor with board lines, back wall with a darker base band, a window (frame, blue pane, cross bars) on the left.
- A hammock on the right of centre, made of two posts and a sling at the height the sleeping pet rests on (the pet walks to it and moves up and back a little when it sleeps).
- Food bowl (red) and water bowl (blue) on the floor at the sides, a gold ball toy, a sock on the floor that a mischievous pet can steal.
- Lighting: one ambient light and one soft sun, plain Lambert materials, **no real-time shadows** (a dark blob under the ferret instead, cheap on phones).
- No camera panning, no second room (guide §0).

## 7. Motion principles

- Personality first. A shy pet moves small and slow, a mischievous one moves in quick starts.
- Every action anticipates (small wind-up), acts, and settles (small overshoot).
- Sleeping is nearly still: the scene draws it 10 times a second (`clipSpec.ts`).
- Switching clips cross-fades for 0.2 s, so nothing snaps.
- `prefers-reduced-motion` shortens or removes bounces and particles in the interface, and the pet stays fully readable.

## 8. Files and tools

Free tools only: Blender (model, rig, clips), Krita or Piskel (textures). Sources live in `animation/` (the `.blend`, scripts that build the rig and clips, the Sketchfab original in `animation/source/`). The exported `animation/export/ferret.glb` is what the game loads. Every third-party asset is recorded in `ASSET_LICENSES.md`, and every asset's size in `ART_ASSET_LIST.md`.
