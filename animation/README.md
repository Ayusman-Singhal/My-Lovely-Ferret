# Animation: start here

Everything needed to turn the blocky ferret model into the animated pet in the game. You do the Blender work. Claude does the code that plays the clips. The two meet at one file, `ferret.glb`, so the rules in this folder are exact: bone names, clip names, frame rate, axes.

## The decision (2026-10-01)

- Look: **cute blocky ferret** (Blockbench style, small pixel texture). Not realistic. Not Minecraft's own assets.
- Base model: **"Black Footed Ferret" by LandyStudio**, CC Attribution 4.0, 132 triangles, 1 texture, no rig, no animations. https://sketchfab.com/3d-models/black-footed-ferret-540a23f77ca74c9c9572cd6b6b25171e
- Render: three.js in the browser. All clips are made in Blender by you.
- Future pets (limited-time pets such as a baby pink sheep) reuse the **pet contract** in `RIG_SPEC.md`: same bone names, same clip names. A new pet is then one new `.glb` plus a texture, with no code changes. Make original blocky animals. Do not use Mojang's models or textures.

## Files in this folder

| File | What it holds | Read it when |
|---|---|---|
| `README.md` | This overview, checklist, folder map | First |
| `BLENDER_GUIDE.md` | Step by step Blender work: download, clean up, rig, animate, export, test | While working |
| `RIG_SPEC.md` | Axes, scale, bone names, hierarchy, pet contract | Building the rig |
| `CLIPS.md` | Every clip: length, key poses, numbers taken from the current game | Animating |
| `clips.json` | Machine-readable clip list the game and its tests read | Never edit by hand without telling Claude |
| `source/` | Your `.blend` files and the downloaded original model | Working files |
| `export/` | Raw `.glb` exports before Claude optimizes them | After export |
| `scripts/` | Blender Python: `build_rig.py` (v1 rig), `upgrade_rig_v2.py` (spine and knees), `animate.py` (13 clips), `render_previews.py`, `export_glb.py`, `run_all.py` (all three), `fix_texture.py`, `restore_backup.py`. QA renders in `scripts/qa/` | To change a clip: edit `animate.py`, then run `run_all.py` |
| `scripts/make_chubby.py` | Reshapes the body (wider, taller chest, thick short neck, bushier tail, legs under the wider body), then reruns `animate.py` and `export_glb.py`. Run it from the saved start file so it never stacks: `blender.exe -b animation/source/Ferret_before_chubby.blend --python animation/scripts/make_chubby.py` | When the proportions look off (2026-10-01: a long thin neck made the ferret look malnourished) |
| `previews/` | Animated GIF of every clip, and `all_clips.gif` with all 13 side by side | To review motion without Blender |

The final game files go to `public/models/` (Claude puts them there). Do not put anything in `public/` yourself.

## What to deliver

One file, `animation/export/ferret.glb`, containing:

1. The ferret mesh (at most about 5,000 triangles, one material, one texture up to 256 by 256 pixels, see `RIG_SPEC.md` section 6).
2. One armature with exactly the bones in `RIG_SPEC.md`.
3. 13 animation clips named exactly as in `CLIPS.md`: `idle`, `walk`, `run`, `sniff`, `curious`, `sleep`, `eat`, `drink`, `sneak`, `happy`, `annoyed`, `surprise`, `blink`.

Plus the four coat textures (`coat_sable.png`, `coat_cinnamon.png`, `coat_albino.png`, `coat_panda.png`), same size and same UV layout as the base texture. Palettes are in `docs/ART_STYLE.md` §3 and §5.

## Checklist

Steps 1 to 7 were done on 2026-10-01 by script in Blender 5.2 (see `scripts/`). Rig v2 (bendable spine, knees) and the v2 clips replaced the first pass the same day. Animated previews are in `previews/`. To change a clip, edit `animate.py` and run `run_all.py` in Blender's Python console.

Tick these as you go. Each line is a stop point where you can send Claude the file.

- [x] 1. Account on Sketchfab (free), download the model, save it to `source/`. (`BLENDER_GUIDE.md` §1)
- [x] 2. Import to Blender, fix orientation, scale, origin, and parts. (§2 to §3)
- [x] 3. Build the armature with the exact bone names. (§4)
- [x] 4. Make the rest pose and check that bones move the right boxes. (§5)
- [x] 5. Animate the loops: `idle`, `walk`, `run`, `sniff`, `curious`, `sleep`, `eat`, `drink`, `sneak`. (§6, `CLIPS.md`)
- [x] 6. Animate the one-shots: `happy`, `annoyed`, `surprise`, `blink`. (§6)
- [x] 7. Export `ferret.glb` and open it in the web viewer to check the clips. (§7 to §8)
- [ ] 8. Paint the three other coats in the texture. (§9)
- [ ] 9. Send Claude the `.glb`. Claude runs the checks, optimizes it, and wires it in.

Good first milestone: steps 1 to 4 plus `idle` and `walk`. Send that, and the game can show the real ferret walking around while you finish the rest. Until a clip exists, the game holds the rest pose for it.

## Priorities if time is short

Cut scope before adding it (project rule). Order of importance:

1. `idle`, `walk`, `sleep`, `eat`, `drink` (the pet is on screen doing these most of the time).
2. `happy`, `blink`, `run`, `sniff`.
3. `curious`, `sneak`, `annoyed`, `surprise`.
4. Later and optional: `warDance` (proposal A1 in `docs/MARKET_RESEARCH.md`), kit growth, tricks.

## Who does what

| You (Blender) | Claude (code) |
|---|---|
| Model cleanup, rig, clips, textures, export | Loader, three.js scene, mapping game behaviors to clips, crossfades, blink timing, coat swapping, facing left and right, loading screen, size checks, tests |
| Tell Claude when a clip feels wrong | Adjust playback speed, blend times, and look-at without re-exporting |

Claude cannot open Blender, so Claude cannot verify the Blender steps. If a menu name differs in your Blender version (these steps assume Blender 4.2 LTS or newer), use the closest match and tell Claude what you saw.
