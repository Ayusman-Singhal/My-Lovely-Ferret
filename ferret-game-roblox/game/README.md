# Luau source copies

The game is built in Roblox Studio through the Roblox Studio MCP. **The Studio place is the source of truth.** The `.luau` files here are copies, saved so the code is in git and can be reviewed. The folder layout mirrors the Studio tree (`ReplicatedStorage/Shared/PetSim.luau` is `game.ReplicatedStorage.Shared.PetSim`). No Rojo.

Rules for the copies:

- Update a copy in the same commit as the change in Studio.
- Instances that are not scripts (the room, the ferret model, the UI, the remotes) live only in Studio.
- Numbers in `Tuning.luau` equal `03_GAME_DESIGN.md` section 3 and `docs/GAME_DESIGN.md`. Change them together.

Tests: `ServerStorage/Tests/SimTest.luau`. Run it with `require(game.ServerStorage.Tests.SimTest)()` in the Studio command bar. It returns `ALL PASS` first when every check passes.
