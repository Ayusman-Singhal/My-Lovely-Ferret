// Turns a PetAI decision into concrete steps in the room: where to walk, which animation to
// play, how long to stay. Pure, so it is tested without a canvas. PetAI stays geometry-free:
// it only hands over "spots" (0..999), and this file maps them to positions on the floor.

import type { Decision } from '../core/petAI';
import type { AnimationName } from './clipSpec';
import { ROOM } from './layout';

/** The floor rectangle the pet's feet may roam, from layout.ts. Furniture stands outside it. */
export const WALK_MIN_X = ROOM.minX;
export const WALK_MAX_X = ROOM.maxX;
export const WALK_MIN_Z = ROOM.minZ;
export const WALK_MAX_Z = ROOM.maxZ;

/** How far outside a tunnel mouth the pet starts and ends, so its whole body is in view before and after. */
const TUNNEL_MARGIN = 28;
/** Radians per second of the body going round after its tail; negative is to the pet's right, where the clip curls. */
const TAIL_CHASE_SPIN = -5;

/** Nose reach ahead of the feet at the shown size (the model's nose is 0.34 m ahead), in px. */
const NOSE_REACH = 71;

/** Pixels per second. At 4.8 mm per px these are about 0.22, 0.72, and 0.12 m/s, a little over the clips' own paces (0.19, 0.6, 0.1 m/s), which the scene makes up by playing them a little faster. */
export const SPEED = { walk: 46, run: 150, sneak: 26 } as const;

export type ItemAction = 'pickSock' | 'dropSock' | 'pickBall' | 'dropBall';
/** The old name, from when the sock was the only thing the pet carried. */
export type SockAction = ItemAction;

export type Phase =
  | { kind: 'go'; anim: AnimationName; x: number; z: number; speed: number; face?: 1 | -1; startAction?: SockAction; endAction?: SockAction }
  | {
      kind: 'do';
      anim: AnimationName;
      ms: number;
      y?: number;
      z?: number;
      face?: 1 | -1;
      heading?: number;
      /** Turn on the spot at this many radians per second (negative is to the pet's right). */
      spin?: number;
      react?: AnimationName;
      startAction?: SockAction;
    };

export interface PlanContext {
  /** Where the pet is now. */
  x: number;
  z: number;
  /** Where the sock is on the floor. */
  sockX: number;
  sockZ: number;
  /** Where the ball is on the floor. */
  ballX: number;
  ballZ: number;
}

/** Map a 0..999 spot to a position the pet can walk to. */
export function spotToX(spot: number): number {
  return WALK_MIN_X + ((WALK_MAX_X - WALK_MIN_X) * spot) / 999;
}

/** Depth for a spot. Scrambled a little so the x and z a decision gets are not locked together. */
export function spotToZ(spot: number): number {
  const mixed = (spot * 7 + 331) % 1000;
  return WALK_MIN_Z + ((WALK_MAX_Z - WALK_MIN_Z) * mixed) / 999;
}

/** Feet position and facing so the nose reaches a prop at `propX`: one nose length away, on the inside. */
function standNear(propX: number): { x: number; face: 1 | -1 } {
  const face: 1 | -1 = propX < 180 ? -1 : 1;
  return { x: propX - face * NOSE_REACH, face };
}

// ------------------------------------------------------- obstacle avoidance
//
// Furniture the pet walks around, never through. Circles are furniture footprints
// inflated by half a ferret width; the play tunnel is a blocked rectangle whose mouth
// zones stay free so tunnel runs can enter. All coordinates are logical px. Waypoints
// below live in open floor; a test pins every lane edge clear of every obstacle, so a
// moved prop fails loudly instead of clipping quietly.

export interface ObstacleCircle {
  kind: 'circle';
  x: number;
  z: number;
  r: number;
}
export interface ObstacleRect {
  kind: 'rect';
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
export type Obstacle = ObstacleCircle | ObstacleRect;

export const OBSTACLES: readonly Obstacle[] = [
  { kind: 'circle', x: 38, z: 25, r: 46 }, // food bowl
  { kind: 'circle', x: 322, z: -25, r: 46 }, // water bowl
  { kind: 'circle', x: 313, z: 117, r: 50 }, // cushion
  { kind: 'circle', x: 32, z: -127, r: 48 }, // crate stack
  { kind: 'rect', x0: 63, x1: 251, z0: 31, z1: 169 }, // play tunnel (mouths free)
];

interface Waypoint {
  x: number;
  z: number;
}

/** Open-floor lane nodes the router travels through. */
export const LANE_NODES: readonly Waypoint[] = [
  { x: 120, z: -40 }, // 0 north-west
  { x: 180, z: -40 }, // 1 north-middle
  { x: 240, z: -40 }, // 2 north-east
  { x: 110, z: 0 }, // 3 center-west
  { x: 180, z: 0 }, // 4 center-middle
  { x: 270, z: 0 }, // 5 center-east
  { x: 270, z: 72 }, // 6 south-east, past the tube's east end
];

/** Lane edges, by node index. Every edge is pinned clear by a test. */
export const LANE_EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [3, 4],
  [4, 5],
  [0, 3],
  [1, 4],
  [2, 5],
  [5, 6],
];

const dist = (ax: number, az: number, bx: number, bz: number): number => Math.hypot(ax - bx, az - bz);

/** True when the segment stays out of every obstacle. */
export function segmentClear(ax: number, az: number, bx: number, bz: number): boolean {
  for (const o of OBSTACLES) {
    if (o.kind === 'circle') {
      // Distance from the circle center to the segment.
      const dx = bx - ax;
      const dz = bz - az;
      const len2 = dx * dx + dz * dz;
      const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((o.x - ax) * dx + (o.z - az) * dz) / len2));
      if (dist(o.x, o.z, ax + dx * t, az + dz * t) < o.r) return false;
    } else {
      if (segmentHitsRect(ax, az, bx, bz, o)) return false;
    }
  }
  return true;
}

/** True when the segment touches the rectangle (a 1 px margin keeps the body off the paint). */
function segmentHitsRect(ax: number, az: number, bx: number, bz: number, r: ObstacleRect): boolean {
  const x0 = r.x0 - 1;
  const x1 = r.x1 + 1;
  const z0 = r.z0 - 1;
  const z1 = r.z1 + 1;
  if (ax > x0 && ax < x1 && az > z0 && az < z1) return true;
  if (bx > x0 && bx < x1 && bz > z0 && bz < z1) return true;
  return (
    segmentsCross(ax, az, bx, bz, x0, z0, x1, z0) ||
    segmentsCross(ax, az, bx, bz, x1, z0, x1, z1) ||
    segmentsCross(ax, az, bx, bz, x1, z1, x0, z1) ||
    segmentsCross(ax, az, bx, bz, x0, z1, x0, z0)
  );
}

function segmentsCross(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number): boolean {
  const d = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx);
  if (d === 0) return false;
  const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / d;
  const u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / d;
  // Strictly interior: ending exactly on the margin line is arriving, not crossing.
  return t > 0 && t < 1 && u > 0 && u < 1;
}

/**
 * Push a target point out of every obstacle (for mapped spots and carried-item spots, so
 * in-place animations never play inside furniture). Points already free are untouched.
 * Clamped to the reach bounds the brain can actually arrive at, so a pushed target never
 * strands the pet mid-walk.
 */
export function freeSpot(x: number, z: number): Waypoint {
  const clampReach = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
  let px = clampReach(x, ROOM.reachMinX, ROOM.reachMaxX);
  let pz = clampReach(z, ROOM.reachMinZ, ROOM.reachMaxZ);
  for (let pass = 0; pass < 2; pass++) {
    for (const o of OBSTACLES) {
      if (o.kind === 'circle') {
        const d = dist(px, pz, o.x, o.z);
        if (d < o.r) {
          if (d === 0) {
            px = o.x + o.r + 1;
          } else {
            px = o.x + ((px - o.x) / d) * (o.r + 1);
            pz = o.z + ((pz - o.z) / d) * (o.r + 1);
          }
        }
      } else if (px > o.x0 && px < o.x1 && pz > o.z0 && pz < o.z1) {
        // Eject along the shallowest penetration, preferring to stay inside the
        // roaming area (a tap just inside the tube's corner stops at its edge,
        // not pages away outside the room).
        const options = [
          { x: px, z: o.z0 - 1 },
          { x: px, z: o.z1 + 1 },
          { x: o.x0 - 1, z: pz },
          { x: o.x1 + 1, z: pz },
        ];
        const inRoam = (p: { x: number; z: number }): boolean =>
          p.x >= WALK_MIN_X && p.x <= WALK_MAX_X && p.z >= WALK_MIN_Z && p.z <= WALK_MAX_Z;
        const costs = options.map((p) => dist(px, pz, p.x, p.z));
        let best = 0;
        for (let i = 1; i < options.length; i++) {
          const prev = options[best] as { x: number; z: number };
          const next = options[i] as { x: number; z: number };
          const prevCost = (costs[best] as number) + (inRoam(prev) ? 0 : 10000);
          const nextCost = (costs[i] as number) + (inRoam(next) ? 0 : 10000);
          if (nextCost < prevCost) best = i;
        }
        const chosen = options[best] as { x: number; z: number };
        px = chosen.x;
        pz = chosen.z;
      }
    }
    px = clampReach(px, ROOM.reachMinX, ROOM.reachMaxX);
    pz = clampReach(pz, ROOM.reachMinZ, ROOM.reachMaxZ);
  }
  return { x: px, z: pz };
}

/** Shortest lane path between two nodes (Dijkstra over 7 nodes; ties break by index, so plans are stable). */
function lanePath(from: number, to: number): number[] {
  const prev = new Array<number>(LANE_NODES.length).fill(-1);
  const cost = new Array<number>(LANE_NODES.length).fill(Infinity);
  const done = new Array<boolean>(LANE_NODES.length).fill(false);
  cost[from] = 0;
  for (;;) {
    let next = -1;
    for (let i = 0; i < LANE_NODES.length; i++) {
      if (!done[i] && (next === -1 || (cost[i] as number) < (cost[next] as number))) next = i;
    }
    if (next === -1 || next === to) break;
    done[next] = true;
    const a = LANE_NODES[next] as Waypoint;
    for (const [u, v] of LANE_EDGES) {
      if (u !== next && v !== next) continue;
      const other = u === next ? v : u;
      if (done[other]) continue;
      const b = LANE_NODES[other] as Waypoint;
      const c = (cost[next] as number) + dist(a.x, a.z, b.x, b.z);
      if (c < (cost[other] as number)) {
        cost[other] = c;
        prev[other] = next;
      }
    }
  }
  const path: number[] = [];
  let at: number | undefined = to;
  while (at !== undefined && at !== -1) {
    path.unshift(at);
    if (at === from) break;
    at = prev[at];
    if (path.length > LANE_NODES.length + 1) break;
  }
  return path[0] === from ? path : [];
}

/**
 * Walk from `from` to `to` without crossing furniture: straight when clear, otherwise in
 * through the lanes. Always ends exactly on `to`. Falls back to straight when no lane
 * path exists, which is today's behavior, never worse.
 */
export function routePoints(from: Waypoint, to: Waypoint): Waypoint[] {
  if (segmentClear(from.x, from.z, to.x, to.z)) return [to];
  let entry = -1;
  let entryD = Infinity;
  let exit = -1;
  let exitD = Infinity;
  for (let i = 0; i < LANE_NODES.length; i++) {
    const n = LANE_NODES[i] as Waypoint;
    const dFrom = dist(from.x, from.z, n.x, n.z);
    if (dFrom < entryD && segmentClear(from.x, from.z, n.x, n.z)) {
      entry = i;
      entryD = dFrom;
    }
    const dTo = dist(n.x, n.z, to.x, to.z);
    if (dTo < exitD && segmentClear(n.x, n.z, to.x, to.z)) {
      exit = i;
      exitD = dTo;
    }
  }
  if (entry !== -1 && exit !== -1) {
    const nodes = lanePath(entry, exit);
    if (nodes.length > 0) {
      const points = nodes.slice(1).map((i) => LANE_NODES[i] as Waypoint);
      points.push(to);
      return points;
    }
  }
  return [to];
}

export interface GoLeg {
  anim: AnimationName;
  speed: number;
  face?: 1 | -1;
  startAction?: SockAction;
  endAction?: SockAction;
}

/** One walk that may bend around furniture: the first leg carries startAction, the last carries face and endAction. */
export function via(from: Waypoint, to: Waypoint, leg: GoLeg): Phase[] {
  const points = routePoints(from, to);
  return points.map((p, i) => {
    const phase: Phase = { kind: 'go', anim: leg.anim, x: p.x, z: p.z, speed: leg.speed };
    if (i === 0 && leg.startAction !== undefined) phase.startAction = leg.startAction;
    if (i === points.length - 1) {
      if (leg.face !== undefined) phase.face = leg.face;
      if (leg.endAction !== undefined) phase.endAction = leg.endAction;
    }
    return phase;
  });
}

/** Where a stolen sock is stashed: in front of the hammock, or the far back corner if it is already there. */
export function stashSpot(sockX: number): { x: number; z: number } {
  return sockX > 150 ? { x: WALK_MIN_X + 6, z: WALK_MIN_Z + 6 } : { x: ROOM.hammockX, z: ROOM.hammockApproachZ };
}

export function planFor(decision: Decision, ctx: PlanContext): Phase[] {
  const [s0, s1, s2] = decision.spots;
  const from = { x: ctx.x, z: ctx.z };
  const spot = (sx: number, sz: number): Waypoint => freeSpot(spotToX(sx), spotToZ(sz));
  switch (decision.behavior) {
    case 'idle':
      return [{ kind: 'do', anim: 'idle', ms: decision.durationMs }];

    case 'wander': {
      const to = spot(s0, s1);
      return via(from, to, { anim: 'walk', speed: SPEED.walk });
    }

    case 'sniff': {
      const to = spot(s0, s2);
      return [...via(from, to, { anim: 'walk', speed: SPEED.walk }), { kind: 'do', anim: 'sniff', ms: decision.durationMs }];
    }

    case 'curious': {
      const at = standNear(ctx.ballX);
      const to = freeSpot(clampX(at.x), clampZ(ctx.ballZ));
      return [
        ...via(from, to, { anim: 'walk', speed: SPEED.walk, face: at.face }),
        { kind: 'do', anim: 'curious', ms: decision.durationMs, face: at.face },
      ];
    }

    case 'eat': {
      const at = standNear(ROOM.foodBowlX);
      const to = freeSpot(at.x, ROOM.foodBowlZ);
      return [
        ...via(from, to, { anim: 'walk', speed: SPEED.walk, face: at.face }),
        { kind: 'do', anim: 'eat', ms: decision.durationMs, face: at.face },
      ];
    }

    case 'drink': {
      const at = standNear(ROOM.waterBowlX);
      const to = freeSpot(at.x, ROOM.waterBowlZ);
      return [
        ...via(from, to, { anim: 'walk', speed: SPEED.walk, face: at.face }),
        { kind: 'do', anim: 'drink', ms: decision.durationMs, face: at.face },
      ];
    }

    case 'playful': {
      const p1 = spot(s0, s1);
      const p2 = spot(s1, s2);
      const p3 = spot(s2, s0);
      return [
        ...via(from, p1, { anim: 'run', speed: SPEED.run }),
        ...via(p1, p2, { anim: 'run', speed: SPEED.run }),
        ...via(p2, p3, { anim: 'run', speed: SPEED.run }),
        { kind: 'do', anim: 'idle', ms: 400, react: 'happy' },
      ];
    }

    case 'steal': {
      const stashRaw = stashSpot(ctx.sockX);
      const stash = freeSpot(stashRaw.x, stashRaw.z);
      const sock = freeSpot(ctx.sockX, ctx.sockZ);
      return [
        ...via(from, sock, { anim: 'walk', speed: SPEED.walk }),
        { kind: 'do', anim: 'idle', ms: 500 },
        ...via(sock, stash, { anim: 'sneak', speed: SPEED.sneak, startAction: 'pickSock', endAction: 'dropSock' }),
        { kind: 'do', anim: 'idle', ms: 700 },
      ];
    }

    case 'stretch':
      return [{ kind: 'do', anim: 'stretch', ms: decision.durationMs }];

    case 'dig': {
      const to = spot(s0, s1);
      return [
        ...via(from, to, { anim: 'walk', speed: SPEED.walk }),
        { kind: 'do', anim: 'dig', ms: decision.durationMs },
        { kind: 'do', anim: 'idle', ms: 600 },
      ];
    }

    case 'tunnel': {
      // In at the nearer mouth, out of the other one at a run, then a pleased look.
      const fromA = ctx.x < (ROOM.tunnelAX + ROOM.tunnelBX) / 2;
      const inX = fromA ? ROOM.tunnelAX : ROOM.tunnelBX;
      const outX = fromA ? ROOM.tunnelBX : ROOM.tunnelAX;
      const away = fromA ? -1 : 1; // outside a mouth is away from the middle of the tunnel
      return [
        { kind: 'go', anim: 'walk', x: inX + away * TUNNEL_MARGIN, z: ROOM.tunnelZ, speed: SPEED.walk },
        { kind: 'go', anim: 'run', x: outX - away * TUNNEL_MARGIN, z: ROOM.tunnelZ, speed: SPEED.run },
        { kind: 'do', anim: 'idle', ms: 700, react: 'happy' },
      ];
    }

    case 'dance': {
      const to = spot(s0, s1);
      return [
        ...via(from, to, { anim: 'walk', speed: SPEED.walk }),
        { kind: 'do', anim: 'warDance', ms: decision.durationMs },
        { kind: 'do', anim: 'idle', ms: 500 },
      ];
    }

    case 'tailchase':
      return [
        { kind: 'do', anim: 'tailChase', ms: decision.durationMs, spin: TAIL_CHASE_SPIN },
        { kind: 'do', anim: 'idle', ms: 500, react: 'surprise' },
      ];

    case 'sleep': {
      // Sleep in the hammock until the simulation wakes the pet: an endless step. First walk to the
      // front of the hammock, then step up into it.
      const approach = freeSpot(ROOM.hammockX, ROOM.hammockApproachZ);
      return [
        ...via(from, approach, { anim: 'walk', speed: SPEED.walk }),
        { kind: 'do', anim: 'sleep', ms: Infinity, y: ROOM.hammockRestY, z: ROOM.hammockZ, face: 1 },
      ];
    }
  }
}

// ---------------------------------------------------------------- plans the player starts by touching the room

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const clampX = (x: number): number => clamp(x, WALK_MIN_X, WALK_MAX_X);
export const clampZ = (z: number): number => clamp(z, WALK_MIN_Z, WALK_MAX_Z);

/** The pet comes to a spot the player tapped on the floor: a trot if it is far, then a happy look. */
export function callPlan(from: { x: number; z: number }, to: { x: number; z: number }): Phase[] {
  const tapped = freeSpot(clampX(to.x), clampZ(to.z));
  const far = Math.hypot(tapped.x - from.x, tapped.z - from.z) > 110;
  const speed = far ? SPEED.run : SPEED.walk;
  const anim = far ? 'run' : 'walk';
  return [...via(from, tapped, { anim, speed }), { kind: 'do', anim: 'idle', ms: 900, react: 'happy' }];
}

/** The pet chases the thrown ball, picks it up, brings it to the player, drops it, and looks pleased. */
export function fetchPlan(from: { x: number; z: number }, ball: { x: number; z: number }): Phase[] {
  const atBall = freeSpot(ball.x, ball.z);
  const drop = freeSpot(ROOM.fetchDropX, ROOM.fetchDropZ);
  return [
    ...via(from, atBall, { anim: 'run', speed: SPEED.run }),
    { kind: 'do', anim: 'idle', ms: 250, react: 'surprise', startAction: 'pickBall' },
    ...via(atBall, drop, { anim: 'walk', speed: SPEED.walk, endAction: 'dropBall' }),
    { kind: 'do', anim: 'idle', ms: 1200, react: 'happy' },
  ];
}

/** The shop is open: the pet comes to the middle of the room and stands facing the player. */
export function previewPlan(from: { x: number; z: number }): Phase[] {
  return [
    ...via(from, { x: PREVIEW_SPOT.x, z: PREVIEW_SPOT.z }, { anim: 'walk', speed: SPEED.walk }),
    // Facing the camera, which sits a little to the right of straight ahead (scene3d.ts CAMERA.yawDeg).
    { kind: 'do', anim: 'idle', ms: Infinity, heading: PREVIEW_HEADING },
  ];
}

/** Where, and which way, the pet stands while the shop is open. */
export const PREVIEW_SPOT = { x: 180, z: 24 } as const;
export const PREVIEW_HEADING = 0.5;

/** Tricks the player asks for (Part 1L.7). The pet stays where it is and turns to face the player. */
export function trickPlan(id: string): Phase[] {
  switch (id) {
    case 'sit_up':
      return [
        { kind: 'do', anim: 'idle', ms: 350, heading: PREVIEW_HEADING },
        { kind: 'do', anim: 'curious', ms: 2800, heading: PREVIEW_HEADING },
        { kind: 'do', anim: 'idle', ms: 500, react: 'happy' },
      ];
    case 'bow':
      return [
        { kind: 'do', anim: 'idle', ms: 350, heading: PREVIEW_HEADING },
        { kind: 'do', anim: 'stretch', ms: 3000, heading: PREVIEW_HEADING },
        { kind: 'do', anim: 'idle', ms: 500, react: 'happy' },
      ];
    case 'spin':
      return [
        { kind: 'do', anim: 'tailChase', ms: 2200, spin: TAIL_CHASE_SPIN },
        { kind: 'do', anim: 'idle', ms: 500, heading: PREVIEW_HEADING, react: 'happy' },
      ];
    case 'dance':
      return [
        { kind: 'do', anim: 'idle', ms: 350, heading: PREVIEW_HEADING },
        { kind: 'do', anim: 'warDance', ms: 2600, heading: PREVIEW_HEADING },
        { kind: 'do', anim: 'idle', ms: 500, react: 'happy' },
      ];
    default:
      return [{ kind: 'do', anim: 'idle', ms: 300 }];
  }
}

/** The pet goes to the wall under the window and looks up and out of it. */
export function windowPlan(from: { x: number; z: number }): Phase[] {
  const to = freeSpot(clampX(ROOM.windowX), WALK_MIN_Z);
  return [...via(from, to, { anim: 'walk', speed: SPEED.walk }), { kind: 'do', anim: 'curious', ms: 3500, heading: Math.PI }];
}
