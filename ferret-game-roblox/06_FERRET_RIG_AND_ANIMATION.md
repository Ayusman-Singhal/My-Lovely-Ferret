# The ferret: parts, joints, and code animation

How to build the blocky ferret inside Roblox Studio and make it move. This is separate from the Blender work in `animation/` (that is for the real game). It reuses the **bone names** of `animation/RIG_SPEC.md` and the **timings and angles** of `animation/CLIPS.md` and `src/render/animations.ts`, so the two versions feel the same. All Luau here is **untested** skeleton code.

## 1. Why Parts and joints instead of a Blender import

A blocky ferret is boxes. Roblox builds boxes natively, so you can make the whole ferret in Studio in an evening with no import tools. Importing a rigged mesh with animations from Blender works, but it is fragile (FBX versions, custom rigs, plugin steps, matching axes) and a bad first project for a beginner. Optional upgrade in section 9.

## 2. Parts

All Parts are in one Model named `Ferret`. Sizes are in studs (1 stud is about 0.28 m). The ferret is about 4 studs from nose to tail base. Sizes below are a starting point. Judge with your eyes.

| Part name | Size (X wide, Y tall, Z long) | Notes |
|---|---|---|
| `root` | 0.4 x 0.2 x 0.4 | Invisible (Transparency 1), the model's `PrimaryPart`, **Anchored = true**, at the ground between the feet |
| `body` | 1.2 x 1.0 x 2.2 | The long torso |
| `head` | 1.1 x 1.0 x 1.1 | Includes a front box `snout` 0.6 x 0.5 x 0.5 as a separate Part welded to the head |
| `jaw` | 0.6 x 0.2 x 0.5 | Lower jaw under the snout |
| `nose` | 0.25 x 0.2 x 0.15 | Pink |
| `earL`, `earR` | 0.3 x 0.4 x 0.15 | On top of the head, one each side |
| `eyeL`, `eyeR` | 0.2 x 0.2 x 0.1 | Dark squares on the front of the head |
| `lidL`, `lidR` | 0.22 x 0.22 x 0.12 | Same color as the head, sitting just in front of each eye and **above** it, so the eye is visible. Lowering a lid closes the eye (blink, sleep, happy squint). Extra to the Blender rig, because `Transform` cannot scale a Part |
| `tail1`, `tail2` | 0.4 x 0.4 x 0.9 each | Two segments, the second is slimmer |
| `legFL`, `legFR`, `legBL`, `legBR` | 0.35 x 0.7 x 0.35 | Four legs |
| `carry` | 0.1 x 0.1 x 0.1 | Invisible marker in front of the jaw, where the sock goes |

Facing: the ferret faces **+Z** in its own space (the front of the head is at the larger Z). In the game it is turned to face left or right.

Settings for every Part except `root`: **Anchored = false**, **CanCollide = false**, **CanTouch = false**, **Massless = true**, **Material = SmoothPlastic** (or Plastic), no shadows needed. Use a flat look with a few colors from `docs/ART_STYLE.md` (the sable coat: body `#8A6244`, dark parts `#4A3626`, belly `#E8D2B0`, nose `#E59AA0`, eyes `#3B2F26`). A black-footed ferret look: pale body, dark mask over the eyes, dark feet, dark tail tip. A dark box on the face (`mask`) sits above the head and eyes.

## 3. Joints (Motor6D)

A **Motor6D** joins two Parts and lets the second turn around a pivot on the first. The ferret's skeleton:

```text
root
 └─ body
     ├─ head
     │   ├─ jaw
     │   ├─ nose
     │   ├─ earL, earR
     │   ├─ eyeL, eyeR
     │   ├─ lidL, lidR   (extra, for blinking)
     │   └─ carry
     ├─ tail1 ─ tail2
     └─ legFL, legFR, legBL, legBR
```

Same tree as `animation/RIG_SPEC.md`. For each child Part, add a Motor6D **inside the child** (Explorer: hover the child Part, press +, choose `Motor6D`) and set:

- `Part0` = the parent Part (for example `body` for the `head` joint),
- `Part1` = the child Part (`head`),
- `C0` = the position of the pivot in the **parent's** space, `C1` = the position of the same pivot in the **child's** space.

The pivot is the joint: the neck for the head, the shoulder for a front leg, the root of the tail for `tail1`. If you set `C1 = CFrame.new(0, 0, 0)` and make each child Part's pivot sit at its own center, you only need `C0` to place the child relative to its parent.

Easier: write a one-time script in the **Command Bar** (View tab) that creates all the Motor6Ds from a table of `{child, parent, pivotOffset}`. Ask Claude to write that helper once the Parts exist and you know the pivot offsets.

To verify: in Play mode select the model, and in the Command Bar run `workspace.Ferret.head.Motor6D.C0 = workspace.Ferret.head.Motor6D.C0 * CFrame.Angles(math.rad(20), 0, 0)`. The head should nod down 20 degrees and carry the ears, eyes, and jaw with it. If one Part stays behind, its joint is missing.

Set `Ferret.PrimaryPart = root`. Anchor `root` only. Because `root` is anchored and all other Parts are connected by joints, moving the model with `ferret:PivotTo(cframe)` moves the whole ferret.

When it works, drag the `Ferret` model into `ReplicatedStorage.Assets` (the Client script clones it from there).

## 4. How animation works here (no Animation Editor needed)

The animations in the main game are **formulas of time** (`src/render/animations.ts`): for example, the idle tail angle is `0.12 x sin(2π t / 2600 ms)`. We do the same thing in Luau. Every frame the `FerretRig` module computes a small pose (an angle or offset for each joint) from the current animation name and time, and sets each Motor6D's `Transform` to it.

`Motor6D.Transform` is a CFrame (rotation and position only, **no scale**) that is applied **on top of** `C0`/`C1`, and Roblox resets it only if something else (an Animator) writes it. Because the ferret has no `Humanoid` or `Animator`, nothing else touches it. Set it every frame on the client. It does not replicate, which is what we want (every client animates its own copy).

```lua
-- FerretRig (ModuleScript). UNTESTED skeleton.
local FerretRig = {}
FerretRig.__index = FerretRig

local JOINTS = { "body","head","jaw","nose","earL","earR","lidL","lidR","tail1","tail2","legFL","legFR","legBL","legBR" }

function FerretRig.new(model)
  local self = setmetatable({}, FerretRig)
  self.model = model
  self.joints = {}
  for _, name in JOINTS do
    local part = model:FindFirstChild(name)
    self.joints[name] = part and part:FindFirstChildOfClass("Motor6D")
  end
  self.base = "idle"
  self.baseStart = 0
  self.reaction = nil          -- {name=..., start=...}
  return self
end

function FerretRig:setBase(name, now) if name ~= self.base then self.base = name; self.baseStart = now end end
function FerretRig:react(name, now) self.reaction = { name = name, start = now } end

function FerretRig:update(now)    -- now in seconds, call every frame
  local pose = Animations[self.base](now - self.baseStart)           -- returns a table of joint -> CFrame
  if self.reaction then
    local t = now - self.reaction.start
    local r = Animations[self.reaction.name](t)
    if r == nil then self.reaction = nil else for joint, cf in r do pose[joint] = cf end end
  end
  for name, joint in self.joints do
    if joint then joint.Transform = pose[name] or CFrame.identity end
  end
end

return FerretRig
```

`Animations` is a table of functions, one per clip, each returning `{ head = CFrame..., tail1 = CFrame..., ... }` for time `t` in seconds. A one-shot returns `nil` after its duration.

Blend between two base clips for about 0.2 seconds by calculating both poses and mixing them with `CFrame:Lerp(other, alpha)` joint by joint. This avoids visible jumps when the behavior changes.

## 5. Clip formulas

Directions: **pitch** is a rotation around the joint's X axis (nose up or down, leg swing), **yaw** around Y (turn), **roll** around Z (tilt). Use `CFrame.Angles(pitch, yaw, roll)` in radians. The signs may need flipping once you see the ferret move: a head that nods the wrong way just needs a minus sign. `wave(t, period, phase) = math.sin(2π t / period + phase)` with `t` and `period` in seconds. The numbers come from `src/render/animations.ts` (radians there, same here).

| Clip | Loop | Formula summary |
|---|---|---|
| `idle` | 3.2 s | body breathing: the body moves up and down `0.02 x wave(t, 3.2)` studs; head pitch `0.03 x wave(t, 4.1)`; tail1 yaw `0.12 x wave(t, 2.6)` with base pitch 0.15, tail2 yaw `0.1 x wave(t, 2.6, -1)`; ear twitch: every 5.3 s earR pitches back `0.3` for 0.24 s (use a half sine), and earL every 6.1 s |
| `walk` | 0.52 s | legFL and legBR swing `0.55 x wave(t, 0.52)`; legFR and legBL swing `0.55 x wave(t, 0.52, π)`; body lifts `0.05 x |sin(π t / 0.26)|`; body yaw `0.03 x sin(2 x phase)`; head pitch `0.05 x wave(t, 0.26)`; tail yaw `0.1 x wave(t, 0.52, 1)`; ears back 0.15 |
| `run` | 0.32 s | legs swing `0.85`; body hop `0.12 x |sin(π t / 0.16)|` studs; tail up `0.7`, tail2 `0.3`; ears back `0.4`; jaw open slightly |
| `sniff` | 1.4 s | head pitch down `0.25 + 0.08 x wave(t, 1.4)`; head sway side to side `0.08 x wave(t, 0.7)`; nose twitches fast: moves forward and back `0.03 x wave(t, 0.11)` studs; ears forward `-0.2` |
| `curious` | 2.6 s | body pitch up `-0.16`; head pitch `-0.25 + 0.1 x wave(t, 2.6)`, head roll `0.1 x wave(t, 2.6, 1)`; ears forward `-0.3`; eyes slightly wider (lids raised a little); tail up 0.4 |
| `sleep` | 4.2 s | curled pose: body lowered 0.5 studs with slow breathing (up and down `0.04 x wave(t, 4.2)` studs); head pitch down `0.55`, offset to the side; ears flat `0.5`; tail1 wrapped around (yaw `-2.75` split between tail1 and tail2); legs folded (pitch to tuck); lids down (eyes closed). Update at about 10 frames per second |
| `eat` | 1.3 s | head pitch down `0.75`, forward 0.2 studs; jaw opens and closes with period 0.26 s; body pitch `0.1`; tail sway |
| `drink` | 1.2 s | head pitch down `0.95`; jaw lapping with period 0.2 s; body pitch `0.14` |
| `sneak` | 0.64 s | **Not used in the Roblox slice** (stealing is cut), kept for later. Low walk: legs swing `0.45`, body 3% lower, head raised `0.2` while carrying the sock at `carry`, ears back `0.25` |
| `happy` | one-shot 1.3 s | three hops: body lift `0.35 x |sin(3π t / 1.3)| x envelope`; tail wag `0.5 x wave(t, 0.14)`; lids half down (happy squint); jaw open |
| `annoyed` | one-shot 1.0 s | head shake yaw `0.18 x wave(t, 0.16)`; ears flat back `0.7`; tail flick; lids half down (narrowed) |
| `surprise` | one-shot 0.8 s | jump `0.4` studs up in 0.3 s; body stretched; ears forward `-0.25`; tail up `0.9`; lids raised (wide eyes); jaw slightly open |
| `blink` | one-shot 0.17 s | lids go down and up over five steps: open, half, closed, half, open. The brain plays it at random times, every 2 to 5 seconds, never while asleep |

`envelope(t)`: ramps from 0 to 1 over the first 0.1 s, holds, and fades to 0 at the end.

Because `Transform` cannot scale, the main game's "squash and stretch" is replaced by small position changes and hops. Eyes use the lid Parts: lowering a lid (a position change around the eye) closes the eye. If the ferret looks too stiff without squash, you can also change a Part's `Size` directly on the client for a few Parts (cheap), but try the lid and offset approach first.

## 6. Moving around the room

The brain moves the whole model, not the joints:

```lua
-- FerretBrain walk step. UNTESTED.
-- ferretCF is the ferret's current CFrame on the floor, targetX is where it wants to go.
local SPEED_WALK = 2.0   -- studs per second (the main game: 55 px/s on a 360 px wide room)
local SPEED_RUN  = 6.2
local SPEED_SNEAK = 1.6
```

Each frame in `Heartbeat`: move the model toward the target by `speed x dt`, face it left or right with `CFrame.lookAt`, set the base animation to `walk` while moving, then `idle` or the chosen behavior on arrival. Keep the walkable area inside the room (for example `x` between -5 and 5 studs). To stand on the floor, `root` sits at floor height.

Keep a stable animation speed: scale the walk loop time by the ratio of actual speed to the nominal speed, so the feet do not slide too much.

## 7. The brain, simply

Eight behaviors, as in `03_GAME_DESIGN.md` section 3.4. Every 2 to 8 seconds (random) pick one, using integer weights:

```lua
-- UNTESTED. weights are plain numbers, bigger means more likely
local w = { idle = 30, wander = 25, sniff = 15, curious = 10, run = 5 }
w.sniff += (traits.curiosity - 50) // 4          -- curious pets sniff more
w.curious += (traits.curiosity - 50) // 5
w.run += (traits.mischief - 50) // 5
-- needs first: if hunger < 3000 then go to the food bowl and wait; if hydration < 3000 go to water
-- never pick the same behavior 3 times in a row
```

When the server says the pet is asleep (`sleepState == "asleep"`), walk to the hammock, climb (move up onto it), play `sleep`. When it wakes, walk back down.

When the player feeds the ferret, walk to `FoodBowl`, play `eat` for 4 seconds, then `happy`. Same for water. For petting, play `happy` when a pet session counts, otherwise a short `surprise` or head tilt on a quick tap.

## 8. Coats and cosmetics

- **Coats:** the four coats are color sets applied to the Parts by name, once, when the ferret is cloned. Colors from `docs/ART_STYLE.md` §5. For `sable`, body `#8A6244`, dark parts `#4A3626`. For `cinnamon`, body `#B9743C`, dark `#8A6244`. For `albino`, body `#F4EBDD`, ears and nose `#E59AA0`, eyes `#E59AA0`. For `panda`, body `#F4EBDD`, legs, mask, tail `#3E3A3F`.
- **The bow:** a small two-triangle Part group `Bow` welded to the head with a Motor6D or a `WeldConstraint`. Show it when `petEquipped` contains `"bow"`.
- **The sock:** a Part welded to `carry` when the behavior is sneak (cut in this slice, kept for later).

## 9. Optional later: import a Blender ferret

Only after the test shows people care. Roblox imports Blender work through its **3D Importer** and an **Animator** (custom rigs use an `AnimationController`). Official sources: the Roblox Creator Docs on importing and on custom rig animation. Known pitfalls from the developer forum: use FBX 7.4, keep the rig's bone names and axes identical between Blender and Studio, and import animations through the official Blender add-on rather than raw FBX. The animations you make in `animation/` would need the same names (`idle`, `walk`, ...) and a Roblox animation id per clip. If you use the LandyStudio model, add the credit in the in-game credits screen (CC BY 4.0, see `07_LAUNCH_AND_TESTING.md`). Building the ferret from your own Parts needs no credit.

## 10. Checklist for "alive" (the H2 test depends on this)

- [ ] Breathing is visible but small.
- [ ] Ears and tail never freeze for more than 3 seconds.
- [ ] It blinks at irregular times.
- [ ] Walk looks bouncy, not sliding.
- [ ] It reacts to a tap within 100 ms (a head turn is enough).
- [ ] Switching behavior never snaps (blend for 0.2 s).
- [ ] Sleep is nearly still.
- [ ] It does something unexpected every minute or so (a zoomie, a sniff of the camera).
