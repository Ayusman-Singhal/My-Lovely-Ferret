import { describe, expect, it } from 'vitest';
import { applyCommand } from '../core/commands';
import type { AIWorld } from '../core/petAI';
import { DAY, HOUR, T0, makePet } from '../core/testkit';
import { createManualClock } from '../core/time';
import type { HistoryEvent, PetRecord } from '../core/types';
import { ANIMATION_NAMES, type AnimationName } from './animations';
import { createBrain, type BrainScene } from './brain';
import { WALK_MAX_X, WALK_MIN_X } from './plan';
import { ROOM } from './room';

const WORLD: AIWorld = { foodInBowl: true, waterInBowl: true, hasToy: true, hasStealable: true, propNearby: false, pointerInRoom: false };

function setup(pet: PetRecord, world: AIWorld = { ...WORLD }) {
  const clock = createManualClock(pet.timestamps.lastSimulationTime);
  let current = pet;
  const events: HistoryEvent[] = [];
  const base: AnimationName[] = [];
  const scene: BrainScene = {
    x: 180,
    y: ROOM.groundY,
    facing: 1,
    animator: {
      setBase: (name) => base.push(name),
      react: () => undefined,
    },
  };
  const brain = createBrain({ pet: { get: () => current, set: (p) => (current = p) }, clock, world, onEvents: (e) => events.push(...e) });
  let frame = 0;
  /** Run `frames` display frames of 16 ms, advancing game time by `gameMsPerFrame` each. */
  const run = (frames: number, gameMsPerFrame: number, each?: () => void): void => {
    for (let i = 0; i < frames; i++) {
      frame++;
      clock.advance(gameMsPerFrame);
      brain.tick(frame * 16, scene);
      each?.();
    }
  };
  /** Do what a player does: feed and water the pet whenever it gets hungry or thirsty. */
  const care = (): void => {
    const s = current.state;
    if (s.hunger < 4000) {
      current = applyCommand(current, { type: 'FeedPet', foodId: 'egg' }, clock.nowMs()).pet;
      world.foodInBowl = true;
      brain.request('eat');
    }
    if (s.hydration < 4000) {
      current = applyCommand(current, { type: 'GiveWater' }, clock.nowMs()).pet;
      world.waterInBowl = true;
      brain.request('drink');
    }
  };
  return { brain, scene, clock, run, care, world, events, base, pet: () => current, setPet: (p: PetRecord) => (current = p) };
}

describe('brain', () => {
  it('runs for ten minutes in real time: stays in the room, uses real animations, and keeps deciding', () => {
    const t = setup(makePet({ id: 'walker', state: { energy: 9000, happiness: 8000 } }));
    const seen = new Set<string>();
    let minX = Infinity;
    let maxX = -Infinity;
    t.run(37_500, 16, () => {
      minX = Math.min(minX, t.scene.x);
      maxX = Math.max(maxX, t.scene.x);
      expect(Number.isFinite(t.scene.x)).toBe(true);
      const d = t.brain.current();
      if (d) seen.add(d.behavior);
    });
    expect(minX).toBeGreaterThanOrEqual(WALK_MIN_X - 1);
    expect(maxX).toBeLessThanOrEqual(WALK_MAX_X + 1);
    expect(seen.size).toBeGreaterThan(3);
    for (const name of t.base) expect(ANIMATION_NAMES).toContain(name);
  });

  it('faces the way it walks', () => {
    const t = setup(makePet({ id: 'facing' }));
    let checked = 0;
    let prevX = t.scene.x;
    t.run(6000, 16, () => {
      const dx = t.scene.x - prevX;
      prevX = t.scene.x;
      // Only when it moves noticeably: 55 px/s is about 0.9 px per frame.
      if (Math.abs(dx) > 0.5) {
        const d = t.brain.current();
        if (d && d.behavior !== 'eat' && d.behavior !== 'drink' && d.behavior !== 'curious') {
          expect(t.scene.facing).toBe(dx > 0 ? 1 : -1);
          checked++;
        }
      }
    });
    expect(checked).toBeGreaterThan(50);
  });

  it('goes to the hammock and sleeps when the simulation puts the pet to sleep, and gets up when it wakes', () => {
    const t = setup(makePet({ id: 'sleeper', state: { energy: 9000 } }));
    t.run(200, 16);
    t.setPet({ ...t.pet(), state: { ...t.pet().state, sleepState: 'asleep', sleepStartedAt: T0, energy: 2000 } });
    t.run(1500, 16); // walking to the hammock takes under 2 s at 55 px/s
    expect(t.brain.current()?.behavior).toBe('sleep');
    expect(t.scene.y).toBe(ROOM.hammockRestY);
    expect(t.scene.x).toBe(ROOM.hammockX);
    expect(t.base.at(-1)).toBe('sleep');
    // Still asleep a while later: no restless decisions.
    t.run(500, 16);
    expect(t.brain.current()?.behavior).toBe('sleep');
    // Woken up: back on the floor and doing something else.
    t.setPet({ ...t.pet(), state: { ...t.pet().state, sleepState: 'awake', sleepStartedAt: null } });
    t.run(10, 16);
    expect(t.brain.current()?.behavior).not.toBe('sleep');
    expect(t.scene.y).toBe(ROOM.groundY);
  });

  it('a high-mischief pet steals the sock again and again, at most every 12 hours, and logs it', () => {
    const t = setup(
      makePet({ id: 'thief', personality: { mischief: 95, curiosity: 50, affection: 50 }, state: { energy: 9000, happiness: 8000 } }),
    );
    const sockPositions = new Set<number>();
    // Game time runs about 300 times faster than screen time (5 game seconds per 16 ms frame):
    // 83 game hours pass in 60,000 frames while the pet still walks at its normal pace.
    t.run(60_000, 5_000, () => {
      sockPositions.add(Math.round(t.brain.sock.x));
      t.care(); // a pet left to starve is too hungry to scheme, so the player keeps it fed
    });
    const stolen = t.events.filter((e) => e.type === 'PET_STOLE_ITEM');
    expect(stolen.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < stolen.length; i++) {
      expect((stolen[i] as HistoryEvent).t - (stolen[i - 1] as HistoryEvent).t).toBeGreaterThanOrEqual(12 * HOUR);
    }
    expect(sockPositions.size).toBeGreaterThan(1); // the sock really moved
    expect(t.brain.sock.carried).toBe(false);
  });

  it('a well-behaved pet never steals, on screen or unseen', () => {
    const t = setup(makePet({ id: 'angel', personality: { mischief: 10, curiosity: 50, affection: 50 } }));
    t.run(60_000, 5_000);
    expect(t.events.filter((e) => e.type === 'PET_STOLE_ITEM')).toHaveLength(0);
    expect(t.pet().history.filter((e) => e.type === 'PET_STOLE_ITEM')).toHaveLength(0);
  });

  it('short gaps while the app is open leave steals to PetAI; a long gap counts as time away', () => {
    // 10 days away in one tick: the simulation may log unseen steals for a mischievous pet.
    const away = setup(makePet({ id: 'away-thief', personality: { mischief: 100, curiosity: 50, affection: 50 } }));
    away.run(1, 10 * DAY);
    expect(away.events.filter((e) => e.type === 'PET_STOLE_ITEM').length).toBeGreaterThan(3);
    // The same 10 days as 5-minute gaps (the app stayed open): no unseen steals from the simulation.
    const open = setup(makePet({ id: 'away-thief', personality: { mischief: 100, curiosity: 50, affection: 50 } }));
    const before = open.events.length;
    open.run(1, 5 * 60_000);
    expect(open.events.length).toBe(before);
  });

  it('keeps the simulation current while the app is open: time passes and needs fall', () => {
    const t = setup(makePet({ id: 'living' }));
    t.run(2 * 1440, 60_000); // two game days
    const p = t.pet();
    expect(p.timestamps.lastSimulationTime).toBeGreaterThan(T0 + DAY);
    expect(p.state.hunger).toBeLessThan(7500);
    expect(p.history.length).toBeGreaterThan(1); // events such as found items and long sleeps were logged
  });

  it('a hungry pet with a stocked bowl goes to eat; with an empty bowl it never does', () => {
    const eater = setup(makePet({ id: 'hungry', state: { hunger: 1500, energy: 9000 } }));
    const seen = new Set<string>();
    eater.run(3000, 16, () => {
      const d = eater.brain.current();
      if (d) seen.add(d.behavior);
    });
    expect(seen.has('eat')).toBe(true);

    const fasting = setup(makePet({ id: 'hungry', state: { hunger: 1500, energy: 9000 } }), { ...WORLD, foodInBowl: false });
    const seen2 = new Set<string>();
    fasting.run(3000, 16, () => {
      const d = fasting.brain.current();
      if (d) seen2.add(d.behavior);
    });
    expect(seen2.has('eat')).toBe(false);
  });
});
