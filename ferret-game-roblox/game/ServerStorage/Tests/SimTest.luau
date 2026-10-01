-- Run from the Studio command bar or the MCP:  require(game.ServerStorage.Tests.SimTest)()
-- Checks PetSim against the numbers in 03_GAME_DESIGN.md and docs/GAME_DESIGN.md. Returns a list of lines.

local PetSim = require(game.ReplicatedStorage.Shared.PetSim)
local Tuning = require(game.ReplicatedStorage.Shared.Tuning)

local HOUR, DAY = 3600, 86400

return function()
	local out, failed = {}, 0
	local function check(name: string, ok: boolean, detail: any?)
		if not ok then
			failed += 1
		end
		table.insert(out, (if ok then "PASS " else "FAIL ") .. name .. (if detail ~= nil then ("  [" .. tostring(detail) .. "]") else ""))
	end

	-- 2026-01-15 09:00 UTC, owner at UTC+0, so the first hours are a "day" class
	local T0 = 1768467600
	local function make(i: number)
		return PetSim.newPet({ id = "pet-" .. i, name = "Mochi", ownerUserId = 1, ownerName = "Sam", now = T0, tzOffsetMin = 0 })
	end

	-- Calendar helper
	check("localDate 2026-01-15", PetSim.localDate(T0, 0) == "2026-01-15", PetSim.localDate(T0, 0))
	check("localDate with +330 min crosses midnight", PetSim.localDate(T0 + 15 * HOUR, 330) == "2026-01-16", PetSim.localDate(T0 + 15 * HOUR, 330))
	check("localDate negative offset", PetSim.localDate(T0, -600) == "2026-01-14", PetSim.localDate(T0, -600))
	check("localDate leap day", PetSim.localDate(1709164800, 0) == "2024-02-29", PetSim.localDate(1709164800, 0))

	-- 1 hour awake in the morning: hunger 7500 - 6 * 50 = 7200 for pets that do not nap by chance
	local exact, total = 0, 40
	for i = 1, total do
		local p = PetSim.simulate(make(i), T0 + HOUR)
		if p.hunger == 7200 and p.hydration == 8000 - 6 * 67 and p.energy == 8000 - 6 * 67 then
			exact += 1
		end
	end
	check("1 h awake: hunger 7200, hydration 7598, energy 7598 (almost every pet)", exact >= 34, exact .. "/" .. total)

	-- Determinism and chunking
	local a = PetSim.simulate(make(1), T0 + 30 * DAY)
	local b = PetSim.simulate(make(1), T0 + 30 * DAY)
	local same = true
	for k, v in a do
		if type(v) ~= "table" and b[k] ~= v then
			same = false
		end
	end
	check("deterministic: same pet, same time, same result", same)
	local chunked = PetSim.simulate(PetSim.simulate(make(2), T0 + 5 * HOUR), T0 + 11 * HOUR)
	local whole = PetSim.simulate(make(2), T0 + 11 * HOUR)
	check("chunked equals one-shot", chunked.hunger == whole.hunger and chunked.energy == whole.energy and chunked.happiness == whole.happiness and chunked.sleepState == whole.sleepState and chunked.lastSimulationTime == whole.lastSimulationTime)
	check("input record is never changed", (function()
		local p = make(3)
		PetSim.simulate(p, T0 + DAY)
		return p.hunger == 7500 and p.lastSimulationTime == T0
	end)())
	check("leftover seconds stay: 59 minutes = 5 steps", PetSim.simulate(make(4), T0 + 59 * 60).lastSimulationTime == T0 + 5 * 600)

	-- 30 days untouched: needs never below the floor, sleep share near 45%, a long-sleep memory exists
	local minNeed, asleepSum, steps, longSleeps = 1e9, 0, 0, 0
	local pets = 24
	for i = 1, pets do
		local p, info = PetSim.simulate(make(100 + i), T0 + 30 * DAY)
		minNeed = math.min(minNeed, p.hunger, p.hydration, p.energy, p.happiness)
		asleepSum += info.asleepSteps
		steps += info.stepsRun
		for _, e in p.recent do
			if e.kind == "sleptLong" then
				longSleeps += 1
			end
		end
	end
	local share = asleepSum * 100 // steps
	check("30 days: no need below the floor 1000", minNeed >= Tuning.floor, minNeed)
	check("30 days: sleep share between 35% and 55% (target about 45%)", share >= 35 and share <= 55, share .. "%")
	check("30 days: long sleeps are remembered", longSleeps > 0, longSleeps)
	check("run is capped at 30 days", (select(2, PetSim.simulate(make(5), T0 + 90 * DAY))).stepsRun == Tuning.maxSteps)

	-- Actions
	local actor = { userId = 1, name = "Sam" }
	local p = make(6)
	p.favoriteFood = "salmon"
	p.hunger = 9000
	check("feed refused at 9000", PetSim.apply(p, { type = "feed", foodId = "egg" }, T0, actor).reason == "not_hungry")
	p.hunger = 5000
	local r = PetSim.apply(p, { type = "feed", foodId = "egg" }, T0, actor)
	check("feed normal food +2500, bond +50", r.ok and p.hunger == 7500 and r.bondGain == 50 and p.bond == 1050, p.hunger)
	r = PetSim.apply(p, { type = "feed", foodId = "salmon" }, T0, actor)
	check("favorite food: hunger capped at 10000, happiness +500, bond +25 (second feed today)", r.ok and p.hunger == 10000 and p.happiness == 7500 and r.bondGain == 25 and r.reaction == "happy", p.hunger .. "/" .. p.happiness .. "/" .. r.bondGain)
	check("feed with a bad food id is refused", PetSim.apply(p, { type = "feed", foodId = "pizza" }, T0, actor).reason == "invalid")
	p = make(7)
	p.hydration = 9500
	check("water refused at 9500", PetSim.apply(p, { type = "water" }, T0, actor).reason == "not_thirsty")
	p.hydration = 4000
	PetSim.apply(p, { type = "water" }, T0, actor)
	check("water +3500", p.hydration == 7500)

	p = make(8)
	PetSim.apply(p, { type = "pet", session = true }, T0, actor)
	PetSim.apply(p, { type = "pet", session = true }, T0, actor)
	PetSim.apply(p, { type = "pet", session = true }, T0, actor)
	check("pet sessions: bond +100, +50, +0, happiness +300 each", p.bond == 1150 and p.happiness == 7900, p.bond .. "/" .. p.happiness)
	PetSim.apply(p, { type = "pet", session = true }, T0 + DAY, actor)
	check("daily bond counter resets on a new local date", p.bond == 1250, p.bond)

	p = make(9)
	p.sleepState, p.sleepStartedAt, p.energy = "asleep", T0, 4000
	r = PetSim.apply(p, { type = "pet", session = false }, T0, actor)
	check("tap on a tired sleeping pet: wakes, happiness -300, annoyed", p.sleepState == "awake" and p.happiness == 6700 and r.reaction == "annoyed")
	p.sleepState, p.energy = "asleep", 8000
	r = PetSim.apply(p, { type = "pet", session = false }, T0, actor)
	check("tap on a rested sleeping pet is free", p.happiness == 6700 and r.reaction == "surprise")
	p.sleepState, p.hunger = "asleep", 3000
	r = PetSim.apply(p, { type = "feed", foodId = "egg" }, T0, actor)
	check("feeding wakes a sleeping pet and applies in the same action", r.woke and p.sleepState == "awake" and p.hunger == 5500)

	p = make(10)
	p.energy = 9500
	check("sleep refused at 9500 energy", PetSim.apply(p, { type = "sleep" }, T0, actor).reason == "not_sleepy")
	p.energy = 5000
	PetSim.apply(p, { type = "sleep" }, T0, actor)
	check("sleep puts the pet to bed", p.sleepState == "asleep")

	p = make(11)
	check("finishPlay without startPlay refused", PetSim.apply(p, { type = "finishPlay", band = 3 }, T0, actor).reason == "no_play_started")
	p.energy = 1500
	check("startPlay refused when too tired", PetSim.apply(p, { type = "startPlay" }, T0, actor).reason == "too_tired")
	p.energy = 8000
	PetSim.apply(p, { type = "startPlay" }, T0, actor)
	check("finishPlay after 3 s is refused (too fast)", PetSim.apply(p, { type = "finishPlay", band = 3 }, T0 + 3, actor).reason == "no_play_started")
	r = PetSim.apply(p, { type = "finishPlay", band = 99 }, T0 + 20, actor)
	check("finishPlay clamps band to 3: energy -1500, happiness +1700, bond +150", r.ok and p.energy == 6500 and p.happiness == 8700 and p.bond == 1150 and r.band == 3, p.happiness)
	PetSim.apply(p, { type = "startPlay" }, T0 + 100, actor)
	r = PetSim.apply(p, { type = "finishPlay", band = 3 }, T0 + 120, actor)
	check("play reward only once per 30 minutes (energy cost still applies)", r.ok and not r.rewarded and p.happiness == 8700 and p.energy == 5000, p.energy)
	PetSim.apply(p, { type = "startPlay" }, T0 + 200, actor)
	check("a round older than 60 s is forgotten", PetSim.apply(p, { type = "finishPlay", band = 3 }, T0 + 300, actor).reason == "no_play_started" and p.playStartedAt == 0)

	p = make(12)
	PetSim.apply(p, { type = "feed", foodId = "egg" }, T0, { userId = 2, name = "Riya" })
	check("events remember who cared", p.recent[1].kind == "fed" and p.recent[1].by == 2 and p.recent[1].byName == "Riya")
	for _ = 1, 40 do
		PetSim.apply(p, { type = "water" }, T0, actor)
		p.hydration = 1000
	end
	check("recent events are capped at 30", #p.recent == Tuning.maxRecentEvents, #p.recent)

	table.insert(out, 1, (if failed == 0 then "ALL PASS" else (failed .. " FAILED")))
	return out
end
