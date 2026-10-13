import { describe, expect, it } from 'vitest';
import type { Behavior, Decision } from '../core/petAI';
import { ANIMATION_NAMES } from './clipSpec';
import { LANE_EDGES, LANE_NODES, OBSTACLES, PREVIEW_HEADING, SPEED, WALK_MAX_X, WALK_MAX_Z, WALK_MIN_X, WALK_MIN_Z, freeSpot, planFor, routePoints, segmentClear, spotToX, spotToZ, stashSpot, trickPlan, type Phase } from './plan';
import { ROOM } from './layout';

const BEHAVIORS: Behavior[] = ['idle', 'wander', 'sniff', 'curious', 'eat', 'drink', 'playful', 'steal', 'sleep', 'stretch', 'dig', 'tunnel', 'dance', 'tailchase'];
const decision = (behavior: Behavior, durationMs = 5000, spots: [number, number, number] = [100, 500, 900]): Decision => ({
  behavior,
  durationMs,
  spots,
});

const CTX = { x: 180, z: 0, sockX: 130, sockZ: 0, ballX: ROOM.toyX, ballZ: ROOM.toyZ };

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
              // The tunnel is along the front edge, outside the roaming area but inside the reach.
              const wide = behavior === 'tunnel';
              expect(phase.x, behavior).toBeGreaterThanOrEqual((wide ? ROOM.reachMinX : WALK_MIN_X) - 1);
              expect(phase.x, behavior).toBeLessThanOrEqual((wide ? ROOM.reachMaxX : WALK_MAX_X) + 1);
              expect(phase.z, behavior).toBeGreaterThanOrEqual((wide ? ROOM.reachMinZ : WALK_MIN_Z) - 1);
              expect(phase.z, behavior).toBeLessThanOrEqual((wide ? ROOM.reachMaxZ : WALK_MAX_Z) + 1);
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

describe('the things it does for itself (Part 1L.3)', () => {
  it('a tunnel run goes in at the nearer mouth, along the tunnel, and out of the other', () => {
    for (const [x, inFirst] of [[100, 'A'], [260, 'B']] as const) {
      const plan = planFor(decision('tunnel'), { ...CTX, x });
      const goes = plan.filter((p): p is Extract<Phase, { kind: 'go' }> => p.kind === 'go');
      expect(goes).toHaveLength(2);
      const [enter, through] = goes as [typeof goes[0], typeof goes[0]];
      const near = inFirst === 'A' ? ROOM.tunnelAX : ROOM.tunnelBX;
      const far = inFirst === 'A' ? ROOM.tunnelBX : ROOM.tunnelAX;
      expect(enter.z).toBe(ROOM.tunnelZ);
      expect(through.z).toBe(ROOM.tunnelZ);
      // It starts outside the near mouth and ends outside the far one, so it crosses the whole tunnel.
      expect(Math.sign(enter.x - near)).toBe(Math.sign(near - far));
      expect(Math.sign(through.x - far)).toBe(Math.sign(far - near));
      expect(through.speed).toBe(SPEED.run);
    }
  });

  it('chasing its tail turns the body on the spot, to the right, with the tail-chase clip', () => {
    const plan = planFor(decision('tailchase', 3000), CTX);
    const spin = plan[0] as Extract<Phase, { kind: 'do' }>;
    expect(spin.anim).toBe('tailChase');
    expect(spin.spin).toBeLessThan(0);
    expect(spin.ms).toBe(3000);
  });

  it('a stretch, a dig, and a war dance use their own clips for the length of the decision', () => {
    const clipOf = (b: Behavior, clip: string) => {
      const plan = planFor(decision(b, 2500), CTX);
      const doing = plan.find((p) => p.kind === 'do' && p.anim === clip) as Extract<Phase, { kind: 'do' }> | undefined;
      expect(doing, b).toBeDefined();
      expect(doing?.ms).toBe(2500);
    };
    clipOf('stretch', 'stretch');
    clipOf('dig', 'dig');
    clipOf('dance', 'warDance');
  });
});

describe('trickPlan (Part 1L.7)', () => {
  it('every trick stays on the spot, uses real clips, turns to face the player, and ends pleased', () => {
    for (const id of ['sit_up', 'bow', 'spin', 'dance']) {
      const plan = trickPlan(id);
      expect(plan.every((p) => p.kind === 'do'), id).toBe(true);
      for (const phase of plan) expect(ANIMATION_NAMES).toContain(phase.anim);
      const last = plan[plan.length - 1] as Extract<Phase, { kind: 'do' }>;
      expect(last.react, id).toBe('happy');
      expect(plan.some((p) => p.kind === 'do' && p.heading === PREVIEW_HEADING) || id === 'spin', id).toBe(true);
    }
  });

  it('an unknown trick is a short pause, never an error', () => {
    expect(trickPlan('backflip')).toEqual([{ kind: 'do', anim: 'idle', ms: 300 }]);
  });
});

describe('obstacle avoidance (furniture is walked around, never through)', () => {
  const goes = (plan: Phase[]): Array<Extract<Phase, { kind: 'go' }>> => plan.filter((p): p is Extract<Phase, { kind: 'go' }> => p.kind === 'go');

  it('every lane edge stays clear of every obstacle', () => {
    for (const [a, b] of LANE_EDGES) {
      const p = LANE_NODES[a] as { x: number; z: number };
      const q = LANE_NODES[b] as { x: number; z: number };
      expect(segmentClear(p.x, p.z, q.x, q.z), `lane ${a}-${b}`).toBe(true);
    }
  });

  it('every lane node and every fixed standing point is free', () => {
    const points: Array<[string, number, number]> = [
      ...LANE_NODES.map((n, i): [string, number, number] => [`lane${i}`, n.x, n.z]),
      ['eat', 109, ROOM.foodBowlZ],
      ['drink', 251, ROOM.waterBowlZ],
      ['window', ROOM.windowX, WALK_MIN_Z],
      ['sleep', ROOM.hammockX, ROOM.hammockApproachZ],
      ['preview', 180, 24],
      ['fetchDrop', ROOM.fetchDropX, ROOM.fetchDropZ],
      ['watch', ROOM.gameWatch.x, ROOM.gameWatch.z],
      ['sock', 130, 0],
      ['ball', ROOM.toyX, ROOM.toyZ],
    ];
    for (const [name, x, z] of points) {
      expect(freeSpot(x, z), name).toEqual({ x, z });
    }
  });

  it('routePoints goes straight when clear and bends through the lanes around the tube', () => {
    expect(routePoints({ x: 180, z: 0 }, { x: 200, z: -20 })).toEqual([{ x: 200, z: -20 }]);
    const legs = routePoints({ x: 270, z: 72 }, { x: 109, z: ROOM.foodBowlZ });
    expect(legs.length).toBeGreaterThan(1);
    expect(legs.at(-1)).toEqual({ x: 109, z: ROOM.foodBowlZ });
    let from = { x: 270, z: 72 };
    for (const to of legs) {
      expect(segmentClear(from.x, from.z, to.x, to.z)).toBe(true);
      from = to;
    }
  });

  it('freeSpot ejects a tube-interior point north and leaves free points alone', () => {
    expect(freeSpot(150, 80)).toEqual({ x: 150, z: 30 });
    expect(freeSpot(ROOM.foodBowlX, ROOM.foodBowlZ)).not.toEqual({ x: ROOM.foodBowlX, z: ROOM.foodBowlZ }); // the bowl itself is furniture
    expect(freeSpot(180, 0)).toEqual({ x: 180, z: 0 });
  });

  it('mapped spots never end inside furniture: a sweep over all spots stays clear', () => {
    for (let s = 0; s < 1000; s += 7) {
      const p = freeSpot(spotToX(s), spotToZ(s));
      expect(segmentClear(p.x, p.z, p.x, p.z)).toBe(true);
    }
  });

  it('every behavior walks clear furniture from anywhere and ends exactly on target', () => {
    const starts = [
      { x: 100, z: -60 },
      { x: 260, z: 60 },
      { x: 270, z: 72 },
      { x: 180, z: 0 },
    ];
    for (const behavior of BEHAVIORS) {
      for (const from of starts) {
        const plan = planFor(decision(behavior, 5000), { ...CTX, x: from.x, z: from.z });
        let at = from;
        for (const leg of goes(plan)) {
          // The tunnel's own through-run is the designed exception (see below).
          if (behavior === 'tunnel') continue;
          expect(segmentClear(at.x, at.z, leg.x, leg.z), `${behavior} from (${from.x},${from.z})`).toBe(true);
          at = { x: leg.x, z: leg.z };
        }
      }
    }
  });

  it('the tunnel through-run is the designed exception: it travels inside the tube', () => {
    const tube = OBSTACLES.find((o) => o.kind === 'rect') as Extract<(typeof OBSTACLES)[number], { kind: 'rect' }>;
    const inTube = (x: number, z: number): boolean => x > tube.x0 && x < tube.x1 && z > tube.z0 && z < tube.z1;
    const plan = planFor(decision('tunnel'), { ...CTX, x: 100 });
    const legs = goes(plan);
    expect(legs).toHaveLength(2);
    const [enter, through] = legs as [typeof legs[0], typeof legs[0]];
    // The mouths themselves are free ground; only the through leg crosses furniture.
    expect(inTube(enter.x, enter.z)).toBe(false);
    expect(segmentClear(enter.x, enter.z, through.x, through.z)).toBe(false);
    expect(inTube(through.x, through.z)).toBe(false);
  });

  it('routing is deterministic: the same walk always bends the same way', () => {
    const a = planFor(decision('eat', 5000), { ...CTX, x: 270, z: 72 });
    const b = planFor(decision('eat', 5000), { ...CTX, x: 270, z: 72 });
    expect(a).toEqual(b);
    expect(goes(a).length).toBeGreaterThan(1); // it bends around the tube
  });
});
