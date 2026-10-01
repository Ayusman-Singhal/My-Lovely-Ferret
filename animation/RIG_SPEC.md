# Rig spec (pet contract v1)

The game finds things by **name**. If a name is wrong, that part stays frozen. Names are case sensitive.

## 1. Axes, scale, origin

| Item | Rule |
|---|---|
| Blender version | 4.2 LTS or newer |
| Units | Metric, scale 1.0. 1 Blender unit = 1 meter |
| Size | Nose to tail base about **0.5 m** long and about **0.2 m** tall at the back. The game rescales, but keep it near this so numbers in `CLIPS.md` make sense |
| Up | Blender +Z |
| Facing | The nose points toward **Blender -Y** (the model looks at you in Front view, `Numpad 1`). The glTF exporter turns this into the standard glTF forward (+Z). The game turns the pet to face left or right |
| Left and right | The animal's **left side is +X** (when the nose points to -Y). `legFL` is the front leg on the +X side |
| Origin | The object origin of everything sits at the **ground, centered between the four feet**. Feet touch Z = 0 |
| Rotation and scale | Applied (`Ctrl+A`, Rotation & Scale) on every mesh before rigging. Armature object at rotation 0 and scale 1 |
| Side view for animating | `Ctrl+Numpad 3` (Left view). The nose points to the right of the screen |

## 2. Bones

16 required bones. All are plain bones in one armature named `Armature` (object) with the armature data named `ferret`. One bone per body part. Each box of the model belongs to exactly one bone.

| Bone | Parent | Moves | Pivot (joint) |
|---|---|---|---|
| `root` | none | Whole pet. Not animated by clips (the game moves the pet). Stays at the origin | Ground, between the feet |
| `body` | `root` | Breathing (scale), hops, squash, lean, curl for sleep | Center of the torso, a little above the hips |
| `head` | `body` | Nod, tilt, look. Includes the snout box | Neck joint, where the head meets the body |
| `jaw` | `head` | Opens for eat, drink, pant | Hinge at the back of the mouth |
| `nose` | `head` | Small twitch (scale and a tiny move) | Center of the nose box |
| `earL`, `earR` | `head` | Perk, flatten, twitch | Base of each ear, at the head |
| `eyeL`, `eyeR` | `head` | Scale on the vertical axis to blink, squint, widen | Center of each eye box |
| `tail1` | `body` | Sway, raise, curl | Where the tail meets the hips |
| `tail2` | `tail1` | Follows with delay (offset the timing a few frames) | Joint between the two tail boxes |
| `legFL`, `legFR` | `body` | Swing forward and back | Top of the leg, at the shoulder |
| `legBL`, `legBR` | `body` | Swing forward and back | Top of the leg, at the hip |
| `carry` | `head` | Nothing moves it. The game attaches the carried sock to it | At the mouth, slightly in front of the jaw. A bone of length about 0.02 m |

Optional (only if the torso is two boxes): `chest` with parent `body`. Then `head` and `legFL`, `legFR` use `chest` as parent. Tell Claude if you add it so the arching can be used.

**Tail:** if the model's tail is one box, still make `tail1` and `tail2` and split the box in two, or put the second bone on the tail tip box. Two segments make the sway read as soft.

**Ears and eyes:** if the model draws eyes and ears only as texture pixels, make them small extra boxes (cheap: 12 triangles each) so they can move.

## 3. How boxes attach (no skinning needed)

A blocky model does not bend. Each box simply follows its bone. In Blender, for each box: select the box, then the armature (active), `Ctrl+P`, **Bone**, and pick the bone in Pose mode. See `BLENDER_GUIDE.md` §4.5. This exports as nodes that follow joints, with no skin weights to paint, and is the smallest and fastest form in three.js.

If your export shows a box not following its bone, use the fallback in `BLENDER_GUIDE.md` §10.

## 4. Rest pose

The pose the game shows before any clip plays. Standing, relaxed, nose forward:

- All four legs straight down, feet flat on Z = 0.
- Head level, ears upright and slightly forward, tail low and extended behind, jaw closed, eyes fully open (scale 1.0).
- Every bone's rotation 0, scale 1 (the armature's rest position **is** the rest pose).

Every one-shot clip starts and ends on this pose.

## 5. Rotation conventions used in `CLIPS.md`

Described in words so you do not have to think about axes.

| Word | Meaning |
|---|---|
| nod down / up | Head or body pitch, the nose goes down or up |
| tilt | Roll to one side, like a curious dog |
| turn | Yaw left or right |
| swing forward / back | Leg rotates around the shoulder or hip so the foot goes toward the nose or the tail |
| perk | Ear stands up and slightly forward |
| flatten | Ear folds back against the head |

Numbers in `CLIPS.md` are in degrees and in percent of body size. They come from the working 2D version of the same animations, so the **feel** matches what the game was tuned for. Match the feel, not the digits.

## 6. Limits

| Limit | Value |
|---|---|
| Bones | 16 required, at most 24 |
| Triangles | At most about 500 for the whole pet (the original is 132) |
| Materials | 1 |
| Texture | One 64 by 64 PNG at most. Nearest-neighbor filtering is used in game, so keep it crisp pixel art |
| Animation length (any clip) | At most 6 seconds |
| Frame rate | **30 fps**, set in the Blender scene (Output properties) |

## 7. Pet contract for future pets

A future pet (for example a baby pink sheep, a seasonal limited-time pet) works with no code change if it follows this file:

- Same bone names. Missing optional parts (no tail, no jaw) are allowed: keep the bone but leave it unused, or leave it out and tell Claude.
- Same clip names and the same clip list. A sheep can have a different walk. It still calls it `walk`.
- Same axes, scale (adjusted per species, tell Claude the nose-to-tail length), and origin.
- Its own texture, same UV rules, with named coats if it has any.

Claude adds a small manifest per pet (`id`, display text keys, scale, coats). That is all the game needs. Multiple pets and limited-time pets are **not in scope yet** (see `docs/PLAN.md` open items). Keeping this contract costs almost nothing, which is why we keep it now.
