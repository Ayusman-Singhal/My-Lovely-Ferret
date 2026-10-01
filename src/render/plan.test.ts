import { describe, expect, it } from 'vitest';
import type { Behavior, Decision } from '../core/petAI';
import { ANIMATION_NAMES } from './clipSpec';
import { SPEED, WALK_MAX_X, WALK_MAX_Z, WALK_MIN_X, WALK_MIN_Z, planFor, spotToX, spotToZ, stashSpot, type Phase } from './plan';
import { ROOM } from './layout';

const BEHAVIORS: Behavior[] = ['idle', 'wander', 'sniff', 'curious', 'eat', 'drink', 'playful', 'steal', 'sleep'];
const decision = (behavior: Behavior, durationMs = 5000, spots: [number, number, number] = [100, 500, 900]): Decision => ({
  behavior,
  durationMs,
  spots,
});

const CTX = { x: 180, z: 0, sockX: 130, sockZ: 0 };

describe('spotToX and spotToZ', () => {
  it('maps 0..999 onto the walkable range and nowhere else', () => {
    expect(spotToX(0)).toBe(WALK_MIN_X);
    expect(spotToX(999)).toBe(WALK_MAX_X);
    for (let s = 0; s < 1000; s++) {
      expect(spotToX(s)).toBeGreaterThanOrEqual(WALK_MIN_X);
      expect(spotToX(s)).toBeLessThanOrEqual(WALK_MAX_X);
      expect(spotToZ(s)).toBeGreaterThanOrEqual(WALK_MIN_Z);
      expect(spotToZ(s)).toBeLessThanOrEqual(WALK_MAX_Z);
    }
  });

  it('covers the depth of the floor, not just one line, and x and z are not locked together', () => {
    const zs = Array.from({ length: 1000 }, (_, s) => spotToZ(s));
    expect(Math.min(...zs)).toBeLessThan(WALK_MIN_Z + 5);
    expect(Math.max(...zs)).toBeGreaterThan(WALK_MAX_Z - 5);
    expect(spotToZ(100)).not.toBeCloseTo(spotToZ(900), 0);
    expect(new Set([0, 250, 500, 750].map((s) => Math.round(spotToZ(s)))).size).toBe(4);
  });
});

describe('planFor', () => {
  it('always gives a plan of real animations that stays inside the room', () => {
    for (const behavior of BEHAVIORS) {
      for (const spots of [[0, 0, 0], [999, 999, 999], [100, 500, 900]] as Array<[number, number, number]>) {
        for (const sockX of [130, 200]) {
          const plan = planFor(decision(behavior, 5000, spots), { ...CTX, sockX });
          expect(plan.length, behavior).toBeGreaterThan(0);
          for (const phase of plan) {
            expect(ANIMATION_NAMES).toContain(phase.anim);
            if (phase.kind === 'go') {
              expect(phase.x, behavior).toBeGreaterThanOrEqual(WALK_MIN_X - 1);
              expect(phase.x, behavior).toBeLessThanOrEqual(WALK_MAX_X + 1);
              expect(phase.z, behavior).toBeGreaterThanOrEqual(WALK_MIN_Z - 1);
              expect(phase.z, behavior).toBeLessThanOrEqual(WALK_MAX_Z + 1);
              expect(phase.speed).toBeGreaterThan(0);
            } else {
              expect(phase.ms).toBeGreaterThanOrEqual(0);
            }
          }
        }
      }
    }
  });

  it('idle stays put for the decided time', () => {
    expect(planFor(decision('idle', 6000), CTX)).toEqual([{ kind: 'do', anim: 'idle', ms: 6000 }]);
  });

  it('eat and drink walk to the bowl, facing it, then eat or drink', () => {
    const eat = planFor(decision('eat', 5000), CTX);
    expect(eat[0]).toMatchObject({ kind: 'go', anim: 'walk', face: -1 }); // the food bowl is on the left
    expect(eat[1]).toMatchObject({ kind: 'do', anim: 'eat', ms: 5000, face: -1 });
    const drink = planFor(decision('drink', 4000), CTX);
    expect(drink[0]).toMatchObject({ kind: 'go', face: 1 }); // the water bowl is on the right
    expect(drink[1]).toMatchObject({ kind: 'do', anim: 'drink', ms: 4000, face: 1 });
  });

  it('the nose reaches the bowl: the feet stand about one nose length away', () => {
    const eat = planFor(decision('eat'), CTX)[0] as Extract<Phase, { kind: 'go' }>;
    expect(Math.abs(eat.x - ROOM.foodBowlX)).toBeCloseTo(71, 0);
    expect(eat.z).toBe(ROOM.foodBowlZ);
    const drink = planFor(decision('drink'), CTX)[0] as Extract<Phase, { kind: 'go' }>;
    expect(Math.abs(ROOM.waterBowlX - drink.x)).toBeCloseTo(71, 0);
    expect(drink.z).toBe(ROOM.waterBowlZ);
  });

  it('playful is three fast runs and a happy hop', () => {
    const plan = planFor(decision('playful'), CTX);
    expect(plan.filter((p) => p.kind === 'go' && p.anim === 'run' && p.speed === SPEED.run)).toHaveLength(3);
    expect(plan[3]).toMatchObject({ kind: 'do', react: 'happy' });
  });

  it('steal walks to the sock, then sneaks it to the stash carrying it, and drops it there', () => {
    const plan = planFor(decision('steal'), CTX);
    expect(plan[0]).toMatchObject({ kind: 'go', x: 130, z: 0 });
    expect(plan[2]).toMatchObject({ kind: 'go', anim: 'sneak', x: ROOM.hammockX, z: ROOM.hammockApproachZ, startAction: 'pickSock', endAction: 'dropSock' });
  });

  it('the stash alternates so the same sock can be stolen again', () => {
    const first = stashSpot(130);
    expect(first).toEqual({ x: ROOM.hammockX, z: ROOM.hammockApproachZ });
    const second = stashSpot(first.x);
    expect(second).not.toEqual(first);
    expect(stashSpot(second.x)).toEqual(first);
  });

  it('sleep walks to the hammock, then sleeps there with no end time', () => {
    const plan = planFor(decision('sleep', 0), { ...CTX, x: 150 });
    expect(plan[0]).toMatchObject({ kind: 'go', x: ROOM.hammockX, z: ROOM.hammockApproachZ });
    expect(plan[1]).toMatchObject({ kind: 'do', anim: 'sleep', ms: Infinity, y: ROOM.hammockRestY, z: ROOM.hammockZ });
  });
});
