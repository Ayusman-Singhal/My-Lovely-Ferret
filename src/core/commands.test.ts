import { describe, expect, it } from 'vitest';
import { BOND_TABLE, PLAY_REWARD_COOLDOWN_MS, applyCommand, parseCommand, type CommandResult } from './commands';
import { HOUR, MINUTE, T0, makePet } from './testkit';
import type { PetRecord } from './types';

const ok = (r: CommandResult) => {
  expect(r.outcome.ok).toBe(true);
  return r.outcome as Extract<CommandResult['outcome'], { ok: true }>;
};

/** A pet that is awake, hungry, thirsty, and rested, with its favorites known. */
const pet = (state: Partial<PetRecord['state']> = {}, extra: { tzOffsetMin?: number; id?: string } = {}) =>
  makePet({ ...extra, state: { hunger: 5000, hydration: 5000, energy: 8000, happiness: 5000, bond: 1000, favoriteFood: 'chicken', ...state } });

describe('parseCommand', () => {
  it('accepts every well-formed command', () => {
    expect(parseCommand({ type: 'FeedPet', foodId: 'egg' })).toEqual({ type: 'FeedPet', foodId: 'egg' });
    expect(parseCommand({ type: 'GiveWater' })).toEqual({ type: 'GiveWater' });
    expect(parseCommand({ type: 'PetTouch', session: true })).toEqual({ type: 'PetTouch', session: true });
    expect(parseCommand({ type: 'StartPlay', toyId: 'ball' })).toEqual({ type: 'StartPlay', toyId: 'ball' });
    expect(parseCommand({ type: 'FinishPlay', band: 2 })).toEqual({ type: 'FinishPlay', band: 2 });
    expect(parseCommand({ type: 'PutToBed' })).toEqual({ type: 'PutToBed' });
  });

  it('clamps and truncates the play band', () => {
    expect(parseCommand({ type: 'FinishPlay', band: 99 })).toEqual({ type: 'FinishPlay', band: 3 });
    expect(parseCommand({ type: 'FinishPlay', band: -4 })).toEqual({ type: 'FinishPlay', band: 0 });
    expect(parseCommand({ type: 'FinishPlay', band: 1.9 })).toEqual({ type: 'FinishPlay', band: 1 });
  });

  it('drops malformed and unknown commands', () => {
    for (const bad of [null, undefined, 5, 'FeedPet', [], {}, { type: 'Nope' }, { type: 'FeedPet' }, { type: 'FeedPet', foodId: 'pizza' },
      { type: 'PetTouch' }, { type: 'PetTouch', session: 'yes' }, { type: 'StartPlay', toyId: 'car' }, { type: 'FinishPlay', band: 'a' },
      { type: 'FinishPlay', band: NaN }, { type: 'FinishPlay', band: Infinity }, { type: 'SetHunger', value: 10000 }]) {
      expect(parseCommand(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it('an invalid command changes nothing about the pet', () => {
    const p = pet();
    const r = applyCommand(p, { type: 'SetHunger', value: 10000 }, T0);
    expect(r.outcome).toEqual({ ok: false, reason: 'invalid', reaction: 'annoyed' });
    expect(r.pet.state).toEqual(p.state);
  });
});

describe('FeedPet', () => {
  it('raises hunger by 2500, or 3500 and happiness by 500 for the favorite food', () => {
    const plain = applyCommand(pet(), { type: 'FeedPet', foodId: 'egg' }, T0).pet.state;
    expect(plain.hunger).toBe(7500);
    expect(plain.happiness).toBe(5000);
    const fav = applyCommand(pet(), { type: 'FeedPet', foodId: 'chicken' }, T0);
    expect(fav.pet.state.hunger).toBe(8500);
    expect(fav.pet.state.happiness).toBe(5500);
    expect(ok(fav).reaction).toBe('happy');
    expect(ok(fav).stock).toBe('food');
  });

  it('caps hunger at 10000 and refuses at 9000 or more', () => {
    expect(applyCommand(pet({ hunger: 8999 }), { type: 'FeedPet', foodId: 'chicken' }, T0).pet.state.hunger).toBe(10000);
    const r = applyCommand(pet({ hunger: 9000 }), { type: 'FeedPet', foodId: 'egg' }, T0);
    expect(r.outcome).toEqual({ ok: false, reason: 'not_hungry', reaction: 'annoyed' });
    expect(r.pet.state.hunger).toBe(9000);
  });

  it('wakes a sleeping pet in the same action, at no happiness cost', () => {
    const asleep = pet({ sleepState: 'asleep', sleepStartedAt: T0 - HOUR, energy: 3000, happiness: 5000 });
    const r = applyCommand(asleep, { type: 'FeedPet', foodId: 'egg' }, T0 + 1);
    expect(ok(r).woke).toBe(true);
    expect(r.pet.state.sleepState).toBe('awake');
    expect(r.pet.state.sleepStartedAt).toBeNull();
    expect(r.pet.state.happiness).toBe(5000);
    expect(r.pet.state.hunger).toBe(7500);
  });

  it('logs PET_FED for the first feed of the day and for favorites, not for every meal', () => {
    let p = pet({ hunger: 1000 });
    const first = applyCommand(p, { type: 'FeedPet', foodId: 'egg' }, T0);
    expect(first.events.map((e) => e.type)).toEqual(['PET_FED']);
    p = first.pet;
    const second = applyCommand(p, { type: 'FeedPet', foodId: 'egg' }, T0 + MINUTE);
    expect(second.events).toEqual([]);
    const fav = applyCommand(second.pet, { type: 'FeedPet', foodId: 'chicken' }, T0 + 2 * MINUTE);
    expect(fav.events.map((e) => e.type)).toEqual(['PET_FED']);
    expect(fav.events[0]?.payload).toEqual({ foodId: 'chicken' });
  });
});

describe('GiveWater', () => {
  it('raises hydration by 3500, refuses at 9000, wakes a sleeper for free', () => {
    const r = applyCommand(pet(), { type: 'GiveWater' }, T0);
    expect(r.pet.state.hydration).toBe(8500);
    expect(ok(r).stock).toBe('water');
    expect(applyCommand(pet({ hydration: 9000 }), { type: 'GiveWater' }, T0).outcome).toMatchObject({ ok: false, reason: 'not_thirsty' });
    const asleep = applyCommand(pet({ sleepState: 'asleep', sleepStartedAt: T0 - HOUR, energy: 2500 }), { type: 'GiveWater' }, T0 + 1);
    expect(ok(asleep).woke).toBe(true);
    expect(asleep.pet.state.happiness).toBe(5000);
  });
});

describe('PetTouch', () => {
  it('a single tap gives a reaction and nothing else', () => {
    const p = pet();
    const r = applyCommand(p, { type: 'PetTouch', session: false }, T0);
    expect(ok(r).reaction).toBe('happy');
    expect(r.pet.state.happiness).toBe(5000);
    expect(r.pet.state.bond).toBe(1000);
    expect(ok(r).bondGain).toBe(0);
  });

  it('a session gives happiness +300 and bond by the diminishing table: 100, 50, then nothing', () => {
    let p = pet();
    const gains: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = applyCommand(p, { type: 'PetTouch', session: true }, T0 + i * MINUTE);
      gains.push(ok(r).bondGain);
      p = r.pet;
    }
    expect(gains).toEqual([100, 50, 0, 0, 0]);
    expect(p.state.bond).toBe(1000 + 150);
    expect(BOND_TABLE.pet).toEqual([100, 50, 0]);
  });

  it('waking a tired pet costs 300 happiness and annoys it; a rested pet just startles', () => {
    const tired = applyCommand(pet({ sleepState: 'asleep', sleepStartedAt: T0, energy: 4000 }), { type: 'PetTouch', session: false }, T0 + 1);
    expect(ok(tired).woke).toBe(true);
    expect(ok(tired).reaction).toBe('annoyed');
    expect(tired.pet.state.happiness).toBeLessThanOrEqual(4700);
    const rested = applyCommand(pet({ sleepState: 'asleep', sleepStartedAt: T0, energy: 6000 }), { type: 'PetTouch', session: false }, T0 + 1);
    expect(ok(rested).reaction).toBe('surprise');
    expect(rested.pet.state.happiness).toBeGreaterThanOrEqual(5000 - 100); // the simulation may nudge it slightly
  });

  it('happiness cost never goes below the floor', () => {
    const r = applyCommand(pet({ sleepState: 'asleep', sleepStartedAt: T0, energy: 3000, happiness: 1100 }), { type: 'PetTouch', session: false }, T0 + 1);
    expect(r.pet.state.happiness).toBeGreaterThanOrEqual(1000);
  });
});

describe('daily counters', () => {
  it('reset when the owner-local date changes, so bond is full again the next day', () => {
    let p = pet();
    for (let i = 0; i < 3; i++) p = applyCommand(p, { type: 'PetTouch', session: true }, T0 + i * MINUTE).pet;
    expect(p.state.daily.pet).toBe(3);
    const nextDay = applyCommand(p, { type: 'PetTouch', session: true }, T0 + 24 * HOUR);
    expect(ok(nextDay).bondGain).toBe(100);
    expect(nextDay.pet.state.daily).toMatchObject({ date: '2026-10-02', pet: 1 });
  });

  it('use the owner offset for the date, not the device zone', () => {
    // 20:00 UTC is already the next date in India (+330).
    const t = Date.UTC(2026, 9, 1, 20, 0, 0);
    const p = makePet({ nowMs: t, tzOffsetMin: 330, state: { energy: 8000 } });
    const r = applyCommand(p, { type: 'PetTouch', session: true }, t + MINUTE);
    expect(r.pet.state.daily.date).toBe('2026-10-02');
  });
});

describe('play: StartPlay and FinishPlay', () => {
  it('refuses to start when too tired, starts otherwise, and wakes a sleeper', () => {
    expect(applyCommand(pet({ energy: 1999 }), { type: 'StartPlay', toyId: 'ball' }, T0).outcome).toMatchObject({ ok: false, reason: 'too_tired' });
    const r = applyCommand(pet({ energy: 2000 }), { type: 'StartPlay', toyId: 'ball' }, T0);
    expect(r.pet.state.playStartedAt).toBe(T0);
    const asleep = applyCommand(pet({ sleepState: 'asleep', sleepStartedAt: T0 - HOUR, energy: 7000 }), { type: 'StartPlay', toyId: 'feather' }, T0 + 1);
    expect(ok(asleep).woke).toBe(true);
    expect(asleep.pet.state.playStartedAt).toBe(T0 + 1);
  });

  it('FinishPlay costs 1500 energy and gives happiness 500 + 400 per band', () => {
    for (const band of [0, 1, 2, 3]) {
      const started = applyCommand(pet({ energy: 8000 }), { type: 'StartPlay', toyId: 'ball' }, T0).pet;
      const r = applyCommand(started, { type: 'FinishPlay', band }, T0 + 20_000);
      expect(r.pet.state.energy).toBeLessThanOrEqual(6500);
      expect(r.pet.state.energy).toBeGreaterThan(6000);
      expect(r.pet.state.happiness).toBeGreaterThanOrEqual(5000 + 500 + band * 400 - 60); // drift over 20 s is under a step
      expect(r.pet.state.playStartedAt).toBeNull();
      expect(ok(r).rewarded).toBe(true);
    }
  });

  it('bond only for band 1 or better, by the table: 150, 75, then nothing', () => {
    let p = pet({ energy: 10000 });
    const gains: number[] = [];
    for (let i = 0; i < 4; i++) {
      const t = T0 + i * (PLAY_REWARD_COOLDOWN_MS + MINUTE);
      p = applyCommand(p, { type: 'StartPlay', toyId: 'ball' }, t).pet;
      const r = applyCommand(p, { type: 'FinishPlay', band: 1 }, t + 20_000);
      gains.push(ok(r).bondGain);
      p = { ...r.pet, state: { ...r.pet.state, energy: 10000 } };
    }
    expect(gains).toEqual([150, 75, 0, 0]);
    // Band 0: no bond at all.
    const q = applyCommand(pet({ energy: 8000 }), { type: 'StartPlay', toyId: 'ball' }, T0).pet;
    expect(ok(applyCommand(q, { type: 'FinishPlay', band: 0 }, T0 + 20_000)).bondGain).toBe(0);
  });

  it('the reward applies once per 30 minutes; the energy cost always applies', () => {
    let p = applyCommand(pet({ energy: 10000 }), { type: 'StartPlay', toyId: 'ball' }, T0).pet;
    const first = applyCommand(p, { type: 'FinishPlay', band: 3 }, T0 + 20_000);
    expect(ok(first).rewarded).toBe(true);
    p = applyCommand(first.pet, { type: 'StartPlay', toyId: 'ball' }, T0 + 5 * MINUTE).pet;
    const before = p.state;
    const second = applyCommand(p, { type: 'FinishPlay', band: 3 }, T0 + 5 * MINUTE + 20_000);
    expect(ok(second).rewarded).toBe(false);
    expect(ok(second).bondGain).toBe(0);
    expect(second.pet.state.energy).toBeLessThan(before.energy);
    expect(second.pet.state.happiness).toBeLessThanOrEqual(before.happiness + 5); // no reward, only tiny drift
    // 30 minutes after the first reward it counts again.
    const p3 = applyCommand(second.pet, { type: 'StartPlay', toyId: 'ball' }, T0 + 31 * MINUTE).pet;
    expect(ok(applyCommand(p3, { type: 'FinishPlay', band: 3 }, T0 + 31 * MINUTE + 20_000)).rewarded).toBe(true);
  });

  it('FinishPlay without a StartPlay, or long after it, is refused', () => {
    expect(applyCommand(pet(), { type: 'FinishPlay', band: 3 }, T0).outcome).toMatchObject({ ok: false, reason: 'no_play_started' });
    const started = applyCommand(pet({ energy: 8000 }), { type: 'StartPlay', toyId: 'ball' }, T0).pet;
    const late = applyCommand(started, { type: 'FinishPlay', band: 3 }, T0 + 11 * MINUTE);
    expect(late.outcome).toMatchObject({ ok: false, reason: 'no_play_started' });
    expect(late.pet.state.playStartedAt).toBeNull();
    // And a finished session cannot be finished twice.
    const done = applyCommand(started, { type: 'FinishPlay', band: 1 }, T0 + 20_000).pet;
    expect(applyCommand(done, { type: 'FinishPlay', band: 3 }, T0 + 21_000).outcome).toMatchObject({ ok: false, reason: 'no_play_started' });
  });

  it('logs PET_PLAYED only for a rewarded band of 1 or more', () => {
    const s = applyCommand(pet({ energy: 8000 }), { type: 'StartPlay', toyId: 'ball' }, T0).pet;
    const r = applyCommand(s, { type: 'FinishPlay', band: 2 }, T0 + 20_000);
    expect(r.events.map((e) => e.type)).toEqual(['PET_PLAYED']);
    expect(r.events[0]?.payload).toEqual({ band: 2 });
    const s0 = applyCommand(pet({ energy: 8000 }), { type: 'StartPlay', toyId: 'ball' }, T0).pet;
    expect(applyCommand(s0, { type: 'FinishPlay', band: 0 }, T0 + 20_000).events).toEqual([]);
  });
});

describe('PutToBed', () => {
  it('puts a tired-enough pet to sleep, records when, and refuses at 9000 energy or more', () => {
    const r = applyCommand(pet({ energy: 8999 }), { type: 'PutToBed' }, T0);
    expect(r.pet.state.sleepState).toBe('asleep');
    expect(r.pet.state.sleepStartedAt).toBe(T0);
    expect(applyCommand(pet({ energy: 9000 }), { type: 'PutToBed' }, T0).outcome).toMatchObject({ ok: false, reason: 'not_sleepy' });
  });

  it('is harmless on a pet that is already asleep', () => {
    const asleep = pet({ sleepState: 'asleep', sleepStartedAt: T0 - HOUR, energy: 3000 });
    const r = applyCommand(asleep, { type: 'PutToBed' }, T0);
    expect(ok(r).woke).toBe(false);
    expect(r.pet.state.sleepState).toBe('asleep');
    expect(r.pet.state.sleepStartedAt).toBe(T0 - HOUR);
  });
});

describe('general rules', () => {
  it('does not mutate its input', () => {
    const p = pet();
    const before = JSON.stringify(p);
    applyCommand(p, { type: 'FeedPet', foodId: 'egg' }, T0);
    applyCommand(p, { type: 'PetTouch', session: true }, T0);
    expect(JSON.stringify(p)).toBe(before);
  });

  it('catches the pet up first: hours away pass before the command lands', () => {
    const p = pet({ hunger: 9500 });
    // After 10 hours the pet is hungry enough to be fed, where it would have refused at once.
    expect(applyCommand(p, { type: 'FeedPet', foodId: 'egg' }, T0).outcome.ok).toBe(false);
    const late = applyCommand(p, { type: 'FeedPet', foodId: 'egg' }, T0 + 10 * HOUR);
    expect(late.outcome.ok).toBe(true);
    expect(late.pet.timestamps.lastSimulationTime).toBeGreaterThan(T0);
  });

  it('records the interaction time and never breaks the needs range', () => {
    let p = pet({ hunger: 1000, hydration: 1000, energy: 10000 });
    for (let i = 0; i < 60; i++) {
      const cmds = [{ type: 'FeedPet', foodId: 'chicken' }, { type: 'GiveWater' }, { type: 'PetTouch', session: true }, { type: 'StartPlay', toyId: 'ball' }, { type: 'FinishPlay', band: 3 }, { type: 'PutToBed' }];
      p = applyCommand(p, cmds[i % cmds.length], T0 + i * 40 * MINUTE).pet;
      for (const k of ['hunger', 'hydration', 'energy', 'happiness', 'bond'] as const) {
        expect(p.state[k]).toBeGreaterThanOrEqual(0);
        expect(p.state[k]).toBeLessThanOrEqual(10000);
      }
    }
    expect(p.state.lastInteractionTime).toBeGreaterThan(T0);
  });
});
