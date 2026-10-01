# Art and Audio Asset List

Every asset the game needs, with its size once it exists (guide §9.2, §22). Update the **Size** column whenever an asset is added or changed, and keep the totals in `PERFORMANCE.md` current. Budget for first-run assets: at most 10 MB (relaxed on 2026-10-01, see `PERFORMANCE.md`).

Status values: `todo`, `placeholder` (stand-in until the real thing), `code` (built in code from boxes and palette colours, 0 KB of files), `final` (real art file).

## Phase 1: the ferret (3D, see `ART_STYLE.md` section 4)

| Asset | Status | Size |
|---|---|---|
| `animation/export/ferret.glb`: mesh (264 triangles, 20 box pieces), armature (22 bones), 13 clips, one 64 by 64 texture | final (first pass of the clips, polish welcome) | 306 KB raw, 74 KB gzip |
| coat textures `coat_cinnamon.png`, `coat_albino.png`, `coat_panda.png` (same layout as the sable texture inside the model) | todo (a colour tint stands in, `src/render/coats3d.ts`) | about 1 KB each |

Clips (names and lengths are checked against `animation/clips.json` by `src/render/clipSpec.test.ts`): `idle`, `walk`, `run`, `sniff`, `curious`, `sleep`, `eat`, `drink`, `sneak`, `happy`, `annoyed`, `surprise`, `blink`.

Phase 2 additions (guide §9.1): scratch, groom, more reactions. Proposals in `MARKET_RESEARCH.md`: war dance, dook, dead-sleep, shake, kit-to-adult growth, tricks.

## Phase 1: room and props

All built in code from boxes and palette colours (`src/render/scene3d.ts`), so they cost 0 KB of files.

| Asset | Status | Size |
|---|---|---|
| room: floor with board lines, back wall, wall base band, window | code | 0 KB |
| hammock (two posts, sling) | code | 0 KB |
| food bowl, water bowl | code | 0 KB |
| toys: ball (also in the room), feather, ring, sock | code | 0 KB |
| sock (stealable item), also carried in the mouth | code | 0 KB |
| blob shadow under the ferret | code | 0 KB |
| mini-game timer bar (a DOM element, shapes only) | code | 0 KB |
| particles: hearts, sparkles, zzz (pooled, guide §4.4) | todo (Phase 2) | |

## Phase 1: UI icons

Icons must pair with a label or shape, never colour alone (guide §9.3, §17). Drawn as inline SVG in the Preact components.

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
| First-run assets (the model) | 306 KB raw, 74 KB gzip |
| Total installed art and audio | 306 KB |
