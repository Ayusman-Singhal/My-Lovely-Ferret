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

/** Nose reach ahead of the feet at the shown size (the model's nose is 0.34 m ahead), in px. */
const NOSE_REACH = 71;

/** Pixels per second. At 4.8 mm per px these are about 0.17, 0.6, and 0.1 m/s, the paces of the clips. */
export const SPEED = { walk: 36, run: 125, sneak: 22 } as const;

export type SockAction = 'pickSock' | 'dropSock';

export type Phase =
  | { kind: 'go'; anim: AnimationName; x: number; z: number; speed: number; face?: 1 | -1; startAction?: SockAction; endAction?: SockAction }
  | { kind: 'do'; anim: AnimationName; ms: number; y?: number; z?: number; face?: 1 | -1; react?: AnimationName; startAction?: SockAction };

export interface PlanContext {
  /** Where the pet is now. */
  x: number;
  z: number;
  /** Where the sock is on the floor. */
  sockX: number;
  sockZ: number;
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

/** Where a stolen sock is stashed: in front of the hammock, or the far back corner if it is already there. */
export function stashSpot(sockX: number): { x: number; z: number } {
  return sockX > 150 ? { x: WALK_MIN_X + 6, z: WALK_MIN_Z + 6 } : { x: ROOM.hammockX, z: ROOM.hammockApproachZ };
}

export function planFor(decision: Decision, ctx: PlanContext): Phase[] {
  const [s0, s1, s2] = decision.spots;
  switch (decision.behavior) {
    case 'idle':
      return [{ kind: 'do', anim: 'idle', ms: decision.durationMs }];

    case 'wander':
      return [{ kind: 'go', anim: 'walk', x: spotToX(s0), z: spotToZ(s1), speed: SPEED.walk }];

    case 'sniff':
      return [
        { kind: 'go', anim: 'walk', x: spotToX(s0), z: spotToZ(s2), speed: SPEED.walk },
        { kind: 'do', anim: 'sniff', ms: decision.durationMs },
      ];

    case 'curious': {
      const at = standNear(ROOM.toyX);
      return [
        { kind: 'go', anim: 'walk', x: at.x, z: ROOM.toyZ, speed: SPEED.walk, face: at.face },
        { kind: 'do', anim: 'curious', ms: decision.durationMs, face: at.face },
      ];
    }

    case 'eat': {
      const at = standNear(ROOM.foodBowlX);
      return [
        { kind: 'go', anim: 'walk', x: at.x, z: ROOM.foodBowlZ, speed: SPEED.walk, face: at.face },
        { kind: 'do', anim: 'eat', ms: decision.durationMs, face: at.face },
      ];
    }

    case 'drink': {
      const at = standNear(ROOM.waterBowlX);
      return [
        { kind: 'go', anim: 'walk', x: at.x, z: ROOM.waterBowlZ, speed: SPEED.walk, face: at.face },
        { kind: 'do', anim: 'drink', ms: decision.durationMs, face: at.face },
      ];
    }

    case 'playful':
      return [
        { kind: 'go', anim: 'run', x: spotToX(s0), z: spotToZ(s1), speed: SPEED.run },
        { kind: 'go', anim: 'run', x: spotToX(s1), z: spotToZ(s2), speed: SPEED.run },
        { kind: 'go', anim: 'run', x: spotToX(s2), z: spotToZ(s0), speed: SPEED.run },
        { kind: 'do', anim: 'idle', ms: 400, react: 'happy' },
      ];

    case 'steal': {
      const stash = stashSpot(ctx.sockX);
      return [
        { kind: 'go', anim: 'walk', x: ctx.sockX, z: ctx.sockZ, speed: SPEED.walk },
        { kind: 'do', anim: 'idle', ms: 500 },
        { kind: 'go', anim: 'sneak', x: stash.x, z: stash.z, speed: SPEED.sneak, startAction: 'pickSock', endAction: 'dropSock' },
        { kind: 'do', anim: 'idle', ms: 700 },
      ];
    }

    case 'sleep':
      // Sleep in the hammock until the simulation wakes the pet: an endless step. First walk to the
      // front of the hammock, then step up into it.
      return [
        { kind: 'go', anim: 'walk', x: ROOM.hammockX, z: ROOM.hammockApproachZ, speed: SPEED.walk },
        { kind: 'do', anim: 'sleep', ms: Infinity, y: ROOM.hammockRestY, z: ROOM.hammockZ, face: 1 },
      ];
  }
}
