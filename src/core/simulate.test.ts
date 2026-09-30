import { describe, expect, it } from 'vitest';
import { FOUND_ITEMS, applyDelta, driftHappiness, simulate } from './simulate';
import { TUNING } from './tuning';
import { localDate } from './time';
import { DAY, HOUR, STEP, T0, T_NIGHT, makePet } from './testkit';
import type { PetRecord } from './types';

const FLOOR = TUNING.floor;

function inRange(pet: PetRecord): void {
  for (const key of ['hunger', 'hydration', 'energy', 'happiness', 'bond'] as const) {
    const v = pet.state[key];
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeLessThanOrEqual(10000);
    expect(v).toBeGreaterThanOrEqual(0);
  }
  for (const key of ['hunger', 'hydration', 'energy', 'happiness'] as const) {
    expect(pet.state[key]).toBeGreaterThanOrEqual(FLOOR);
  }
}

describe('applyDelta', () => {
  it('decays down to the floor and no lower', () => {
    expect(applyDelta(5000, -50)).toBe(4950);
    expect(applyDelta(FLOOR + 10, -50)).toBe(FLOOR);
    expect(applyDelta(FLOOR, -50)).toBe(FLOOR);
  });

  it('does not lift a value that is already below the floor', () => {
    expect(applyDelta(500, -50)).toBe(500);
  });

  it('recovers up to the max and no higher', () => {
    expect(applyDelta(5000, 167)).toBe(5167);
    expect(applyDelta(9900, 167)).toBe(10000);
    expect(applyDelta(10000, 167)).toBe(10000);
  });
});

describe('driftHappiness', () => {
  it('moves toward the baseline and stops there', () => {
    // needsAvg 10000, bond 10000 -> baseline 10000
    let h = 2000;
    for (let i = 0; i < 400; i++) {
      const next = driftHappiness(h, 10000, 10000, 10000, 10000);
      expect(next).toBeGreaterThanOrEqual(h);
      h = next;
    }
    expect(h).toBe(10000);
  });

  it('moves down toward a low baseline but never below the floor', () => {
    let h = 9000;
    for (let i = 0; i < 400; i++) h = driftHappiness(h, FLOOR, FLOOR, FLOOR, 0);
    expect(h).toBe(FLOOR);
  });

  it('always makes progress when the gap is small (at least 1 per step)', () => {
    // baseline = (5000*70 + 5000*30)/100 = 5000
    expect(driftHappiness(4990, 5000, 5000, 5000, 5000)).toBe(4991);
    expect(driftHappiness(5010, 5000, 5000, 5000, 5000)).toBe(5009);
    expect(driftHappiness(5000, 5000, 5000, 5000, 5000)).toBe(5000);
  });

  it('closes about one twelfth of the gap per step', () => {
    // baseline 10000, happiness 4000 -> gap 6000 -> delta 500
    expect(driftHappiness(4000, 10000, 10000, 10000, 10000)).toBe(4500);
  });
});

describe('simulate: time handling', () => {
  it('does nothing before one full step has passed', () => {
    const pet = makePet();
    const result = simulate(pet, T0 + STEP - 1);
    expect(result.stepsRun).toBe(0);
    expect(result.events).toEqual([]);
    expect(result.pet).toBe(pet);
  });

  it('advances lastSimulationTime by whole steps and keeps the remainder', () => {
    const pet = makePet();
    const result = simulate(pet, T0 + 2 * STEP + 123_456);
    expect(result.stepsRun).toBe(2);
    expect(result.pet.timestamps.lastSimulationTime).toBe(T0 + 2 * STEP);
  });

  it('treats negative elapsed time as no time passed and re-anchors', () => {
    const pet = makePet();
    const result = simulate(pet, T0 - 5 * DAY);
    expect(result.stepsRun).toBe(0);
    expect(result.events).toEqual([]);
    expect(result.pet.state).toEqual(pet.state);
    expect(result.pet.timestamps.lastSimulationTime).toBe(T0 - 5 * DAY);
  });

  it('caps a huge absence at 30 days of simulated steps but ends at the true time', () => {
    const pet = makePet();
    const away = 400 * DAY;
    const result = simulate(pet, T0 + away);
    expect(result.stepsRun).toBe(TUNING.maxSteps);
    expect(result.pet.timestamps.lastSimulationTime).toBe(T0 + away);
    inRange(result.pet);
  });

  it('the cap bounds the work: 60 days and 3000 days both run exactly 4320 steps', () => {
    const pet = makePet();
    const a = simulate(pet, T0 + 60 * DAY);
    const b = simulate(pet, T0 + 3000 * DAY);
    expect(a.stepsRun).toBe(TUNING.maxSteps);
    expect(b.stepsRun).toBe(TUNING.maxSteps);
  });
});

describe('simulate: needs', () => {
  it('six awake steps (one hour) of decay add up exactly, in hundredths', () => {
    let hunger = 7500;
    let hydration = 8000;
    let energy = 8000;
    for (let i = 0; i < 6; i++) {
      hunger = applyDelta(hunger, TUNING.awake.hunger);
      hydration = applyDelta(hydration, TUNING.awake.hydration);
      energy = applyDelta(energy, TUNING.awake.energy);
    }
    expect({ hunger, hydration, energy }).toEqual({ hunger: 7200, hydration: 7598, energy: 7598 });
  });

  it('one hour: needs move the right way and stay in range', () => {
    const pet = makePet();
    const { pet: after } = simulate(pet, T0 + HOUR);
    inRange(after);
    expect(after.state.hunger).toBeLessThan(pet.state.hunger);
    expect(after.state.hydration).toBeLessThan(pet.state.hydration);
  });

  it('a sleeping pet recovers energy at the asleep rate, exactly, until it may wake', () => {
    const pet = makePet({ state: { sleepState: 'asleep', sleepStartedAt: T0, energy: 2000 } });
    const { pet: after, stepsRun } = simulate(pet, T0 + 18 * STEP); // 3 hours
    expect(stepsRun).toBe(18);
    expect(after.state.sleepState).toBe('asleep');
    expect(after.state.energy).toBe(2000 + 18 * TUNING.asleep.energy);
    expect(after.state.hunger).toBe(7500 - 18 * -TUNING.asleep.hunger);
    expect(after.state.hydration).toBe(8000 - 18 * -TUNING.asleep.hydration);
    expect(after.state.sleepStartedAt).toBe(T0);
    expect(after.state.currentActivity).toBe('sleep');
  });

  it('a pet at or below the forced-sleep energy falls asleep at once, at any hour', () => {
    const pet = makePet({ state: { energy: TUNING.sleep.forcedSleepEnergy } }); // 09:00, day class
    const { pet: after } = simulate(pet, T0 + STEP);
    expect(after.state.sleepState).toBe('asleep');
    expect(after.state.sleepStartedAt).toBe(T0);
  });

  it('a sleep cannot end before its minimum length, even at full energy', () => {
    // Fell asleep at 09:00 (day class, minimum 30 minutes) and is already fully rested.
    const pet = makePet({ state: { sleepState: 'asleep', sleepStartedAt: T0, energy: 10000 } });
    const early = simulate(pet, T0 + 2 * STEP); // 20 minutes in
    expect(early.pet.state.sleepState).toBe('asleep');
    // Night sleeps have a 2 hour minimum.
    const night = makePet({ nowMs: T_NIGHT, state: { sleepState: 'asleep', sleepStartedAt: T_NIGHT, energy: 10000 } });
    expect(simulate(night, T_NIGHT + 11 * STEP).pet.state.sleepState).toBe('asleep'); // 1h50m in
  });

  it('a rested sleeper past its minimum wakes within a few hours (day class)', () => {
    const pet = makePet({ state: { sleepState: 'asleep', sleepStartedAt: T0 - HOUR, energy: 10000 } });
    const { pet: after } = simulate(pet, T0 + 4 * HOUR);
    expect(after.state.sleepState).toBe('awake');
    expect(after.state.sleepStartedAt).toBeNull();
  });

  it('a sleeper below the wake energy keeps sleeping, however long it has slept', () => {
    const pet = makePet({ state: { sleepState: 'asleep', sleepStartedAt: T0 - 20 * HOUR, energy: 1000 } });
    const { pet: after } = simulate(pet, T0 + 5 * STEP);
    expect(after.state.sleepState).toBe('asleep');
  });

  it('the energy needed to wake depends on the class the sleep started in', () => {
    // Same energy (7000, between the nap threshold 6500 and the night threshold 8500).
    // A night sleep at 02:00 has not restored enough, so it keeps sleeping.
    const nightSleeper = makePet({
      nowMs: T_NIGHT + 4 * HOUR,
      state: { sleepState: 'asleep', sleepStartedAt: T_NIGHT + 30 * 60_000, energy: 7000 },
    });
    const nightAfter = simulate(nightSleeper, T_NIGHT + 4 * HOUR + 5 * STEP);
    expect(nightAfter.pet.state.sleepState).toBe('asleep');
    // A daytime snooze at the same energy is rested enough, and wakes within a few hours.
    const daySleeper = makePet({ state: { sleepState: 'asleep', sleepStartedAt: T0 - HOUR, energy: 7000 } });
    expect(simulate(daySleeper, T0 + 3 * HOUR).pet.state.sleepState).toBe('awake');
  });

  it('30 days untouched: hunger and hydration sit exactly on the floor, nothing dies', () => {
    const { pet: after } = simulate(makePet(), T0 + 30 * DAY);
    inRange(after);
    expect(after.state.hunger).toBe(FLOOR);
    expect(after.state.hydration).toBe(FLOOR);
    expect(after.state.bond).toBe(1000); // bond never decays
  });

  it('never breaks the range or the floor at any point over 30 days', () => {
    let pet = makePet({ id: 'range-check' });
    for (let day = 1; day <= 30; day++) {
      pet = simulate(pet, T0 + day * DAY).pet;
      inRange(pet);
    }
  });
});

describe('simulate: sleep pattern', () => {
  it('sleeps through the night in one long block, starting from 22:00 with low energy', () => {
    let pet = makePet({ nowMs: T_NIGHT, state: { energy: 4000 } });
    let asleepSteps = 0;
    let firstAsleep = -1;
    for (let i = 1; i <= 54; i++) {
      // 22:00 to 07:00 in single steps (also exercises chunked runs).
      pet = simulate(pet, T_NIGHT + i * STEP).pet;
      if (pet.state.sleepState === 'asleep') {
        asleepSteps++;
        if (firstAsleep === -1) firstAsleep = i;
      }
      inRange(pet);
    }
    expect(firstAsleep).toBeGreaterThan(0);
    expect(firstAsleep).toBeLessThanOrEqual(12); // falls asleep within the first two hours
    expect(asleepSteps * 10).toBeGreaterThanOrEqual(4 * 60); // at least 4 hours asleep
  });

  it('a long night sleep is reported once, with its length, when the pet wakes', () => {
    const pet = makePet({ nowMs: T_NIGHT, state: { energy: 3000 }, id: 'sleeper' });
    const { events } = simulate(pet, T_NIGHT + 14 * HOUR);
    const slept = events.filter((e) => e.type === 'PET_SLEPT_LONG');
    for (const e of slept) {
      expect(Number(e.payload['hours'])).toBeGreaterThanOrEqual(6);
      expect(e.actor).toBe('pet');
    }
    expect(slept.length).toBeLessThanOrEqual(1);
  });

  it('over 30 days there are long sleeps, and each is 6 hours or more', () => {
    let total = 0;
    for (const id of ['long-1', 'long-2', 'long-3', 'long-4', 'long-5']) {
      const { events } = simulate(makePet({ id }), T0 + 30 * DAY);
      const slept = events.filter((e) => e.type === 'PET_SLEPT_LONG');
      total += slept.length;
      for (const e of slept) expect(Number(e.payload['hours'])).toBeGreaterThanOrEqual(6);
    }
    expect(total).toBeGreaterThanOrEqual(5);
  });

  // The sleep rules must feel like a ferret without becoming a time sink (guide §7.2,
  // docs/GAME_DESIGN.md §3.3): long night blocks with short bursts (not flicker), one midday
  // nap, and a pet that is awake when a player is likely to open the app. Measured on
  // 2026-09-30 over 24 pets: 45% asleep overall (39% to 52%), evening about 7% asleep.
  it('sleeps like a ferret but stays available: night blocks, a midday nap, awake mornings and evenings', () => {
    const days = 30;
    const windows = {
      night: { from: 23, to: 6, steps: 0, asleep: 0 }, // wraps midnight
      morning: { from: 9, to: 12, steps: 0, asleep: 0 },
      nap: { from: 12, to: 16, steps: 0, asleep: 0 },
      evening: { from: 17, to: 22, steps: 0, asleep: 0 },
    };
    let transitions = 0;
    let asleepSteps = 0;
    const ids = ['avail-1', 'avail-2', 'avail-3', 'avail-4', 'avail-5', 'avail-6', 'avail-7', 'avail-8'];
    for (const id of ids) {
      let pet = makePet({ id });
      let prev = pet.state.sleepState;
      for (let i = 1; i <= days * 144; i++) {
        const t = T0 + i * STEP;
        pet = simulate(pet, t).pet;
        const asleep = pet.state.sleepState === 'asleep';
        if (pet.state.sleepState !== prev) transitions++;
        prev = pet.state.sleepState;
        if (asleep) asleepSteps++;
        const hour = Math.floor((t % DAY) / HOUR); // tz offset is 0
        for (const w of Object.values(windows)) {
          const inside = w.from < w.to ? hour >= w.from && hour < w.to : hour >= w.from || hour < w.to;
          if (inside) {
            w.steps++;
            if (asleep) w.asleep++;
          }
        }
      }
    }
    const share = (w: { steps: number; asleep: number }) => w.asleep / w.steps;
    const blocksPerDay = transitions / 2 / (days * ids.length); // one block = two transitions

    expect(blocksPerDay).toBeLessThan(9); // no flicker
    const overall = asleepSteps / (days * 144 * ids.length);
    expect(overall).toBeGreaterThan(0.35); // not so little that the pet feels lifeless
    expect(overall).toBeLessThan(0.55); // not so much that players wait on it
    expect(share(windows.night)).toBeGreaterThan(0.75);
    expect(share(windows.morning)).toBeLessThan(0.15);
    expect(share(windows.nap)).toBeGreaterThan(0.2);
    expect(share(windows.nap)).toBeLessThan(0.65);
    expect(share(windows.evening)).toBeLessThan(0.12);
  });

  it('uses the owner offset, not the device zone: same instant, different offset, different local class', () => {
    // 2026-10-01 17:00 UTC. With +330 it is 22:30 local (night). With 0 it is 17:00 (day).
    const t = Date.UTC(2026, 9, 1, 17, 0, 0);
    const india = makePet({ nowMs: t, tzOffsetMin: 330, state: { energy: 6000 } });
    const utc = makePet({ nowMs: t, tzOffsetMin: 0, state: { energy: 6000 } });
    let indiaAsleep = 0;
    let utcAsleep = 0;
    for (let i = 0; i < 40; i++) {
      // Different pet ids so the comparison is not one coin flip.
      const a = simulate({ ...india, pet: { ...india.pet, id: `tz-${i}` } }, t + 3 * STEP);
      const b = simulate({ ...utc, pet: { ...utc.pet, id: `tz-${i}` } }, t + 3 * STEP);
      if (a.pet.state.sleepState === 'asleep') indiaAsleep++;
      if (b.pet.state.sleepState === 'asleep') utcAsleep++;
    }
    expect(indiaAsleep).toBeGreaterThan(utcAsleep + 10);
  });
});

describe('simulate: determinism and chunking', () => {
  it('same input gives identical output, run twice', () => {
    const pet = makePet({ id: 'determinism' });
    const a = simulate(pet, T0 + 9 * DAY);
    const b = simulate(pet, T0 + 9 * DAY);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('does not mutate its input', () => {
    const pet = makePet({ id: 'immutable' });
    const before = JSON.stringify(pet);
    simulate(pet, T0 + 5 * DAY);
    expect(JSON.stringify(pet)).toBe(before);
  });

  it('is chunk-invariant: two runs equal one run over the same span', () => {
    for (const id of ['chunk-a', 'chunk-b', 'chunk-c']) {
      const pet = makePet({ id, personality: { mischief: 90 } });
      const oneShot = simulate(pet, T0 + 5 * DAY + 7 * HOUR);
      const first = simulate(pet, T0 + 2 * DAY + 3 * HOUR);
      const second = simulate(first.pet, T0 + 5 * DAY + 7 * HOUR);
      expect(JSON.stringify(second.pet)).toBe(JSON.stringify(oneShot.pet));
      expect([...first.events, ...second.events]).toEqual(oneShot.events);
    }
  });

  it('is chunk-invariant for one-step chunks over two days', () => {
    const pet = makePet({ id: 'tiny-chunks', personality: { mischief: 95 } });
    const oneShot = simulate(pet, T0 + 2 * DAY);
    let stepped = pet;
    for (let i = 1; i <= 288; i++) stepped = simulate(stepped, T0 + i * STEP).pet;
    expect(JSON.stringify(stepped)).toBe(JSON.stringify(oneShot.pet));
  });

  // Regression pin over the whole pipeline. If this fails after a tuning change, that is
  // expected: update the numbers together with docs/GAME_DESIGN.md. If it fails with no
  // tuning change, something made the simulation non-deterministic or changed the draw order.
  it('pins a 7-day result for a fixed pet (pinned)', () => {
    const { pet } = simulate(makePet({ id: 'pin-me' }), T0 + 7 * DAY);
    expect({
      needs: [pet.state.hunger, pet.state.hydration, pet.state.energy, pet.state.happiness],
      sleep: pet.state.sleepState,
      history: pet.history.map((e) => `${e.type}@${e.t - T0}`),
    }).toMatchInlineSnapshot(`
      {
        "history": [
          "PET_ADOPTED@0",
          "PET_FOUND_ITEM@56400000",
          "PET_FOUND_ITEM@144000000",
          "PET_STOLE_ITEM@207000000",
          "PET_FOUND_ITEM@229200000",
          "PET_STOLE_ITEM@261600000",
          "PET_FOUND_ITEM@313200000",
          "PET_STOLE_ITEM@376800000",
          "PET_FOUND_ITEM@414600000",
          "PET_STOLE_ITEM@460800000",
          "PET_FOUND_ITEM@489600000",
          "PET_STOLE_ITEM@531600000",
          "PET_FOUND_ITEM@577200000",
        ],
        "needs": [
          1000,
          1000,
          9263,
          3026,
        ],
        "sleep": "awake",
      }
    `);
  });
});

describe('simulate: memorable events', () => {
  it('finds at most one item per owner-local date, never on the adoption date', () => {
    const pet = makePet({ id: 'finder', tzOffsetMin: 330 });
    const { events } = simulate(pet, T0 + 20 * DAY);
    const found = events.filter((e) => e.type === 'PET_FOUND_ITEM');
    const dates = found.map((e) => localDate(e.t, 330));
    expect(new Set(dates).size).toBe(dates.length);
    expect(dates).not.toContain(localDate(T0, 330));
    expect(found.length).toBeGreaterThanOrEqual(18); // an awake step exists on almost every date
    for (const e of found) {
      expect(FOUND_ITEMS.map((f) => f.id)).toContain(e.payload['itemId']);
    }
  });

  it('a high-mischief pet steals, at most once per 12 hours; a low-mischief pet steals far less', () => {
    const high = simulate(makePet({ id: 'thief', personality: { mischief: 100 } }), T0 + 30 * DAY).events.filter(
      (e) => e.type === 'PET_STOLE_ITEM',
    );
    const low = simulate(makePet({ id: 'thief', personality: { mischief: 5 } }), T0 + 30 * DAY).events.filter(
      (e) => e.type === 'PET_STOLE_ITEM',
    );
    expect(high.length).toBeGreaterThan(10);
    expect(high.length).toBeGreaterThan(low.length * 3);
    for (let i = 1; i < high.length; i++) {
      expect((high[i] as { t: number }).t - (high[i - 1] as { t: number }).t).toBeGreaterThanOrEqual(
        TUNING.events.stealCooldownMs,
      );
    }
    for (const e of high) expect(['sock', 'ball', 'feather', 'ring']).toContain(e.payload['itemId']);
  });

  it('events are oldest first, unique, and appended to history', () => {
    const pet = makePet({ id: 'ordered', personality: { mischief: 90 } });
    const { pet: after, events } = simulate(pet, T0 + 10 * DAY);
    for (let i = 1; i < events.length; i++) {
      expect((events[i] as { t: number }).t).toBeGreaterThanOrEqual((events[i - 1] as { t: number }).t);
    }
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
    expect(after.history.slice(1)).toEqual(events); // slot 0 is PET_ADOPTED
  });

  it('caps history at 500 events, keeping the newest', () => {
    const many = Array.from({ length: 499 }, (_, i) => ({
      id: `old-${i}`,
      t: T0 - 1000 + i,
      type: 'PET_FED',
      actor: 'owner' as const,
      payload: {},
    }));
    const pet = { ...makePet({ id: 'capped', personality: { mischief: 100 } }), history: many };
    const { pet: after, events } = simulate(pet, T0 + 30 * DAY);
    expect(events.length).toBeGreaterThan(2);
    expect(after.history).toHaveLength(TUNING.history.maxEvents);
    expect(after.history[after.history.length - 1]).toEqual(events[events.length - 1]);
  });

  it('a sleeping pet does not steal or find items', () => {
    // Asleep at 09:00 with low energy: sleeps for a few hours with no events at all.
    const pet = makePet({
      id: 'quiet',
      personality: { mischief: 100 },
      state: { sleepState: 'asleep', sleepStartedAt: T0, energy: 1500, lastFoundDate: '2000-01-01' },
    });
    const { events } = simulate(pet, T0 + 6 * STEP);
    expect(events).toEqual([]);
  });
});
