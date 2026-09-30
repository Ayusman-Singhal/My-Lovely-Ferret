import { describe, expect, it } from 'vitest';
import {
  AI_COOLDOWN_TICKS,
  SCORED_BEHAVIORS,
  completeBehavior,
  createAIState,
  forceDecision,
  nextDecision,
  scoreBehaviors,
  type AIWorld,
  type Behavior,
} from './petAI';
import { TUNING } from './tuning';
import { DAY, HOUR, T0, T_NIGHT, makePet } from './testkit';

const EMPTY_ROOM: AIWorld = { foodInBowl: false, waterInBowl: false, hasToy: false, hasStealable: false, propNearby: false, pointerInRoom: false };
const FULL_ROOM: AIWorld = { foodInBowl: true, waterInBowl: true, hasToy: true, hasStealable: true, propNearby: false, pointerInRoom: false };

// T0 is 09:00 UTC: "day" class with a zero offset. T_NIGHT is 22:00: "night". 12:30 is "nap".
const T_NAP = Date.UTC(2026, 9, 1, 12, 30, 0);

const calm = { hunger: 8000, hydration: 8000, energy: 8000, happiness: 5000 };

describe('scoreBehaviors: the table in docs/PET_BEHAVIOR.md §3', () => {
  it('idle: 30, +20 for a low-affection pet, +20 when tired, +10 by day, + (100 - mischief)/8 for calm pets', () => {
    const base = makePet({ personality: { affection: 50, mischief: 100 }, state: calm });
    expect(scoreBehaviors(base, EMPTY_ROOM, T_NIGHT).idle).toBe(30);
    expect(scoreBehaviors(base, EMPTY_ROOM, T0).idle).toBe(40);
    expect(scoreBehaviors(makePet({ personality: { affection: 29, mischief: 100 }, state: calm }), EMPTY_ROOM, T_NIGHT).idle).toBe(50);
    expect(scoreBehaviors(makePet({ personality: { affection: 50, mischief: 100 }, state: { ...calm, energy: 2999 } }), EMPTY_ROOM, T_NIGHT).idle).toBe(50);
    // Calm pets settle more: mischief 0 adds 12, mischief 84 adds 2.
    expect(scoreBehaviors(makePet({ personality: { affection: 50, mischief: 0 }, state: calm }), EMPTY_ROOM, T_NIGHT).idle).toBe(42);
    expect(scoreBehaviors(makePet({ personality: { affection: 50, mischief: 84 }, state: calm }), EMPTY_ROOM, T_NIGHT).idle).toBe(32);
  });

  it('wander: 25 + curiosity/4, -10 at night, plus following the player when affectionate', () => {
    const p = makePet({ personality: { curiosity: 80, affection: 40 }, state: calm });
    expect(scoreBehaviors(p, EMPTY_ROOM, T0).wander).toBe(45);
    expect(scoreBehaviors(p, EMPTY_ROOM, T_NIGHT).wander).toBe(35);
    // Affection 60 or more and the pointer in the room: + affection/3.
    const clingy = makePet({ personality: { curiosity: 80, affection: 60 }, state: calm });
    expect(scoreBehaviors(clingy, { ...EMPTY_ROOM, pointerInRoom: true }, T0).wander).toBe(45 + 20);
    expect(scoreBehaviors(clingy, EMPTY_ROOM, T0).wander).toBe(45);
    const cool = makePet({ personality: { curiosity: 80, affection: 59 }, state: calm });
    expect(scoreBehaviors(cool, { ...EMPTY_ROOM, pointerInRoom: true }, T0).wander).toBe(45);
  });

  it('sniff and curious grow with curiosity and with props in the room', () => {
    const p = makePet({ personality: { curiosity: 90, mischief: 100 }, state: calm });
    expect(scoreBehaviors(p, EMPTY_ROOM, T0).sniff).toBe(15 + 30);
    expect(scoreBehaviors(makePet({ personality: { curiosity: 90, mischief: 0 }, state: calm }), EMPTY_ROOM, T0).sniff).toBe(15 + 30 + 10);
    expect(scoreBehaviors(p, { ...EMPTY_ROOM, propNearby: true }, T0).sniff).toBe(15 + 30 + 10);
    expect(scoreBehaviors(p, EMPTY_ROOM, T0).curious).toBe(5 + 45);
    expect(scoreBehaviors(p, { ...EMPTY_ROOM, hasToy: true }, T0).curious).toBe(5 + 45 + 20);
  });

  it('eat and drink need a stocked bowl and a need below 6000, and grow as the need does', () => {
    const p = makePet({ state: { ...calm, hunger: 5000, hydration: 4000 } });
    expect(scoreBehaviors(p, EMPTY_ROOM, T0).eat).toBe(0);
    expect(scoreBehaviors(p, EMPTY_ROOM, T0).drink).toBe(0);
    expect(scoreBehaviors(p, FULL_ROOM, T0).eat).toBe(50);
    expect(scoreBehaviors(p, FULL_ROOM, T0).drink).toBe(60);
    const full = makePet({ state: { ...calm, hunger: 6000, hydration: 9000 } });
    expect(scoreBehaviors(full, FULL_ROOM, T0).eat).toBe(0);
    expect(scoreBehaviors(full, FULL_ROOM, T0).drink).toBe(0);
  });

  it('needs first: an urgent need with a stocked bowl gets +50', () => {
    const p = makePet({ state: { ...calm, hunger: 2500, hydration: 2000 } });
    expect(scoreBehaviors(p, FULL_ROOM, T0).eat).toBe(75 + 50);
    expect(scoreBehaviors(p, FULL_ROOM, T0).drink).toBe(80 + 50);
    // Urgent but nothing in the bowl: nothing to do about it.
    expect(scoreBehaviors(p, EMPTY_ROOM, T0).eat).toBe(0);
    // And an urgently hungry pet does not play or steal while the bowl is stocked.
    const mischievous = makePet({ personality: { mischief: 95 }, state: { ...calm, hunger: 2500, happiness: 8000 } });
    const s = scoreBehaviors(mischievous, FULL_ROOM, T0);
    expect(s.playful).toBe(0);
    expect(s.steal).toBe(0);
    expect(scoreBehaviors(mischievous, EMPTY_ROOM, T0).playful).toBeGreaterThan(0);
  });

  it('playful: 5 + mischief, + energy/400 when happy, +10 outside the day class, needs energy', () => {
    const p = makePet({ personality: { mischief: 90 }, state: { ...calm, energy: 8000, happiness: 6000 } });
    expect(scoreBehaviors(p, EMPTY_ROOM, T0).playful).toBe(5 + 90 + 20);
    expect(scoreBehaviors(p, EMPTY_ROOM, T_NIGHT).playful).toBe(5 + 90 + 20 + 10);
    expect(scoreBehaviors(p, EMPTY_ROOM, T_NAP).playful).toBe(5 + 90 + 20 + 10);
    const sad = makePet({ personality: { mischief: 90 }, state: { ...calm, energy: 8000, happiness: 5999 } });
    expect(scoreBehaviors(sad, EMPTY_ROOM, T0).playful).toBe(5 + 90);
    const tired = makePet({ personality: { mischief: 90 }, state: { ...calm, energy: 2499 } });
    expect(scoreBehaviors(tired, EMPTY_ROOM, T0).playful).toBe(0);
  });

  it('steal: mischief/2 only for mischief >= 50, with an item, off the 12 hour cooldown', () => {
    const thief = makePet({ personality: { mischief: 80 }, state: calm });
    expect(scoreBehaviors(thief, FULL_ROOM, T0).steal).toBe(40);
    expect(scoreBehaviors(thief, EMPTY_ROOM, T0).steal).toBe(0); // nothing to steal
    expect(scoreBehaviors(makePet({ personality: { mischief: 49 }, state: calm }), FULL_ROOM, T0).steal).toBe(0);
    expect(scoreBehaviors(makePet({ personality: { mischief: 50 }, state: calm }), FULL_ROOM, T0).steal).toBe(25);

    const recent = makePet({ personality: { mischief: 80 }, state: { ...calm, lastStoleAt: T0 - TUNING.events.stealCooldownMs + 1 } });
    expect(scoreBehaviors(recent, FULL_ROOM, T0).steal).toBe(0);
    const ready = makePet({ personality: { mischief: 80 }, state: { ...calm, lastStoleAt: T0 - TUNING.events.stealCooldownMs } });
    expect(scoreBehaviors(ready, FULL_ROOM, T0).steal).toBe(40);
  });

  it('back-to-back cooldown: steal and playful are off for 3 decisions', () => {
    const p = makePet({ personality: { mischief: 90 }, state: { ...calm, happiness: 7000 } });
    const cooling = { sinceSteal: AI_COOLDOWN_TICKS - 1, sincePlayful: AI_COOLDOWN_TICKS - 1 };
    const s = scoreBehaviors(p, FULL_ROOM, T0, cooling);
    expect(s.steal).toBe(0);
    expect(s.playful).toBe(0);
    const ready = scoreBehaviors(p, FULL_ROOM, T0, { sinceSteal: AI_COOLDOWN_TICKS, sincePlayful: AI_COOLDOWN_TICKS });
    expect(ready.steal).toBeGreaterThan(0);
    expect(ready.playful).toBeGreaterThan(0);
  });

  it('uses the owner offset for the time class, not the device zone', () => {
    const traits = { mischief: 100, affection: 50 };
    // 17:00 UTC is 22:30 in India: night, so no +10 day bonus for idle. The same instant in UTC is day.
    const t = Date.UTC(2026, 9, 1, 17, 0, 0);
    expect(scoreBehaviors(makePet({ tzOffsetMin: 330, personality: traits, state: calm }), EMPTY_ROOM, t).idle).toBe(30);
    expect(scoreBehaviors(makePet({ tzOffsetMin: 0, personality: traits, state: calm }), EMPTY_ROOM, t).idle).toBe(40);
  });

  it('idle is always eligible, so a decision always exists', () => {
    for (let i = 0; i < 50; i++) {
      const p = makePet({ id: `any-${i}`, personality: { mischief: i, curiosity: 100 - i, affection: (i * 7) % 100 }, state: { hunger: 1000, hydration: 1000, energy: 1000, happiness: 1000 } });
      expect(scoreBehaviors(p, EMPTY_ROOM, T0).idle).toBeGreaterThan(0);
      const { decision } = nextDecision(createAIState(), p, EMPTY_ROOM, T0);
      expect(decision.behavior).toBeDefined();
    }
  });
});

describe('nextDecision', () => {
  it('is deterministic for the same pet, world, and counter', () => {
    const p = makePet({ personality: { mischief: 70 }, state: calm });
    const a = nextDecision(createAIState(), p, FULL_ROOM, T0);
    const b = nextDecision(createAIState(), p, FULL_ROOM, T0);
    expect(a).toEqual(b);
  });

  it('advances the counter and gives a different result over time', () => {
    const p = makePet({ state: calm });
    let ai = createAIState();
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const r = nextDecision(ai, p, FULL_ROOM, T0);
      ai = r.ai;
      seen.add(r.decision.behavior);
    }
    expect(ai.counter).toBe(100);
    expect(seen.size).toBeGreaterThan(2);
  });

  it('a sleeping pet just sleeps', () => {
    const p = makePet({ state: { ...calm, sleepState: 'asleep', sleepStartedAt: T0 } });
    const { decision } = nextDecision(createAIState(), p, FULL_ROOM, T0);
    expect(decision.behavior).toBe('sleep');
  });

  it('returns durations in whole 100 ms steps inside the documented ranges, and spots in 0..999', () => {
    const p = makePet({ personality: { mischief: 90 }, state: { ...calm, happiness: 7000, hunger: 2000 } });
    let ai = createAIState();
    for (let i = 0; i < 300; i++) {
      const r = nextDecision(ai, p, FULL_ROOM, T0 + i * 20 * HOUR);
      ai = r.ai;
      const d = r.decision;
      expect(d.durationMs % 100).toBe(0);
      if (d.behavior === 'idle') expect(d.durationMs).toBeGreaterThanOrEqual(4000);
      if (d.behavior === 'idle') expect(d.durationMs).toBeLessThanOrEqual(8000);
      if (d.behavior === 'wander' || d.behavior === 'steal') expect(d.durationMs).toBe(0);
      for (const s of d.spots) {
        expect(Number.isInteger(s)).toBe(true);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThan(1000);
      }
    }
  });

  it('never chooses steal or playful twice in a row, and steal only every 3+ decisions', () => {
    const p = makePet({ personality: { mischief: 100 }, state: { ...calm, happiness: 9000, energy: 9000 } });
    let ai = createAIState();
    let sinceSteal = 99;
    let sincePlayful = 99;
    for (let i = 0; i < 2000; i++) {
      const r = nextDecision(ai, p, FULL_ROOM, T0 + i * 13 * HOUR);
      ai = r.ai;
      const b = r.decision.behavior;
      if (b === 'steal') {
        expect(sinceSteal).toBeGreaterThanOrEqual(AI_COOLDOWN_TICKS);
        sinceSteal = 0;
      } else sinceSteal++;
      if (b === 'playful') {
        expect(sincePlayful).toBeGreaterThanOrEqual(AI_COOLDOWN_TICKS);
        sincePlayful = 0;
      } else sincePlayful++;
    }
  });

  it('a hungry pet with a stocked bowl mostly eats', () => {
    const p = makePet({ state: { ...calm, hunger: 1500 } });
    let ai = createAIState();
    let eats = 0;
    for (let i = 0; i < 400; i++) {
      const r = nextDecision(ai, p, FULL_ROOM, T0);
      ai = r.ai;
      if (r.decision.behavior === 'eat') eats++;
    }
    expect(eats).toBeGreaterThan(400 * 0.4);
    // The same pet with an empty bowl never tries to eat.
    ai = createAIState();
    for (let i = 0; i < 200; i++) {
      const r = nextDecision(ai, p, EMPTY_ROOM, T0);
      ai = r.ai;
      expect(r.decision.behavior).not.toBe('eat');
    }
  });
});

describe('personality is visible (docs/PET_BEHAVIOR.md §3)', () => {
  /** Run PetAI for 1000 decisions, completing each one, 13 hours apart so the steal cooldown allows it. */
  function tally(mischief: number, curiosity: number): Record<Behavior, number> {
    let pet = makePet({ id: `p-${mischief}`, personality: { mischief, curiosity, affection: 50 }, state: { ...calm, happiness: 7000 } });
    let ai = createAIState();
    const counts: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      const now = T0 + i * 13 * HOUR;
      const r = nextDecision(ai, pet, FULL_ROOM, now);
      ai = r.ai;
      counts[r.decision.behavior] = (counts[r.decision.behavior] ?? 0) + 1;
      pet = completeBehavior(pet, r.decision.behavior, now).pet;
    }
    return counts as Record<Behavior, number>;
  }

  it('a high-mischief pet steals and plays more, a low-mischief pet idles and sniffs more', () => {
    const high = tally(85, 50);
    const low = tally(15, 50);
    expect(high.steal ?? 0).toBeGreaterThan(80);
    expect(low.steal ?? 0).toBe(0);
    expect(high.playful ?? 0).toBeGreaterThan((low.playful ?? 0) * 1.3);
    expect(low.idle ?? 0).toBeGreaterThan((high.idle ?? 0) * 1.2);
    expect(low.sniff ?? 0).toBeGreaterThan(high.sniff ?? 0);
  });

  it('a curious pet wanders and investigates more than an incurious one', () => {
    const curious = tally(50, 95);
    const dull = tally(50, 5);
    expect((curious.curious ?? 0) + (curious.sniff ?? 0) + (curious.wander ?? 0)).toBeGreaterThan(
      ((dull.curious ?? 0) + (dull.sniff ?? 0) + (dull.wander ?? 0)) * 1.25,
    );
  });
});

describe('forceDecision and completeBehavior', () => {
  it('forceDecision returns the requested behavior and keeps the cooldown counters honest', () => {
    const p = makePet();
    const r = forceDecision(createAIState(), p, 'steal');
    expect(r.decision.behavior).toBe('steal');
    expect(r.ai.sinceSteal).toBe(0);
    expect(forceDecision(r.ai, p, 'idle').ai.sinceSteal).toBe(1);
  });

  it('finishing a steal logs the event once and starts the cooldown; other behaviors change nothing', () => {
    const p = makePet({ personality: { mischief: 90 } });
    const done = completeBehavior(p, 'steal', T0 + 5000);
    expect(done.events).toEqual([
      { id: `PET_STOLE_ITEM-${T0 + 5000}`, t: T0 + 5000, type: 'PET_STOLE_ITEM', actor: 'pet', payload: { itemId: 'sock' } },
    ]);
    expect(done.pet.state.lastStoleAt).toBe(T0 + 5000);
    expect(done.pet.history.at(-1)).toEqual(done.events[0]);
    expect(p.history).toHaveLength(1); // input untouched
    // And the cooldown now blocks the next one.
    expect(scoreBehaviors(done.pet, FULL_ROOM, T0 + 5000 + HOUR).steal).toBe(0);
    expect(scoreBehaviors(done.pet, FULL_ROOM, T0 + 5000 + 13 * HOUR).steal).toBeGreaterThan(0);
    for (const b of ['idle', 'wander', 'sniff', 'curious', 'eat', 'drink', 'playful', 'sleep'] as const) {
      const r = completeBehavior(p, b, T0);
      expect(r.pet).toBe(p);
      expect(r.events).toEqual([]);
    }
  });

  it('scores cover exactly the scored behaviors', () => {
    expect(Object.keys(scoreBehaviors(makePet(), EMPTY_ROOM, T0)).sort()).toEqual([...SCORED_BEHAVIORS].sort());
    expect(DAY).toBeGreaterThan(0); // keep the shared constant referenced
  });
});
