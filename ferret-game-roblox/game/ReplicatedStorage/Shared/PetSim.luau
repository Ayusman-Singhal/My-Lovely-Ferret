-- Pet simulation and care rules. Runs unchanged on the server (saving, commands) and on the client
-- (smooth display between server updates). Same inputs give the same result on every machine:
-- integer math only, and one Random per 10-minute step seeded from the pet id and the step time.
-- Rules: ferret-game-roblox/03_GAME_DESIGN.md section 3, copied from docs/GAME_DESIGN.md and src/core.

local Tuning = require(script.Parent.Tuning)

local PetSim = {}

-- ---------------------------------------------------------------- helpers

local function deepCopy(value)
	if type(value) ~= "table" then
		return value
	end
	local out = {}
	for k, v in value do
		out[k] = deepCopy(v)
	end
	return out
end
PetSim.deepCopy = deepCopy

-- Integer division that rounds toward zero (Luau's // rounds down, which is wrong for negatives).
local function idiv(a: number, b: number): number
	local q = a // b
	if q < 0 and q * b ~= a then
		q += 1
	end
	return q
end

local function clamp(x: number, lo: number, hi: number): number
	return math.max(lo, math.min(hi, x))
end

local function sign(x: number): number
	if x > 0 then
		return 1
	end
	if x < 0 then
		return -1
	end
	return 0
end

-- Small polynomial hash. Not FNV: its multiplier would leave the exact range of a double.
local function hashString(s: string): number
	local h = 5381
	for i = 1, #s do
		h = (h * 131 + string.byte(s, i)) % 4294967296 -- stays below 2^53, so the double math is exact
	end
	return h
end
PetSim.hashString = hashString

local function stepRng(petId: string, stepStart: number): Random
	return Random.new(hashString(petId .. "|" .. stepStart))
end

-- Local minute of the day (0 to 1439) in the owner's fixed time zone, never the device's.
function PetSim.localMinuteOfDay(t: number, tzOffsetMin: number): number
	return (t // 60 + tzOffsetMin) % 1440
end

-- "night" 22:00 to 06:59, "nap" 12:00 to 15:59, otherwise "day"
local function hourClass(minuteOfDay: number): string
	local hour = minuteOfDay // 60
	if hour >= 22 or hour < 7 then
		return "night"
	end
	if hour >= 12 and hour < 16 then
		return "nap"
	end
	return "day"
end
PetSim.hourClass = hourClass

-- "YYYY-MM-DD" in the owner's time zone (days to civil date, Howard Hinnant's algorithm).
function PetSim.localDate(t: number, tzOffsetMin: number): string
	local days = (t + tzOffsetMin * 60) // 86400
	local z = days + 719468
	local era = z // 146097
	local doe = z - era * 146097
	local yoe = (doe - doe // 1460 + doe // 36524 - doe // 146096) // 365
	local y = yoe + era * 400
	local doy = doe - (365 * yoe + yoe // 4 - yoe // 100)
	local mp = (5 * doy + 2) // 153
	local d = doy - (153 * mp + 2) // 5 + 1
	local m = if mp < 10 then mp + 3 else mp - 9
	if m <= 2 then
		y += 1
	end
	return string.format("%04d-%02d-%02d", y, m, d)
end

local function pickWeighted(rng: Random, list, weights)
	local total = 0
	for _, w in weights do
		total += w
	end
	local roll = rng:NextInteger(1, total)
	for i, w in weights do
		roll -= w
		if roll <= 0 then
			return list[i]
		end
	end
	return list[#list]
end

local function addEvent(pet, event)
	table.insert(pet.recent, 1, event) -- newest first
	while #pet.recent > Tuning.maxRecentEvents do
		table.remove(pet.recent)
	end
end

-- ---------------------------------------------------------------- creation

-- params: id, name (already filtered), ownerUserId, ownerName, now (unix seconds), tzOffsetMin
-- Traits, coat and favorites come from the pet id, drawn in a FIXED order. Never reorder the draws.
function PetSim.newPet(params)
	local rng = Random.new(hashString(params.id))
	local mischief = rng:NextInteger(5, 95)
	local curiosity = rng:NextInteger(5, 95)
	local affection = rng:NextInteger(5, 95)
	local coat = pickWeighted(rng, Tuning.coats, Tuning.coatWeights)
	local favoriteFood = Tuning.foods[rng:NextInteger(1, #Tuning.foods)]
	local favoriteToy = Tuning.toys[rng:NextInteger(1, #Tuning.toys)]
	local start = Tuning.newPet
	return {
		schemaVersion = 1,
		petId = params.id,
		name = params.name,
		ownerUserId = params.ownerUserId,
		ownerName = params.ownerName,
		caretakerUserId = nil,
		caretakerName = nil,
		createdAt = params.now,
		tzOffsetMin = params.tzOffsetMin,
		lastSimulationTime = params.now,
		hunger = start.hunger,
		hydration = start.hydration,
		energy = start.energy,
		happiness = start.happiness,
		bond = start.bond,
		sleepState = "awake",
		sleepStartedAt = nil,
		traits = { mischief = mischief, curiosity = curiosity, affection = affection },
		coat = coat,
		favoriteFood = favoriteFood,
		favoriteToy = favoriteToy,
		daily = { date = PetSim.localDate(params.now, params.tzOffsetMin), pet = 0, feed = 0, play = 0 },
		lastPlayRewardAt = 0,
		playStartedAt = 0, -- 0 means no round is running
		recent = {},
		petEquipped = {},
	}
end

-- ---------------------------------------------------------------- time passing

local function applyDelta(value: number, delta: number): number
	if delta < 0 then
		if value > Tuning.floor then
			return math.max(Tuning.floor, value + delta)
		end
		return value
	end
	return math.min(Tuning.needMax, value + delta)
end

local function driftHappiness(happiness, hunger, hydration, energy, bond): number
	local h = Tuning.happiness
	local needsAvg = idiv(hunger + hydration + energy, 3)
	local baseline = idiv(needsAvg * h.needsWeight + bond * h.bondWeight, 100)
	local gap = baseline - happiness
	local delta = idiv(gap, h.driftDivisor)
	if gap ~= 0 and delta == 0 then
		delta = sign(gap)
	end
	return clamp(happiness + delta, Tuning.floor, Tuning.needMax)
end

-- Returns a new record moved forward to `now`, and info { stepsRun, asleepSteps }.
-- The old record is never changed. Leftover seconds below one step stay as time before the next step.
function PetSim.simulate(old, now: number)
	local pet = deepCopy(old)
	local last = pet.lastSimulationTime
	if now <= last then
		return pet, { stepsRun = 0, asleepSteps = 0 } -- clock quirk or no time passed: nothing happens
	end
	local rawSteps = (now - last) // Tuning.stepSeconds
	if rawSteps == 0 then
		return pet, { stepsRun = 0, asleepSteps = 0 }
	end

	-- Cap at 30 days of activity: skip the oldest steps, keep the alignment and the end time.
	local stepsRun = math.min(rawSteps, Tuning.maxSteps)
	local startTime = last + (rawSteps - stepsRun) * Tuning.stepSeconds

	local tz = pet.tzOffsetMin
	local traits = pet.traits
	local hunger, hydration, energy, happiness = pet.hunger, pet.hydration, pet.energy, pet.happiness
	local sleepState, sleepStartedAt = pet.sleepState, pet.sleepStartedAt
	local bond = pet.bond
	local asleepSteps = 0
	local events = {}

	for i = 0, stepsRun - 1 do
		local t = startTime + i * Tuning.stepSeconds
		local rng = stepRng(pet.petId, t)
		local cls = hourClass(PetSim.localMinuteOfDay(t, tz))

		-- 1. Sleep transition
		if sleepState == "awake" then
			local sleeps = energy <= Tuning.sleep.forcedSleepEnergy
			if not sleeps then
				-- Curious pets stay up a little longer, affectionate pets settle a little sooner at night.
				local tilt = -idiv(traits.curiosity - 50, 10)
				if cls == "night" then
					tilt += idiv(traits.affection - 50, 10)
				end
				local pct = clamp(Tuning.sleep.fallAsleepPct[cls] + tilt, 0, 100)
				sleeps = rng:NextInteger(0, 99) < pct
			end
			if sleeps then
				sleepState = "asleep"
				sleepStartedAt = t
			end
		else
			-- Rules depend on the time class the sleep started in.
			local startClass = if sleepStartedAt then hourClass(PetSim.localMinuteOfDay(sleepStartedAt, tz)) else cls
			local restedEnough = energy >= Tuning.sleep.wakeEnergy[startClass]
			local longEnough = sleepStartedAt == nil or t - sleepStartedAt >= Tuning.sleep.minSleepSeconds[startClass]
			if restedEnough and longEnough and rng:NextInteger(0, 99) < Tuning.sleep.wakePct[cls] then
				sleepState = "awake"
				if sleepStartedAt and t - sleepStartedAt >= Tuning.sleep.longSleepSeconds then
					table.insert(events, { t = t, kind = "sleptLong", by = 0, byName = "", n = (t - sleepStartedAt) // 3600 })
				end
				sleepStartedAt = nil
			end
		end
		if sleepState == "asleep" then
			asleepSteps += 1
		end

		-- 2. Needs
		local rates = if sleepState == "asleep" then Tuning.asleep else Tuning.awake
		hunger = applyDelta(hunger, rates.hunger)
		hydration = applyDelta(hydration, rates.hydration)
		energy = applyDelta(energy, rates.energy)

		-- 3. Happiness
		happiness = driftHappiness(happiness, hunger, hydration, energy, bond)
	end

	pet.hunger, pet.hydration, pet.energy, pet.happiness = hunger, hydration, energy, happiness
	pet.sleepState, pet.sleepStartedAt = sleepState, sleepStartedAt
	pet.lastSimulationTime = last + rawSteps * Tuning.stepSeconds
	for _, event in events do
		addEvent(pet, event)
	end
	return pet, { stepsRun = stepsRun, asleepSteps = asleepSteps }
end

-- ---------------------------------------------------------------- actions

local function bondFor(pet, kind: string): number
	local table_ = Tuning.bond[kind]
	local gain = table_[math.min(pet.daily[kind] + 1, #table_)]
	pet.bond = clamp(pet.bond + gain, 0, Tuning.needMax)
	pet.daily[kind] += 1
	return gain
end

local function wake(pet)
	pet.sleepState = "awake"
	pet.sleepStartedAt = nil
end

local function refuse(reason: string)
	return { ok = false, reason = reason }
end

-- Apply one care action to `pet` at `now`. The pet must already be simulated to `now`.
-- It is changed in place only when the result has ok = true. Refusals change nothing.
-- cmd: { type = "feed", foodId } | { type = "water" } | { type = "pet", session = bool } |
--      { type = "startPlay" } | { type = "finishPlay", band } | { type = "sleep" }
-- actor: { userId = number, name = string }
-- Result: { ok = false, reason } or { ok = true, woke, reaction, stock, bondGain, rewarded }
function PetSim.apply(pet, cmd, now: number, actor)
	local today = PetSim.localDate(now, pet.tzOffsetMin)
	if pet.daily.date ~= today then
		pet.daily = { date = today, pet = 0, feed = 0, play = 0 }
	end
	local wasAsleep = pet.sleepState == "asleep"
	local result = { ok = true, woke = false, reaction = nil, stock = nil, bondGain = 0, rewarded = false }
	local function log(kind: string)
		addEvent(pet, { t = now, kind = kind, by = actor.userId, byName = actor.name })
	end

	if cmd.type == "feed" then
		if not table.find(Tuning.foods, cmd.foodId) then
			return refuse("invalid")
		end
		if pet.hunger >= Tuning.refuseAbove then
			return refuse("not_hungry")
		end
		local favorite = cmd.foodId == pet.favoriteFood
		if wasAsleep then
			wake(pet)
		end
		local f = Tuning.feed
		pet.hunger = math.min(Tuning.needMax, pet.hunger + (if favorite then f.favoriteAmount else f.amount))
		if favorite then
			pet.happiness = math.min(Tuning.needMax, pet.happiness + f.favoriteHappiness)
			result.reaction = "happy"
		end
		result.bondGain = bondFor(pet, "feed")
		result.woke, result.stock = wasAsleep, "food"
		log("fed")

	elseif cmd.type == "water" then
		if pet.hydration >= Tuning.refuseAbove then
			return refuse("not_thirsty")
		end
		if wasAsleep then
			wake(pet)
		end
		pet.hydration = math.min(Tuning.needMax, pet.hydration + Tuning.water.amount)
		result.woke, result.stock = wasAsleep, "water"
		log("watered")

	elseif cmd.type == "pet" then
		result.reaction = "happy"
		if wasAsleep then
			local grumpy = pet.energy < Tuning.tiredEnergy
			wake(pet)
			if grumpy then
				pet.happiness = math.max(Tuning.floor, pet.happiness - Tuning.tiredWakeCost)
			end
			result.reaction = if grumpy then "annoyed" else "surprise"
			result.woke = true
		end
		if cmd.session then
			pet.happiness = math.min(Tuning.needMax, pet.happiness + Tuning.petSessionHappiness)
			result.bondGain = bondFor(pet, "pet")
			log("petted")
		end

	elseif cmd.type == "startPlay" then
		if pet.energy < Tuning.minPlayEnergy then
			return refuse("too_tired")
		end
		if wasAsleep then
			wake(pet)
			result.woke = true
		end
		pet.playStartedAt = now

	elseif cmd.type == "finishPlay" then
		local started = pet.playStartedAt
		local elapsed = now - started
		if started == 0 or elapsed < Tuning.playMinSeconds or elapsed > Tuning.playMaxSeconds then
			if started ~= 0 and elapsed > Tuning.playMaxSeconds then
				pet.playStartedAt = 0 -- a stale round is forgotten
			end
			return refuse("no_play_started")
		end
		local band = clamp(math.floor(tonumber(cmd.band) or 0), 0, 3)
		local p = Tuning.play
		local rewarded = pet.lastPlayRewardAt == 0 or now - pet.lastPlayRewardAt >= p.rewardCooldownSeconds
		pet.playStartedAt = 0
		pet.energy = math.max(0, pet.energy - p.energyCost)
		if rewarded then
			pet.happiness = math.min(Tuning.needMax, pet.happiness + p.baseHappiness + band * p.perBand)
			pet.lastPlayRewardAt = now
			if band >= 1 then
				result.bondGain = bondFor(pet, "play")
			end
		end
		result.rewarded = rewarded
		result.band = band
		result.reaction = if band >= 2 then "happy" else nil
		log("played")

	elseif cmd.type == "sleep" then
		if wasAsleep then
			return result -- already asleep, nothing to do
		end
		if pet.energy >= Tuning.sleepRefuseEnergy then
			return refuse("not_sleepy")
		end
		pet.sleepState = "asleep"
		pet.sleepStartedAt = now
		log("slept")

	else
		return refuse("invalid")
	end

	return result
end

-- ---------------------------------------------------------------- display

-- Needs 0 to 100 for display (hundredths divided by 100, rounded down).
function PetSim.display(pet)
	return {
		hunger = pet.hunger // 100,
		hydration = pet.hydration // 100,
		energy = pet.energy // 100,
		happiness = pet.happiness // 100,
		bond = pet.bond // 100,
	}
end

-- "low", "okay" or "good". Always shown as a word, never by color alone.
function PetSim.band(value: number): string
	if value < Tuning.lowBelow then
		return "low"
	end
	if value >= Tuning.goodFrom then
		return "good"
	end
	return "okay"
end

-- Derived mood, first match wins (game design section 5): needy, sleepy, playful, happy, content.
function PetSim.mood(pet): string
	if pet.hunger < Tuning.lowBelow or pet.hydration < Tuning.lowBelow then
		return "needy"
	end
	if pet.energy < Tuning.lowBelow then
		return "sleepy"
	end
	if pet.happiness >= 7000 and pet.energy >= 6000 and pet.traits.mischief >= 60 then
		return "playful"
	end
	if pet.happiness >= 7500 then
		return "happy"
	end
	return "content"
end

return PetSim
