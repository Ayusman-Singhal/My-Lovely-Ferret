// Elapsed-time simulation (guide §7.2, docs/GAME_DESIGN.md §3). Pure and deterministic:
// the same record and the same `nowMs` give the same result on every device, because it
// uses only integer arithmetic and a seeded integer RNG. It never reads a clock.
//
// The pet advances in whole 10-minute steps. Each step has its own RNG, seeded from the
// pet id and the step start time (refinement R1), so running 1 hour and then 1 more hour
// gives exactly the same result as running 2 hours at once. The caretaker's predicted
// copy relies on that (guide §10.7).

import { NEED_MAX, clamp, idiv, sign } from './fixed';
import { createRng, simulationSeed } from './rng';
import { HOUR_MS, floorDiv, hourClass, localDate, localMinuteOfDay } from './time';
import { TUNING } from './tuning';
import type { HistoryEvent, PetRecord } from './types';

export interface SimResult {
  pet: PetRecord;
  /** Memorable events from this run, oldest first. Also appended to `pet.history`. */
  events: HistoryEvent[];
  /** Number of 10-minute steps actually simulated (at most 4320). */
  stepsRun: number;
  /** How many of those steps the pet spent asleep, for the welcome-back summary. */
  asleepSteps: number;
}

/** Daily found items and their base weights (docs/PET_BEHAVIOR.md §7). Odd items favor curious pets. */
export const FOUND_ITEMS = [
  { id: 'button', odd: false },
  { id: 'bottle_cap', odd: false },
  { id: 'hair_tie', odd: false },
  { id: 'paper_scrap', odd: false },
  { id: 'feather', odd: false },
  { id: 'foil_ball', odd: true },
  { id: 'single_earring', odd: true },
] as const;

/** Apply one step's change to a need. Decay stops at the floor, recovery stops at the max. */
export function applyDelta(value: number, delta: number): number {
  if (delta < 0) return value > TUNING.floor ? Math.max(TUNING.floor, value + delta) : value;
  return Math.min(NEED_MAX, value + delta);
}

/** Move happiness toward the baseline set by the other needs and bond (docs/GAME_DESIGN.md §3.2). */
export function driftHappiness(happiness: number, hunger: number, hydration: number, energy: number, bond: number): number {
  const h = TUNING.happiness;
  const needsAvg = idiv(hunger + hydration + energy, 3);
  const baseline = idiv(needsAvg * h.needsWeight + bond * h.bondWeight, 100);
  const gap = baseline - happiness;
  let delta = idiv(gap, h.driftDivisor);
  if (gap !== 0 && delta === 0) delta = sign(gap);
  return clamp(happiness + delta, TUNING.floor, NEED_MAX);
}

export interface SimulateOptions {
  /**
   * Autonomous steals during the simulated steps (default true). The app turns this off for
   * short gaps while it is open, because PetAI performs steals in front of the player then.
   */
  autonomousSteal?: boolean;
}

export function simulate(record: PetRecord, nowMs: number, options: SimulateOptions = {}): SimResult {
  const autonomousSteal = options.autonomousSteal ?? true;
  const last = record.timestamps.lastSimulationTime;

  // The clock went backward: no time passes, and the pet re-anchors to the new time (guide §7.3).
  if (nowMs < last) {
    return {
      pet: { ...record, timestamps: { ...record.timestamps, lastSimulationTime: nowMs } },
      events: [],
      stepsRun: 0,
      asleepSteps: 0,
    };
  }

  const rawSteps = floorDiv(nowMs - last, TUNING.stepMs);
  if (rawSteps === 0) return { pet: record, events: [], stepsRun: 0, asleepSteps: 0 };

  // Cap at 30 days of activity: skip the oldest steps, keep the alignment and the end time.
  const stepsRun = Math.min(rawSteps, TUNING.maxSteps);
  const startTime = last + (rawSteps - stepsRun) * TUNING.stepMs;

  const petId = record.pet.id;
  const { mischief, curiosity, affection } = record.personality;
  const tz = record.tzOffsetMin;
  const bond = record.state.bond;

  let { hunger, hydration, energy, happiness } = record.state;
  let { sleepState, sleepStartedAt, lastStoleAt, lastFoundDate } = record.state;
  const events: HistoryEvent[] = [];
  let asleepSteps = 0;

  for (let i = 0; i < stepsRun; i++) {
    const t = startTime + i * TUNING.stepMs;
    const rng = createRng(simulationSeed(petId, t));
    const cls = hourClass(localMinuteOfDay(t, tz));

    // 1. Sleep transition.
    if (sleepState === 'awake') {
      let sleeps = energy <= TUNING.sleep.forcedSleepEnergy;
      if (!sleeps) {
        // Curious pets stay up a little longer, affectionate pets settle a little sooner at night.
        const tilt = -idiv(curiosity - 50, 10) + (cls === 'night' ? idiv(affection - 50, 10) : 0);
        const pct = clamp(TUNING.sleep.fallAsleepPct[cls] + tilt, 0, 100);
        sleeps = rng.int(100) < pct;
      }
      if (sleeps) {
        sleepState = 'asleep';
        sleepStartedAt = t;
      }
    } else {
      // Rules depend on the time class the sleep started in. Hand-made states may have no
      // start time: then use the current class and no minimum length.
      const startClass = sleepStartedAt === null ? cls : hourClass(localMinuteOfDay(sleepStartedAt, tz));
      const restedEnough = energy >= TUNING.sleep.wakeEnergy[startClass];
      const longEnough = sleepStartedAt === null || t - sleepStartedAt >= TUNING.sleep.minSleepMs[startClass];
      if (restedEnough && longEnough && rng.int(100) < TUNING.sleep.wakePct[cls]) {
        sleepState = 'awake';
        if (sleepStartedAt !== null && t - sleepStartedAt >= TUNING.sleep.longSleepMs) {
          events.push({
            id: `PET_SLEPT_LONG-${t}`,
            t,
            type: 'PET_SLEPT_LONG',
            actor: 'pet',
            payload: { hours: floorDiv(t - sleepStartedAt, HOUR_MS) },
          });
        }
        sleepStartedAt = null;
      }
    }

    if (sleepState === 'asleep') asleepSteps++;

    // 2. Needs.
    const rates = sleepState === 'asleep' ? TUNING.asleep : TUNING.awake;
    hunger = applyDelta(hunger, rates.hunger);
    hydration = applyDelta(hydration, rates.hydration);
    energy = applyDelta(energy, rates.energy);

    // 3. Happiness.
    happiness = driftHappiness(happiness, hunger, hydration, energy, bond);

    // 4. Autonomous events, only while awake.
    if (sleepState === 'awake') {
      const date = localDate(t, tz);
      if (date !== lastFoundDate) {
        lastFoundDate = date;
        const oddWeight = 1 + idiv(curiosity, 25);
        const item = rng.pickWeighted(
          FOUND_ITEMS,
          FOUND_ITEMS.map((entry) => (entry.odd ? oddWeight : 3)),
        );
        events.push({ id: `PET_FOUND_ITEM-${t}`, t, type: 'PET_FOUND_ITEM', actor: 'pet', payload: { itemId: item.id } });
      }

      // Same rule as PetAI: only mischievous pets (docs/PET_BEHAVIOR.md §3), 12 hours apart.
      if (autonomousSteal && mischief >= 50 && (lastStoleAt === null || t - lastStoleAt >= TUNING.events.stealCooldownMs)) {
        if (rng.int(TUNING.events.stealDivisor) < mischief) {
          lastStoleAt = t;
          const itemId = rng.pick(['sock', record.state.favoriteToy] as const);
          events.push({ id: `PET_STOLE_ITEM-${t}`, t, type: 'PET_STOLE_ITEM', actor: 'pet', payload: { itemId } });
        }
      }
    }
  }

  const history = events.length === 0 ? record.history : [...record.history, ...events].slice(-TUNING.history.maxEvents);

  return {
    pet: {
      ...record,
      state: {
        ...record.state,
        hunger,
        hydration,
        energy,
        happiness,
        sleepState,
        sleepStartedAt,
        lastStoleAt,
        lastFoundDate,
        currentActivity: sleepState === 'asleep' ? 'sleep' : 'idle',
      },
      history,
      timestamps: { ...record.timestamps, lastSimulationTime: last + rawSteps * TUNING.stepMs },
    },
    events,
    stepsRun,
    asleepSteps,
  };
}
