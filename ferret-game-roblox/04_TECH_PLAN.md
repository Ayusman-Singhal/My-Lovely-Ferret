# Tech plan

How the game works under the hood. Written so a beginner can follow it, and so the code in `05_BUILD_GUIDE.md` has a clear target. **All Luau snippets in this file are untested.** No Roblox runtime was available when this was written. Treat them as a skeleton, run them in Studio, and fix what the Output window tells you.

## 1. The big idea

```text
            ┌────────────────────────── DataStore ───────────────────────────┐
            │  Pet_<petId>   one record per pet, shared by owner and helper   │
            │  Player_<userId>  which pet you own, which pet you help with    │
            └───────────────▲─────────────────────────────▲───────────────────┘
                            │ UpdateAsync (atomic)        │
                    ┌───────┴────────┐            ┌───────┴────────┐
                    │ Server (owner) │            │ Server (helper)│   may be the same server or two
                    └───────▲────────┘            └───────▲────────┘
                            │ RemoteEvent                 │ RemoteEvent
                    ┌───────┴────────┐            ┌───────┴────────┐
                    │ Owner's client │            │ Helper's client│   draw the room, ferret, UI
                    └────────────────┘            └────────────────┘
```

- **Server decides, client draws.** The server holds the rules and the saving. The client draws the room and the ferret and sends requests ("feed Mochi").
- **One shared record per pet.** Both people change the same record. `DataStore:UpdateAsync` reads, lets our function change it, and writes, and Roblox makes sure two changes at the same moment do not overwrite each other (it retries our function with the newest data). So two people at once, on two servers, cannot corrupt the pet.
- **Time passing is a function.** `simulate(pet, now)` moves the pet forward in 10-minute steps. Every command first simulates to now, then applies the action. The same function runs on the client to show the pet smoothly between server updates. Same inputs, same result.

## 2. Data model

JSON-friendly tables only (strings, numbers, booleans, arrays, dictionaries with string keys).

### 2.1 Pet record: key `Pet_<petId>`, store `Pets_v1`

```lua
type PetRecord = {
  schemaVersion: number,            -- 1
  petId: string,                    -- random id made at adoption (HttpService:GenerateGUID(false))
  name: string,                     -- raw name as typed, filtered again on display (section 7)
  ownerUserId: number,
  caretakerUserId: number?,         -- nil when not shared
  caretakerName: string?,           -- display name when linked, for "Riya fed Mochi"
  ownerName: string,
  createdAt: number,                -- unix seconds
  tzOffsetMin: number,              -- owner's UTC offset in minutes, set once (section 5)
  lastSimulationTime: number,       -- unix seconds, always a multiple of 600 from createdAt
  hunger: number, hydration: number, energy: number, happiness: number, bond: number,  -- hundredths
  sleepState: string,               -- "awake" | "asleep"
  sleepStartedAt: number?,
  traits: { mischief: number, curiosity: number, affection: number },
  coat: string,                     -- "sable" | "cinnamon" | "panda" | "albino"
  favoriteFood: string, favoriteToy: string,
  daily: { date: string, pet: number, feed: number, play: number },  -- bond counters for the owner's local date
  lastPlayRewardAt: number,
  recent: { { t: number, kind: string, by: number, byName: string } },  -- newest first, at most 30
  petEquipped: { string },          -- e.g. {"bow"}
}
```

`recent` events: `fed`, `watered`, `petted`, `played`, `slept` (put to bed), `joined` (helper linked), `left`. This feeds the welcome-back screen and the partner-care toast. Each event carries who did it.

Size: well under 5 KB. The 4 MB per-key limit is not close.

### 2.2 Player record: key `Player_<userId>`, store `Players_v1`

```lua
type PlayerRecord = {
  schemaVersion: number,
  ownedPetId: string?,
  careForPetId: string?,            -- the friend's pet this player helps with
  lastSeen: number,                 -- unix seconds, to decide "welcome back"
  lastSummaryAt: number,            -- when the welcome-back summary was last shown
  stats: { [string]: number },      -- tester counters: sessions, days, care_* counts (data for 01_VALIDATION_PLAN.md)
  daysPlayed: { string },           -- list of "YYYY-MM-DD" (UTC), at most 60
}
```

### 2.3 Invite code: MemoryStore hash map `Invites`, key = the code

```lua
-- value: { petId = "...", ownerUserId = 123 }, expires after 24 hours (86400 seconds)
```

Codes are 6 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0, O, 1, I, L). Generated with `Random.new()`. A code is deleted when used. MemoryStore entries disappear by themselves after the expiration, which is exactly what we want.

## 3. Folder layout in Studio

Put each script in the place Roblox expects. Names are suggestions.

```text
ReplicatedStorage
  Shared
    PetSim            (ModuleScript)  simulate(), tuning numbers, helpers. Runs on server AND client
    Tuning            (ModuleScript)  the numbers from 03_GAME_DESIGN.md
    Strings           (ModuleScript)  every text shown to players
  Remotes             (Folder)
    Command           (RemoteFunction)  client asks the server to do something, gets a result
    PetChanged        (RemoteEvent)     server tells the client a pet record changed
    Toast             (RemoteEvent)     server tells the client to show a message
  Assets
    Room              (Model)           the cozy room, cloned by each client
    Ferret            (Model)           the blocky ferret, cloned by each client
ServerScriptService
  Main                (Script)          wires everything, handles player join and leave
  PetService          (ModuleScript)    load, save, apply commands with UpdateAsync
  InviteService       (ModuleScript)    codes, linking, unlinking
  Analytics           (ModuleScript)    LogCustomEvent and counters
  Shop                (ModuleScript)    developer product, ProcessReceipt
StarterPlayer
  StarterPlayerScripts
    Client            (LocalScript)     builds the room and ferret locally, runs the brain
    FerretBrain       (ModuleScript)    behaviors, walking
    FerretRig         (ModuleScript)    pose and joint driver (06_FERRET_RIG_AND_ANIMATION.md)
StarterGui
  Ui                  (ScreenGui)       all screens
```

**The room and the ferret live only on each player's own client.** The Client script clones `Assets.Room` and `Assets.Ferret` into the Workspace locally and places the camera. Other players never see your room, so two people on one server do not collide. The server never needs to move or animate the ferret, which removes a large amount of network and physics work.

For the camera: set `Camera.CameraType = Enum.CameraType.Scriptable` and put it at a fixed spot looking at the room. Turn off character spawning by unticking `CharacterAutoLoads` in the Properties of the `Players` service in the Explorer, so no avatar appears.

## 4. Server logic

### 4.1 Loading a player

```lua
-- Main (Script). UNTESTED skeleton.
local Players = game:GetService("Players")
local PetService = require(script.Parent.PetService)

-- Also untick Players > CharacterAutoLoads in Studio's Explorer (Players service Properties).
-- No avatars: we use a fixed camera. Setting it in a script can be too late for the first player.

Players.PlayerAdded:Connect(function(player)
  PetService.onJoin(player)         -- loads Player_<id>, then the owned pet and the helped pet
end)

Players.PlayerRemoving:Connect(function(player)
  PetService.onLeave(player)        -- saves counters, lastSeen
end)

game:BindToClose(function()
  PetService.flushAll()             -- finish pending saves, there are a few seconds at shutdown
end)
```

### 4.2 The command pattern with UpdateAsync

Every action (feed, water, pet, play finish, bed, adopt) goes through one function. The pattern, in short:

```lua
-- PetService.applyCommand. UNTESTED skeleton.
local DataStoreService = game:GetService("DataStoreService")
local Pets = DataStoreService:GetDataStore("Pets_v1")
local PetSim = require(game.ReplicatedStorage.Shared.PetSim)

function PetService.applyCommand(player, petId, command)
  local now = os.time()
  local ok, result = pcall(function()
    return Pets:UpdateAsync("Pet_" .. petId, function(old)
      if old == nil then return nil end                       -- unknown pet, change nothing
      if player.UserId ~= old.ownerUserId and player.UserId ~= old.caretakerUserId then
        return nil                                            -- not allowed, change nothing
      end
      local pet = PetSim.simulate(old, now)                   -- catch up to now first
      local refusal = PetSim.apply(pet, command, now, player) -- changes pet, returns nil or a reason
      if refusal then return nil end
      return pet
    end)
  end)
  -- UpdateAsync returns the new value. If we returned nil from the function it keeps the old value.
  return ok, result
end
```

Important rules for the function you give `UpdateAsync`:

- It must **not wait** (no `task.wait`, no other DataStore calls). It may run more than once if there is a conflict, so it must have no side effects outside the table it returns.
- Returning `nil` cancels the write.
- Capture the refusal reason outside (for example set a local variable), so the client can show "Mochi is not hungry".

### 4.3 Time

`os.time()` gives unix seconds in UTC. All timestamps are unix seconds. Never use the client's time for anything the server decides. If `now` is smaller than `lastSimulationTime` (a clock quirk), treat elapsed time as 0.

### 4.4 Limits and cost

- **Writes only on actions**, not on a timer. A player makes a handful of actions per session.
- **Reads:** a player loads their pet(s) once on join, and the client asks the server for a refresh about every 20 seconds while a **helped** pet is on screen (so the owner's care shows up quickly). `GetAsync` results are cached for a few seconds on one server.
- Budget per minute is `300 + users x 40` reads and `300 + users x 20` writes (`02_ROBLOX_FACTS.md`). With 20 players each doing 3 reads per minute and 2 writes per minute, usage is about 60 reads and 40 writes, far below 1,100 and 700. The test has lots of room.
- If a DataStore request fails, retry up to 3 times with a short wait, then tell the player "Saving is slow, please try again". Never lose the in-memory pet.

## 5. The simulation module (`PetSim`)

Same rules as `docs/GAME_DESIGN.md` §3. Implementation notes:

- All needs are **integers in hundredths**. Use integer math. For divisions, use floor division `//` for positive values, and a helper `trunc` for values that can be negative:

```lua
local function trunc(x: number): number
  if x >= 0 then return math.floor(x) else return -math.floor(-x) end
end
```

- **Randomness:** inside `simulate`, one `Random.new(seed)` per 10-minute step, where `seed` comes from the pet id and the step start time. Two servers simulating the same pet over the same interval get the same result. A simple seed: hash the string `petId .. "|" .. stepStart` with a small polynomial hash (not FNV: its multiplier would overflow the exact range of a double):

```lua
local function hashString(s: string): number
  local h = 5381
  for i = 1, #s do
    h = (h * 131 + string.byte(s, i)) % 4294967296   -- stays below 2^53 (2^32 x 131), so the double math is exact
  end
  return h
end
-- Random.new(hashString(petId .. "|" .. stepStart)) then rng:NextInteger(1, 100) <= chance
```

- **Steps:** `steps = (now - lastSimulationTime) // 600`, capped at 4320 (30 days). `lastSimulationTime` moves forward by exactly `steps * 600`. The leftover seconds are not lost, they stay as time before the next step.
- **Per step, in order:** sleep transition, then need change (awake or asleep rates), then happiness drift, then floors at 1000.
- **Time of day:** the owner's local time. The owner's UTC offset is captured once, when the pet is created. The client computes it and sends it:

```lua
-- Client. UNTESTED. DateTime is a Roblox type, ToLocalTime uses the device time zone.
local now = DateTime.now()
local l, u = now:ToLocalTime(), now:ToUniversalTime()
local offset = (l.Hour * 60 + l.Minute) - (u.Hour * 60 + u.Minute)
if offset > 840 then offset -= 1440 elseif offset < -840 then offset += 1440 end
```

  The server clamps it to -840 to 840 and stores it as `tzOffsetMin`. Local minute of day is `((t // 60 + tzOffsetMin) % 1440)`. (Luau's `%` is a floor modulo, so it is safe for negative numbers.) Do not use `os.date`, it reports UTC on Roblox.
- **Mood and the display bands:** Low under 3000, Okay 3000 to 6999, Good 7000 or more. Words, not only bars.

Write the module with the functions `PetSim.new(seedInfo)`, `PetSim.simulate(pet, now)`, `PetSim.apply(pet, command, now, player)`, and `PetSim.display(pet)` (needs divided by 100, rounded down). Keep it free of Roblox services except `Random`, so it runs unchanged in both places.

## 6. Security and fairness

The client is never trusted.

| Threat | Defense |
|---|---|
| A player sends commands for someone else's pet | Server checks `UserId` equals `ownerUserId` or `caretakerUserId` inside `UpdateAsync` |
| A player spams commands | Server rate limit: at most 2 commands per second per player, ignore the rest |
| A player sends fake mini-game scores | Server issues a play token on `StartPlay` (a random string and a start time) and accepts `FinishPlay(band, token)` only if the token exists, is at most 60 seconds old, and at least 10 seconds have passed. The band is clamped to 0 to 3. The reward still has a 30-minute cooldown |
| A player sends a number as a "need value" | There is no such command. The client only names an action |
| Invite code guessing | Codes are 6 characters from 31 symbols (about 887 million combinations), single use, expire in 24 hours, and the server allows 5 wrong tries per player per minute |
| Two codes for the same pet | Creating a new code replaces the old one |
| A helper cannot be removed | Owner `Stop sharing` and helper `Leave` both go through the server and write `caretakerUserId = nil` |
| Offensive pet name | Roblox text filter, section 7 |

## 7. Names and text

Every string a player types that others can see must go through Roblox's filter.

```lua
-- UNTESTED
local TextService = game:GetService("TextService")
local function filterName(raw: string, fromUserId: number): string?
  if #raw < 1 or utf8.len(raw) == nil or utf8.len(raw) > 16 then return nil end
  local ok, result = pcall(function()
    return TextService:FilterStringAsync(raw, fromUserId, Enum.TextFilterContext.PublicChat)
  end)
  if not ok then return nil end
  local ok2, shown = pcall(function() return result:GetNonChatStringForBroadcastAsync() end)
  if not ok2 then return nil end
  return shown
end
```

Store the filtered name that Roblox returned. If filtering fails, ask the player to try again. Never save a name that has not been filtered. Check the current docs before you rely on this (`02_ROBLOX_FACTS.md` section 4).

## 8. The client

The `Client` LocalScript does this on start:

1. Asks the server for the player's pet(s) (RemoteFunction `Command`, action `load`).
2. Clones `Assets.Room` and `Assets.Ferret` into the Workspace, sets the camera.
3. Starts the ferret brain (`FerretBrain`) which picks behaviors by the same weights as the main game, and the rig driver (`FerretRig`, see `06_FERRET_RIG_AND_ANIMATION.md`) which moves the joints each frame.
4. Runs `PetSim.simulate(petCopy, os.time())` about once a minute to keep the displayed needs fresh. It does not save anything.
5. Listens for `PetChanged` (the server sends the new record after any change by either person) and for `Toast`.
6. Sends actions through `Command:InvokeServer(...)`, shows the result (done or the refusal reason).

**Render cost:** use `RunService.RenderStepped` or `Heartbeat` only while something is moving. When the ferret is asleep, update the pose about 10 times per second.

## 9. The helper's view

A helper has `careForPetId`. On join, the server loads that pet record, simulates it to now, and sends it. On the client the helper's home shows the friend's ferret with the label "Sam's Mochi". Every 20 seconds while this view is open, the client calls `Command:InvokeServer("refresh", petId)` and the server answers with the latest record (one `GetAsync`). If the owner changed something, the toast "Sam fed Mochi 1 minute ago" appears once.

Optional later: `MessagingService` to push a refresh instantly. Not needed for the test, 20 seconds is fine.

## 10. Analytics

`Analytics.log(player, "care_feed", 1, { role = "owner" })` calls `AnalyticsService:LogCustomEvent` inside a `pcall`, and also increments `stats["care_feed"]` in the player's record. The list of events is in `01_VALIDATION_PLAN.md`. The in-DataStore counters let you read results with a tiny admin script in Studio even if the dashboard is slow (`07_LAUNCH_AND_TESTING.md`).

## 11. Versions and migration

`schemaVersion = 1` on both records. When you change the shape later, add `if record.schemaVersion < 2 then ... end` in a `migrate` function on load, and never delete fields in the same release you start using the new ones. Keep a copy of the old data when you change it (`Pets_v1` stays, write to `Pets_v2`) while you are testing with real people.

## 12. Why not roblox-ts or the main game's code

The main game's `src/core` is TypeScript with a custom RNG that uses `Math.imul` and a build setup that bans many browser and `Math` features. roblox-ts compiles TypeScript to Luau, but it adds a build step and you would debug generated Luau as a beginner, and the simulation is only a few hundred lines. We copy the **numbers and rules** (kept in `docs/GAME_DESIGN.md`) and write Luau by hand. If the Roblox version becomes a real product later, revisit this.

## 13. Optional: Rojo and git

By default you edit scripts inside Studio and Roblox saves the place in the cloud. If you want git history and to edit in VS Code:

1. Install Rojo (the Studio plugin and the command-line tool).
2. Make `ferret-game-roblox/game/default.project.json` that maps folders on disk to the Studio folders in section 3.
3. Run `rojo serve`, click Connect in Studio. Scripts then live as `.lua` files in git.

Skip this until the game works. It is a convenience, not part of the test.

## 14. Test plan for the code

| What | How |
|---|---|
| `PetSim` numbers | A small test script in Studio (a Script in ServerScriptService, run in Play mode) that simulates 1 hour, 1 day, and 30 days and prints the needs, comparing with `docs/GAME_DESIGN.md`: for a pet that stays awake for one hour, hunger 7500 - 6 x 50 = 7200; after 24 hours sleep share near 45% |
| Same result on two machines | Run the same simulation twice with the same seed, compare the printed values |
| Commands | Studio Test tab, **Clients and Servers**, 2 players: owner feeds, helper feeds, both see the same numbers |
| Offline care | Owner leaves, helper feeds, owner rejoins and sees the event in welcome-back |
| Save | Stop the test, start again, the pet is still there. Check in the Output window |
