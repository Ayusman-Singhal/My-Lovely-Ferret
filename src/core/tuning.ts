// Every tunable number of the Phase 1 simulation. Source of truth for the values is
// docs/GAME_DESIGN.md. Change both together. All needs values are hundredths (0..10000).

export const TUNING = {
  /** Simulation step, 10 minutes. */
  stepMs: 600_000,
  /** At most 30 days of simulated activity per run (guide §7.2). */
  maxSteps: 4320,
  /** Needs never fall below this from inactivity alone (guide §7.2). */
  floor: 1000,

  /** Change per step while awake (guide §7.2, rounded to integers). */
  awake: { hunger: -50, hydration: -67, energy: -67 },
  /** Change per step while asleep. */
  asleep: { hunger: -17, hydration: -25, energy: 167 },

  happiness: {
    /** Weight of the needs average and of bond in the baseline, out of 100. */
    needsWeight: 70,
    bondWeight: 30,
    /** Each step closes 1/divisor of the gap to the baseline. */
    driftDivisor: 12,
  },

  sleep: {
    /** Awake at or below this energy: falls asleep at once. */
    forcedSleepEnergy: 2000,
    /**
     * Asleep at or above this energy: may wake. Below it: keeps sleeping. By the time class the
     * sleep STARTED in: a night sleep restores a lot, a nap or daytime snooze only a little, so
     * naps stay short (a nap from 60% energy would otherwise last 2.5 hours or more).
     */
    wakeEnergy: { night: 8500, nap: 6500, day: 6500 },
    /** Percent chance per step to fall asleep while awake, by local time class. */
    fallAsleepPct: { night: 30, nap: 12, day: 1 },
    /**
     * A sleep cannot end before this long, by the time class it STARTED in. Stops a rested
     * pet from flickering awake and asleep every step (guide §7.2: long sleeps, short bursts).
     */
    minSleepMs: { night: 2 * 3_600_000, nap: 3_600_000, day: 1_800_000 },
    /** Percent chance per step to wake once rested enough, at or above wakeEnergy. */
    wakePct: { night: 15, nap: 40, day: 60 },
    /** Sleeps at least this long produce PET_SLEPT_LONG. */
    longSleepMs: 6 * 3_600_000,
  },

  events: {
    /** Autonomous steal: chance per awake step is mischief / stealDivisor (integer draw). */
    stealDivisor: 2000,
    stealCooldownMs: 12 * 3_600_000,
  },

  history: { maxEvents: 500 },
} as const;

export type Need = 'hunger' | 'hydration' | 'energy' | 'happiness';
