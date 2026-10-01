# Blender guide: model to animated ferret

Step by step. Written for Blender 4.2 LTS or newer. Claude cannot open Blender, so these steps could not be run here. If a menu name differs on your version, use the closest match and tell Claude what you saw. Read `RIG_SPEC.md` first (bone names and axes) and keep `CLIPS.md` open while animating.

Shortcut notes: `Numpad` keys need a numpad. Without one, use the View menu, Viewpoint, or turn on Preferences, Input, Emulate Numpad.

## 1. Get the model

1. Make a free Sketchfab account and sign in.
2. Open https://sketchfab.com/3d-models/black-footed-ferret-540a23f77ca74c9c9572cd6b6b25171e
3. Click **Download 3D Model**. Pick **glTF** (best for Blender). If there is also an original-format option from Blockbench, download that too and keep it as a backup.
4. Unzip into `animation/source/original/`. Keep the zip and the page URL. The license is **CC Attribution 4.0** (author LandyStudio): the game must show a credit. Claude records it in `docs/ASSET_LICENSES.md` and the in-app credits screen. If you change the model, that is allowed. The credit should say it was modified.
5. Do **not** commit other people's models from other sites without telling Claude. Check the license first (CC0 or CC-BY only. Never "NC" non-commercial or "ND" no-derivatives).

## 2. Import and set up the scene

1. Start Blender. `File > New > General`. Delete the default cube, light, and camera (`A`, then `X`, Delete).
2. `File > Import > glTF 2.0 (.glb/.gltf)` and pick the model.
3. Set up the scene now so you do not forget:
   - **Output Properties** (printer icon) > Frame Rate **30 fps**.
   - **Scene Properties** > Units: Unit System Metric, Unit Scale 1.0.
4. Save as `animation/source/ferret.blend` (`Ctrl+S`). Save often. Use `File > Save Incremental` (`Ctrl+Alt+S`) before big changes.
5. Open the `Layout` workspace's right side Outliner. Expand everything. You will probably see a tree of empties (Blockbench "groups") with box meshes under them. That tree is useful: it shows which boxes belong to which body part.

## 3. Inspect and clean up

Do these in order. Check each against `RIG_SPEC.md` §1.

### 3.1 Count the parts

Write down which boxes you have: body, head, snout, ears, eyes, nose, tail, four legs, feet. Expect gaps: the Sketchfab page lists 88 vertices and 132 triangles (checked 2026-10-01), which is exactly **11 boxes**. So the eyes and jaw are almost certainly painted on, not separate boxes, and the tail is probably one box. Plan to add about 5 boxes: `m_eyeL`, `m_eyeR`, a lower-jaw box, and maybe a nose box and a second tail box. If something is missing (for example, no separate ears or eyes), model small boxes for them now (`Shift+A > Mesh > Cube`, scale it, move it). Boxes of about 12 triangles each are fine.

### 3.2 Fix orientation and size

1. Press `Numpad 1` (Front view). The ferret should **look at you** (the nose points toward you, which is Blender -Y). If it faces another way, select everything (`A`), press `R`, `Z`, and the angle (for example `90` or `180`), `Enter`.
2. Length check: `N` opens the sidebar. In the Item tab, Dimensions shows the size of the selected object. Select all and look at the combined size, or measure with the ruler. Nose to tail should be about 0.5 m. If not, select all, scale (`S`), then continue.
3. Feet on the ground: in Side view (`Ctrl+Numpad 3`), the lowest point of the feet must sit at Z = 0. Select all, `G`, `Z`, move. If needed, set the 3D cursor to the world origin (`Shift+C`) and use that as reference.
4. Centered between the feet: in Top view (`Numpad 7`), the middle of the four feet should be at X = 0, Y = 0.

Do **not** apply transforms yet. The boxes are still children of the imported empties, so applying now would not stick: clearing the parents in §3.3 puts the parents' rotation and scale back onto every box. Applying comes at the end of §3.3.

### 3.3 Flatten the hierarchy

Blockbench groups arrive as empties. You do not need them after rigging.

1. Select all the meshes (`Select > Select All by Type > Mesh`).
2. `Alt+P > Clear and Keep Transformation` removes the empty parents without moving anything.
3. Delete the empty objects (`Select > Select All by Type > Empty`, `X`).
4. **Apply transforms.** Select all meshes, `Ctrl+A > All Transforms`. Every box now has location 0, rotation 0, scale 1, and its origin at the world origin (the ground between the feet, as `RIG_SPEC.md` §1 asks). If Blender says it cannot apply to a multi user mesh, the importer made some boxes share one mesh (often the legs). Fix it with `Object > Relations > Make Single User > Object & Data`, then apply again. Check: `N` panel, Item tab, every box shows Rotation 0 and Scale 1.
5. Optional: join boxes that will share one bone, for example head box and snout box. Select them (the box you want as the main one last), `Ctrl+J`. Joined boxes are one object, less to manage. Do not join boxes from different bones.
6. Rename every mesh object by body part: `m_body`, `m_head`, `m_snout`, `m_earL`, `m_earR`, `m_eyeL`, `m_eyeR`, `m_nose`, `m_tail1`, `m_tail2`, `m_legFL`, `m_legFR`, `m_legBL`, `m_legBR`. Double click the name in the Outliner, or `F2`.

### 3.4 One material, one texture

1. Select a mesh and open the **Material** tab. There should be one material. If the boxes use more than one, tell Claude.
2. Pixel art must look crisp: switch to the Shading workspace, find the **Image Texture** node, set **Interpolation to Closest**. This also exports as nearest-neighbor.
3. Check the texture size (Image Editor, `N`, Image tab). At most 64 by 64. If it is larger, tell Claude.

## 4. Build the armature

### 4.1 Add one bone

1. In Object mode, `Shift+A > Armature > Single Bone`. Select the new armature object. In the Outliner, rename the **object** to `Armature` and the **armature data** (the green icon under it) to `ferret`.
2. In the Object Properties tab, Viewport Display, tick **In Front** so you can see bones through the boxes.

### 4.2 Make the 16 bones

Switch to Edit mode (`Tab`). Work in Side view (`Ctrl+Numpad 3`, orthographic).

For each bone: select the first bone, then extrude with `E` and move, or duplicate with `Shift+D`. Bone **head** (the round end) goes at the joint, **tail** (the pointed end) goes along the part. See the pivot column in `RIG_SPEC.md` §2. The joint position matters most, because that is the point the box rotates around.

1. `root`: a short bone at the ground in the middle, pointing up. Length about 0.05 m.
2. `body`: from the center of the torso, pointing toward the nose.
3. `head`: from the neck joint, pointing forward through the head.
4. `jaw`: from the hinge at the back of the mouth, pointing forward along the lower jaw. If the model has no separate jaw, make a small box for it (the lower lip) so there is something to open.
5. `nose`: a tiny bone in the middle of the nose box, pointing forward (toward the nose tip).
6. `earL`, `earR`: from the base of each ear, pointing up the ear.
7. `eyeL`, `eyeR`: a tiny bone in the middle of each eye, pointing forward. (This makes "vertical" the bone's local Z axis, which is the axis blinks scale on.)
8. `tail1`: from the tail root, pointing back along the first tail box. `tail2`: from the joint between tail boxes, pointing back.
9. `legFL`, `legFR`, `legBL`, `legBR`: from the top of each leg (shoulder or hip) down along the leg.
10. `carry`: a tiny bone (0.02 m) at the mouth, in front of the jaw, pointing forward.

Rename each bone: select it, `F2`, type the exact name. Check the spelling against `RIG_SPEC.md`. Check left versus right: `L` is the **+X** side (the animal's left, see Front view).

### 4.3 Set the parents

Still in Edit mode. For each bone, select the child, then `Shift`-select the parent so the parent is last (active), and `Ctrl+P > Keep Offset`. Or use the Bone Properties tab > Relations > Parent. The tree is:

```text
root
 └─ body
     ├─ head
     │   ├─ jaw
     │   ├─ nose
     │   ├─ earL, earR
     │   ├─ eyeL, eyeR
     │   └─ carry
     ├─ tail1 ─ tail2
     └─ legFL, legFR, legBL, legBR
```

Tip: with the armature selected, turn on **Display > Names** in the Armature Data tab to read bone names in the viewport.

### 4.4 Check the roll

Bones that twist oddly make rotations confusing. The goal: every bone's local X axis lies along world X, so "nod down" is a rotation around X for head, jaw, body, tail, and legs alike.

Do **not** recalculate all bones with one setting. "Global Z" is undefined for a bone that itself points straight up or down (legs, ears), and Blender then picks a random roll. Do it in two groups, in Edit mode:

1. Select the forward and backward bones: `body`, `head`, `jaw`, `nose`, `eyeL`, `eyeR`, `carry`, `tail1`, `tail2`. `Armature > Bone Roll > Recalculate Roll > Global +Z Axis`.
2. Select the up and down bones: `root`, `legFL`, `legFR`, `legBL`, `legBR`, `earL`, `earR`. `Recalculate Roll > Global -Y Axis`.
3. Check: Armature Data tab > Viewport Display > tick **Axes**. Every bone's red (X) axis should point straight left or right across the body. Untick Axes when done.

If a bone is tilted (for example ears leaning forward), it still works: the roll just needs to keep X sideways.

### 4.5 Attach each box to its bone

This is the "no skinning" way: each box follows one bone like a stiff joint.

`Ctrl+P > Bone` parents to the armature's **active bone**. It does not show a list of bones, so the bone has to be picked first:

1. Go to Object mode (`Tab`).
2. Click the box (for example `m_head`), then `Shift`-click the armature (the armature must be **active**, last clicked).
3. Switch to Pose mode (`Ctrl+Tab`). The box stays selected in the background.
4. Click the bone (`head`) so it is the active bone (highlighted light blue).
5. `Ctrl+P > Bone`. The box now follows that bone and does not move.
6. Back to Object mode (`Ctrl+Tab`) and repeat for every box. Reference mapping:

| Mesh | Bone |
|---|---|
| `m_body` | `body` |
| `m_head`, `m_snout` | `head` |
| lower jaw box | `jaw` |
| `m_nose` | `nose` |
| `m_earL`, `m_earR` | `earL`, `earR` |
| `m_eyeL`, `m_eyeR` | `eyeL`, `eyeR` |
| `m_tail1` | `tail1` |
| `m_tail2` | `tail2` |
| `m_legFL` ... `m_legBR` | `legFL` ... `legBR` |

Check: select the armature, go to **Pose mode** (`Ctrl+Tab`), select the `head` bone, press `R`, `X`, `20`. The head, ears, eyes, jaw, and nose should all turn together and nothing else. Cancel with right-click or `Esc`. Do this for every bone.

## 5. Rest pose

The rest pose is simply how the armature looks in Edit mode with no pose applied. Make sure:

- Every pose bone has rotation 0 and scale 1 and location 0 (in Pose mode: `A` to select all, `Alt+R`, `Alt+S`, `Alt+G` clear them).
- Standing, relaxed, as in `RIG_SPEC.md` §4.

Save. Then do the **first stop**: save and send Claude `animation/source/ferret.blend`. Claude can check bone names, hierarchy, and sizes from the file.

## 6. Animate

### 6.1 Workspace

Use the **Animation** workspace (tabs at the top). It has a 3D viewport, a Dope Sheet at the bottom, and a Timeline. Select the Armature and go to Pose mode (`Ctrl+Tab`). Change the main viewport to Side view (`Ctrl+Numpad 3`).

### 6.2 Create a clip (an "action")

1. In the **Dope Sheet** editor, switch its mode (dropdown at the left) to **Action Editor**.
2. With the armature selected, click **New**. A new action appears. **Rename it exactly** to the clip name, for example `idle` (double click the name field).
3. Click the **shield icon** next to the action name (Fake User). **Every action needs it.** Without it, Blender throws unused actions away on save and the exporter skips them.
4. Set the playback range for this clip: in the Timeline, **Start** = `0`, **End** = the `frames` value in `CLIPS.md` (for loops this is the frame that equals frame 0, so the loop is `frames` long).

To make the next clip: click the **New** (duplicate) button next to the action name, rename the copy, and change the poses. Or pick a clean start: unlink with the X (the action stays in the file thanks to the Fake User), click New again.

### 6.3 Key poses

1. Set the playhead to a frame (click in the Timeline, or `Left/Right` arrows).
2. In Pose mode, move or rotate bones (`G`, `R`, `S`). Use the **N panel > Item** for exact numbers.
3. Press `I` to insert keyframes for the selected bones. In Blender 4.1 and newer, `I` keys the channels listed in **Preferences > Animation > Default Key Channels** (Location, Rotation, Scale by default). If you get a menu, choose **Location, Rotation, Scale**. To key every bone at once, press `A` to select all bones first, then `Shift`-click `root` and `carry` to deselect them. Those two are never keyed (`CLIPS.md` rule 7).
4. The first work on a loop clip: **frame 0**: set the starting pose, select all bones except `root` and `carry`, `I`. Then go to frame `N`, and make the **same pose** (see 6.5), `I`.
5. Add the in-between key poses from `CLIPS.md` (big poses first, small motion after). Use **pose-to-pose**: block the main poses, play, then refine.
6. Play with `Space`. Playback loops inside the Start to End range.

### 6.4 Quality tips for a cute result

- Aim for squash and stretch on `body` scale. The game looks best with a soft bounce.
- Leave all bones except `root` and `carry` keyed on loops. On one-shots key only the bones that move (see `CLIPS.md`, rule 2).
- Use the **Graph Editor** (change an editor to Graph Editor) to smooth curves: select a curve, `T` to set interpolation, or look for popping or flat sections.
- Overlap: after the body, move the tail 3 to 5 frames later, ears 2 to 3.
- Check from Front view too, so legs do not cross through each other, and boxes do not intersect badly.
- 30 fps is fast. Do not key every frame. Key poses every 2 to 6 frames and let the curves fill in.

### 6.5 Copy frame 0 to frame N (loops)

1. In the Dope Sheet, box select all keys on frame 0 (drag a box around the first column).
2. `Ctrl+C`. Move the playhead to frame `N`. `Ctrl+V`.

If you edit frame 0 later, repeat this. Frame `N` must always match frame 0.

### 6.6 Loop check

1. Set the Timeline range to `0` to `N`, so the last frame is shown. Play. You will see one hold at the loop point because frame 0 and frame N are equal. That is expected.
2. In the exported game clip the duplicate frame is dropped, so this hold disappears. Do not delete frame `N`.

### 6.7 One-shots

Reaction clips (`happy`, `annoyed`, `surprise`, `blink`) start and end on the rest pose. Frame 0 and frame `N` are both rest, and both are keyed (the last key sets the clip length the game checks). Key only the bones that move. Test by playing with the range set to `0` to `N`.

The game adds these clips on top of the running loop (only their change from the rest pose counts). So animate them from the standing rest pose, even though in the game `happy` may play while the pet is eating.

When you switch to a one-shot in the Action Editor, bones it does not key keep whatever pose the last clip left them in. Before you animate or check a one-shot, clear the pose first: in Pose mode, `A`, then `Alt+R`, `Alt+S`, `Alt+G`.

### 6.8 Order of work

See the priority table in `README.md`. First `idle` and `walk`, then send a file so the game can already show a real ferret walking.

## 7. Export

1. Make sure all actions have the fake user shield (list them in the Dope Sheet action dropdown).
2. Exit Pose mode (`Tab` to Object mode). Select the armature and all meshes (`A` selects all).
3. `File > Export > glTF 2.0 (.glb/.gltf)`.
4. Set these options in the panel on the right, leave the rest at default:

| Section | Setting |
|---|---|
| Format | **glTF Binary (.glb)** |
| Include | Limit to **Selected Objects** on (so the lights and cameras do not leak in) |
| Transform | **+Y Up** on |
| Data > Mesh | **Apply Modifiers** on. UVs and Normals on |
| Data > Material | **Export** |
| Data > Images | **Automatic** |
| Data > Shape Keys | off |
| Data > Armature | **Export Deformation Bones Only** off (we need every bone). Use Rest Pose Armature: leave default |
| Animation | **Animation** on. **Mode: Actions** (all actions with fake user). **Sampling Animations** on, rate 1. **Optimize Animation Size** on. (Older Blender versions called the sampling option "Always Sample Animations". It is the same setting: leave it on.) |
| Animation > Shape Keys, Lighting, Cameras | off |

5. File name: `animation/export/ferret.glb`. Export.

## 8. Check the export

1. Open https://gltf-viewer.donmccurdy.com/ in the browser and drag `ferret.glb` onto it.
2. In the right panel open **Animation** and check the dropdown lists all 17 clip names, spelled exactly. Pick each one and look at it. The pet should face the viewer's forward direction, stand on the ground, and each box follow its bone.
3. Check the texture is crisp and the colors are correct.
4. Check the file size. Expected: under 100 KB. Claude will minimize it further.

Send Claude the file and say which clips are done. Claude checks bone names, clip names, frame counts (against `clips.json`), triangle count, and bounding box, then wires it into the game.

## 9. Coats (texture variants)

The model has one small texture. The game has four coats (sable, cinnamon, albino, panda). The coats use the **same UV layout**, so you only repaint the PNG.

1. Export the base texture from Blender (Image Editor > Image > Save As) or from the `.glb`'s embedded texture. Start from the sable coat. Save as `animation/source/coat_sable.png`.
2. Open it in a free pixel tool: **Krita** (set the canvas to 64 by 64, filter mode nearest), **Piskel** (piskelapp.com, runs in the browser), or **Blockbench** paint tab.
3. Make three variants. Colors come from `docs/ART_STYLE.md` §3 and §5:
   - `coat_cinnamon.png`: body `#B9743C`, dark parts `#4A3626`.
   - `coat_albino.png`: body `#F4EBDD`, nose and ears `#E59AA0`, eyes `#E59AA0`.
   - `coat_panda.png`: body `#F4EBDD`, legs, mask, and tail `#3E3A3F`.
4. Do not move any pixels around. Do not resize. Keep the same dimensions and the same transparent areas.
5. Save to `animation/source/` and tell Claude. Claude puts them in `public/models/coats/`.

The black-footed ferret pattern (dark mask, dark feet, dark tail tip) is the "sable" look in this game's palette. The albino and cinnamon coats lose the dark parts or tone them down.

## 10. Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| A clip is missing from the export | No fake user shield, or name typo | Check the shield on every action in the Action Editor list. Check the exporter's Animation mode is **Actions** |
| A box does not follow its bone in the viewer | Bone parent was not set, or the box was not selected last | Redo §4.5 for that box |
| A box does not follow its bone in the viewer, even after redoing | Exporter issue with bone parenting | **Fallback:** select all boxes, then the armature, `Ctrl+P > With Empty Groups`. In Edit mode on each box, select all vertices, pick its bone's vertex group (Object Data tab > Vertex Groups), set Weight 1.0, click **Assign**. Then export with skinning (Data > Armature > Skinning on) |
| The pet faces sideways or backward in the viewer | Orientation not fixed before export | Redo §3.2, apply transforms (§3.3 step 4), re-export |
| The pet floats or sinks | Feet are not at Z = 0 | Redo §3.2 step 3 |
| A loop hitches even though frame `N` equals frame 0 | A repeating motion's period does not divide the loop length | `CLIPS.md` rule 10 |
| The pet looks smooth and blurry | Texture interpolation not Closest | §3.4 |
| The loop has a stutter | Frame `N` is not equal to frame 0 | §6.5 |
| Bones rotate on strange axes | Bone roll differs between bones | §4.4 |
| Everything is tiny or huge | Units or scale | §2 and §3.2 |

If stuck, send Claude a screenshot, the `.blend`, and what you tried.

## 11. Saving and git

- Keep `.blend` and downloaded originals in `animation/source/`. They are small and fine to commit. Keep `*.blend1` backup files out of git (Claude adds them to `.gitignore`).
- Exports go in `animation/export/`. Claude copies the optimized final to `public/models/`.
- Credit the author: LandyStudio, "Black Footed Ferret", CC BY 4.0, modified. Claude records it before any commit of the model.
