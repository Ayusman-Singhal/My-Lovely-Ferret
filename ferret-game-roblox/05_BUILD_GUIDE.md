# Build guide

For a complete beginner. Part 0 teaches the Roblox Studio basics you need. Then eleven milestones (M0 to M10), each small enough to finish in one sitting and each ending with something you can see working. Do them in order. Stop and test at the end of each one.

Companion files: what to build is in `03_GAME_DESIGN.md`, how it works is in `04_TECH_PLAN.md`, the ferret itself is in `06_FERRET_RIG_AND_ANIMATION.md`. Luau code in these docs is **untested** skeleton code. Run it, read the Output window, and fix it. If you get stuck, copy the exact error text from the Output window and ask Claude.

Estimates are for a beginner. Total about 30 to 45 hours.

## Part 0: Roblox Studio basics (read once, about 1 hour)

### 0.1 Install and open

1. Make a Roblox account at roblox.com (if you do not have one). Use a real email and verify it.
2. Go to create.roblox.com, press **Start Creating**, and install **Roblox Studio**. Sign in.
3. In Studio choose **New**, then the **Baseplate** template. You see a gray plate in a 3D view.

### 0.2 The windows

Open them from the **View** tab if they are missing: **Explorer** (a tree of everything in your game), **Properties** (settings for the selected thing), **Output** (messages and errors from your code), **Toolbox** (free assets, not needed).

### 0.3 Moving in the 3D view

Hold the **right mouse button** and use **WASD** to fly. Scroll to zoom. Click a part to select it. On the **Home** tab use **Move**, **Scale**, **Rotate** to change it. **Ctrl+Z** undoes. Turn on snapping (the magnet icons) so things line up.

### 0.4 Parts

A **Part** is a block. Home tab, **Part**, **Block**. In Properties set **Size** (X, Y, Z in studs), **Color**, **Material**, and **Anchored** (tick it so it does not fall). The ferret and the room are made of Parts. A **Model** is a group of Parts: select several, press **Ctrl+G**.

### 0.5 Scripts: three kinds

| Kind | Runs where | Use it for | Where to put it |
|---|---|---|---|
| **Script** | The server (Roblox's computer) | Rules, saving, anything players must not cheat | `ServerScriptService` |
| **LocalScript** | One player's device | Drawing, animation, buttons | `StarterPlayer > StarterPlayerScripts`, or inside a ScreenGui |
| **ModuleScript** | Wherever it is `require`d | Shared code and data | `ReplicatedStorage` (both sides) or `ServerStorage` (server only) |

To add one: in the Explorer, hover over a service (for example `ServerScriptService`), press the **+** button, pick the kind. Double click to open it.

### 0.6 Your first script

In `ServerScriptService` add a **Script**. Replace its contents with:

```lua
print("Hello from the server")
```

Press **Play** (F5) on the Home tab. Open the **Output** window. You should see the message. Press Stop.

### 0.7 Luau in ten lines

```lua
-- a comment
local name = "Mochi"                 -- local variable
local hunger = 7500                  -- number
local isAsleep = false               -- boolean
local traits = { curiosity = 60 }    -- table with named fields
local list = { "a", "b", "c" }       -- table as a list. Lists start at 1, not 0
if hunger < 3000 then print("low") elseif hunger < 7000 then print("ok") else print("good") end
for i = 1, 3 do print(i) end         -- loop 1, 2, 3
local function feed(amount) hunger = math.min(10000, hunger + amount) end
feed(2500); print(hunger)            -- prints 10000
```

Useful: `math.floor`, `math.min`, `math.max`, `//` (floor division), `%` (remainder), `#list` (length), `table.insert(list, x)`, `string.format("%d", n)`, `task.wait(seconds)`, `pcall(function() ... end)` (run something that might fail).

### 0.8 Testing with more than one player

Studio **Test** tab, **Clients and Servers**: set **Players** to 2 and press **Start**. Studio opens a server window and two client windows, like two real players. You need this from M6 onward.

### 0.9 Saving your work

**File > Save to Roblox** saves your place in the cloud. **File > Publish to Roblox** creates the experience on your account. Do this at M0 and save often. Roblox keeps old versions: **File > Game Settings** and the Creator Hub (create.roblox.com/dashboard) show version history.

### 0.10 When something breaks

1. Read the **Output** window. Red text is an error with a script name and line number. Double click it to jump to the line.
2. Add `print(...)` lines to see values.
3. Search the error text at create.roblox.com/docs and devforum.roblox.com.
4. Ask Claude with the exact error text and the code.

## M0: Accounts and project (about 1 hour)

Goal: an empty published place, ready for DataStore.

1. Do the **age check** (Roblox account settings, Verify age: face estimate or ID) and turn on **2-step verification** (Settings, Security). Both are needed to publish for 16+ (`02_ROBLOX_FACTS.md`).
2. In Studio: new Baseplate. **File > Publish to Roblox**. Name: "Ferret Test". Leave it **Private**.
3. **File > Game Settings > Security**: turn on **Enable Studio Access to API Services**. (The experience has to be published first.)
4. In the **Players** service Properties (Explorer), untick **CharacterAutoLoads** (we use no avatar).
5. Create the folders from `04_TECH_PLAN.md` section 3 (Folder objects named `Shared`, `Remotes`, `Assets` under `ReplicatedStorage`). Add the empty scripts and modules with the same names so you can fill them later.

Done when: the place is published as Private, the folders exist, Play runs and prints "Hello from the server".

## M1: Constants and the simulation module (about 4 hours)

Goal: the pet's numbers change correctly with time, proven by a printed test. No visuals yet.

1. In `ReplicatedStorage.Shared.Tuning` write a table with every number from `03_GAME_DESIGN.md` section 3: rates, floor 1000, step 600 seconds, max steps 4320, sleep classes, action effects, bond tables.
2. In `PetSim` write `newPet(...)` and `simulate(pet, now)` as described in `04_TECH_PLAN.md` section 5. Return a **new table** (copy the old one first), so the function has no side effects.
3. Write a test Script in `ServerScriptService` called `SimTest` that:
   - makes a pet created at time `T0`,
   - simulates 1 hour, 1 day, and 30 days and prints the needs,
   - runs the 30-day simulation twice and checks both results are equal.
4. Compare with `docs/GAME_DESIGN.md` §3: a pet that stays awake for one hour has hunger 7200. Over 30 days all needs stay at or above 1000. Sleep share over a month is near 45%.

Done when: `SimTest` prints sensible numbers and "deterministic: true".

## M2: The blocky ferret (about 4 to 7 hours)

Goal: a ferret standing in the empty world, with its joints. Follow `06_FERRET_RIG_AND_ANIMATION.md` sections 1 to 3. **Path A** (recommended): export the Blender model as separate meshes and import it, about 5 to 7 hours the first time. **Path B**: build it from Parts, about 3 to 4 hours. Before importing, read the cost line in the importer (section 2A.7 of that file). If it asks for Robux, use Path B.

Done when: you can see a ferret model named `Ferret` in the Workspace with a body, head, ears, tail, four legs, and the joints in place, and the nod test from section 3 moves the head, ears, eyes and jaw together.

## M3: Making it move (about 5 hours)

Goal: idle breathing, tail sway, ear twitch, blink, and a walk, driven by code. Follow `06_FERRET_RIG_AND_ANIMATION.md` sections 4 to 6.

Done when: a LocalScript plays idle and walk and the ferret looks alive for a full minute without looking broken. Show it to someone. If they smile, go on. If not, polish here. This is the most important milestone for H2.

## M4: The room and the camera (about 3 hours)

Goal: a cozy room, a fixed camera, the ferret in it.

1. Build the room from a few Parts: floor, back wall, side walls, a window. Colors from `docs/ART_STYLE.md` §3 (cream `#F6ECDC`, wall `#EBD3B5`, floor `#C9A07A`, floor shade `#A9805C`). Size about 24 by 16 studs so the ferret (about 4 studs long) fills the view.
2. Add a food bowl, a water bowl, a hammock (a flat Part on two posts), and a toy ball. Name them `FoodBowl`, `WaterBowl`, `Hammock`, `Ball`.
3. Group the room as a Model named `Room`, anchor all parts, and move it to `ReplicatedStorage.Assets`. Move `Ferret` there too.
4. In `Client` (LocalScript): clone `Room` and `Ferret` into `Workspace`, set `Camera.CameraType = Enum.CameraType.Scriptable`, set `Camera.CFrame` to look at the room from the front and slightly above. Use `CFrame.lookAt(position, target)`.
5. Lighting: in the **Lighting** service set a warm `Ambient`, and `Brightness` so nothing is dark. No shadows needed.

Done when: pressing Play shows the room and the ferret from a fixed camera, on a phone-shaped window (Test tab, **Device**, pick a phone).

## M5: Pet logic, commands, and the HUD (about 7 hours)

Goal: feed, water, pet, put to bed, with the needs bar, in memory only (no saving yet).

1. `PetService`: keep each player's pet in a table. Write `applyCommand` without DataStore: simulate to now, apply the action using the rules in `03_GAME_DESIGN.md` section 3.3, return the new pet or a refusal text.
2. Create the Remotes: `Command` (RemoteFunction) and `PetChanged` (RemoteEvent). In `Main`, connect `Command.OnServerInvoke` to a function that checks the player, rate-limits, and calls `PetService.applyCommand`.
3. UI in `StarterGui > Ui` (ScreenGui): a top **needs bar** with four rows (icon, label, number, word Low/Okay/Good, and a bar), a bottom **action bar** with four large buttons: Feed, Water, Play, Sleep. Buttons at least 44 by 44 pixels (use `Scale`-based sizes with `UISizeConstraint`).
4. `Client`: on button press call `Command:InvokeServer("feed", petId)`. Show the result: on refusal a short message ("Mochi is not hungry"). On success make the ferret react: walk to the food bowl and eat, or drink, or sleep in the hammock. The brain in `06_FERRET_RIG_AND_ANIMATION.md` section 7 has the simple version.
5. Add `FerretBrain`: idle, wander, sniff, curious, run, picked by simple weights (`03_GAME_DESIGN.md` section 3.4).
6. A developer-only command `debug_skip(hours)` that moves the pet's `lastSimulationTime` back. The server accepts it only when `RunService:IsStudio()` is true or the user id is yours. You will use it a lot to test being away.

Done when: you can feed, water, pet, and sleep the ferret, the bars move correctly, refusals work, and `debug_skip(8)` makes the needs drop as expected.

## M6: Saving and being away (about 4 hours)

Goal: close the game, open it, and the ferret has lived on.

1. Add the DataStore code from `04_TECH_PLAN.md` section 4.2 to `PetService`. `onJoin` loads or creates the player record and the pet. Every command now goes through `UpdateAsync`.
2. Adoption: on the Title screen, **Adopt a ferret** opens the Name screen. The server filters the name (section 7 of the tech plan), creates the pet from a seed, saves it, and returns it.
3. Welcome back: on join, if more than 30 minutes have passed since `lastSeen`, show the summary screen. Use the `recent` events list and the sleep hours computed during simulation.
4. Test: play, feed, **stop** the test, start it again: the pet must be there. Use `debug_skip(10)` before stopping to check the long-absence case.

Done when: the pet survives restarts, and the summary reads warmly with no mention of how long you were away.

## M7: Sharing with one other person (about 6 hours)

Goal: two real accounts care for one pet.

1. `InviteService`: `createCode(player)` makes a 6-character code, stores it in the MemoryStore hash map with a 24-hour expiry, and returns it. `redeem(player, code)` checks it, writes `caretakerUserId` and `caretakerName` on the pet inside `UpdateAsync`, sets `careForPetId` on the helper, deletes the code, and records a `joined` event. `unlink(player)` for both **Stop sharing** and **Leave**.
2. UI: **Share care** screen (code, status, Stop sharing) and **Join** screen (type the code, plain error messages).
3. The helper's home shows the friend's pet with the label "Sam's Mochi". Add the 20-second refresh loop (`04_TECH_PLAN.md` section 9) and the **partner-care toast**.
4. Make the welcome-back summary put the partner's care first.
5. Test with Studio **Clients and Servers**, 2 players: Player 1 adopts and creates a code, Player 2 joins with it, both feed, both see the same numbers within 20 seconds. Then test **offline**: Player 1 leaves, Player 2 feeds, Player 1 rejoins and sees "Player 2 fed Mochi".

Done when: all of that works with two accounts, including the case where one is offline.

## M8: The toy-chase mini-game (about 3 hours)

Goal: a short, charming play game. Cut this first if you are out of time.

1. Play button: server issues a token (`04_TECH_PLAN.md` section 6) and the client starts a 20-second round.
2. Round: the player taps the floor, a ball lands there (a Part appears), the ferret runs to it and pounces. Count catches by the rules in `03_GAME_DESIGN.md` section 3.5. Show a catch counter and a timer (numbers, not only a bar).
3. At the end the client sends the band and the token. The server checks and applies the result. The ferret does a happy reaction.

Done when: one round feels fun for 20 seconds and the rewards apply once per 30 minutes.

## M9: Wardrobe test, analytics, feedback (about 3 hours)

Goal: the measurements from `01_VALIDATION_PLAN.md`.

1. `Analytics` module: `log(player, event, value, fields)` calls `AnalyticsService:LogCustomEvent` inside `pcall` and increments counters in `stats`. Call it from every place listed in the validation plan.
2. Wardrobe screen with three items (`03_GAME_DESIGN.md` section 6). In the Creator Hub (create.roblox.com/dashboard) open your experience, **Monetization**, **Developer Products**, create "Red bow" at 25 Robux. In `Shop`, call `MarketplaceService:PromptProductPurchase(player, productId)` and set `MarketplaceService.ProcessReceipt` to grant the bow (record it in the pet's `petEquipped`) and return `Enum.ProductPurchaseDecision.PurchaseGranted`. Read the docs on receipts first: a wrong receipt handler can take a player's Robux without delivering.
3. Hat and scarf: show "Coming soon, thanks for telling us!" and log `shop_click`.
4. Feedback screen: three quick 1 to 5 questions stored in the player's `stats`, a text box, and the Google Form link as selectable text.
5. **About my pet** screen with the counters.

Done when: you can see the events in your own record and in the Creator Hub analytics (allow some hours for the dashboard).

## M10: Publish for testers (about 2 hours)

Goal: one friend plays on their own computer.

1. Follow `07_LAUNCH_AND_TESTING.md` section 2 (access, age checks, maturity questionnaire).
2. Add yourself and one friend to the playtesters, or make the game public for 16+ and Trusted Friends.
3. Send them the link. Watch them play (screen share). Do not explain. Write down where they stop, hesitate, or smile.
4. Fix only crashes and data loss. Then begin the schedule in `01_VALIDATION_PLAN.md`.

Done when: a person who has never seen it adopts a ferret and a second person joins with a code, without your help.

## Cut-scope order

If time is short, drop in this order: mini-game (M8), shop test (M9 step 2 and 3), welcome-back summary polish, sleep animation polish. Do **not** drop M3 (the ferret has to feel alive), M6 (saving), or M7 (sharing).

## Common pitfalls

| Symptom | Likely cause |
|---|---|
| `DataStore request was added to queue` or errors 301 to 306 | Too many requests. Add a short wait and fewer reads. Never call DataStore in a tight loop |
| `Studio access to API services is not enabled` | M0 step 3 |
| Script does nothing | It is in the wrong place (a LocalScript inside `ServerScriptService` never runs) |
| Parts fall apart or fall | Not anchored, or joints missing. Anchor the root part only, the rest are joined by Motor6D |
| Ferret animates in Studio but not for the second player | Animation code runs on the client of each player, check the LocalScript is in `StarterPlayerScripts` |
| `attempt to index nil` | Something you expected is missing, print it before using it |
| The pet resets every test | You are creating a new pet each time, load first and only create when nothing is saved |
| Two clients see different numbers | One of them is not refreshing, or you skipped the simulate-to-now step before showing |
| The name is rejected | Filtering failed or the name is too long. Log the reason and show a clear message |
