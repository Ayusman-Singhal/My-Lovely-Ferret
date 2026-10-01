--!strict
-- Every tunable number of the pet simulation. Source of truth: ferret-game-roblox/03_GAME_DESIGN.md
-- section 3, which copies docs/GAME_DESIGN.md. Change them together. Needs are hundredths (0 to 10000).
-- Times are unix seconds (the main game uses milliseconds, so every value here is the same number / 1000).

local HOUR = 3600

return {
	stepSeconds = 600, -- one simulation step, 10 minutes
	maxSteps = 4320, -- at most 30 days per run
	floor = 1000, -- needs never fall below this from time passing alone
	needMax = 10000,

	awake = { hunger = -50, hydration = -67, energy = -67 },
	asleep = { hunger = -17, hydration = -25, energy = 167 },

	happiness = { needsWeight = 70, bondWeight = 30, driftDivisor = 12 },

	sleep = {
		forcedSleepEnergy = 2000,
		wakeEnergy = { night = 8500, nap = 6500, day = 6500 },
		fallAsleepPct = { night = 30, nap = 12, day = 1 },
		minSleepSeconds = { night = 2 * HOUR, nap = HOUR, day = 1800 },
		wakePct = { night = 15, nap = 40, day = 60 },
		longSleepSeconds = 6 * HOUR, -- a sleep this long is remembered for the welcome-back screen
	},

	newPet = { hunger = 7500, hydration = 8000, energy = 8000, happiness = 7000, bond = 1000 },

	-- Actions (03_GAME_DESIGN.md 3.3)
	refuseAbove = 9000, -- feed and water are refused at or above this
	feed = { amount = 2500, favoriteAmount = 3500, favoriteHappiness = 500 },
	water = { amount = 3500 },
	petSessionHappiness = 300,
	tiredWakeCost = 300, -- waking a truly tired pet (energy below tiredEnergy) costs this much happiness
	tiredEnergy = 5000,
	minPlayEnergy = 2000,
	play = { energyCost = 1500, baseHappiness = 500, perBand = 400, rewardCooldownSeconds = 30 * 60 },
	playMinSeconds = 10, -- FinishPlay is accepted only between these (04_TECH_PLAN.md 6)
	playMaxSeconds = 60,
	sleepRefuseEnergy = 9000, -- Sleep is refused at or above this energy

	-- Bond gained per action type per owner-local day: first, second, third and later (4.1 of the game design)
	bond = { pet = { 100, 50, 0 }, feed = { 50, 25, 0 }, play = { 150, 75, 0 } },

	-- Mood bands for display words (04_TECH_PLAN.md 5)
	lowBelow = 3000,
	goodFrom = 7000,

	maxRecentEvents = 30,

	coats = { "sable", "cinnamon", "panda", "albino" },
	coatWeights = { 40, 25, 20, 15 },
	foods = { "chicken", "egg", "salmon", "kibble" },
	toys = { "ball", "sock", "feather", "ring" },

	maxNameLength = 16,
}
