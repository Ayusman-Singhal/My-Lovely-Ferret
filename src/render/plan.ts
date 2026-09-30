// Turns a PetAI decision into concrete steps in the room: where to walk, which animation to
// play, how long to stay. Pure, so it is tested without a canvas. PetAI stays geometry-free:
// it only hands over "spots" (0..999), and this file maps them to positions.

import type { Decision } from '../core/petAI';
import type { AnimationName } from './animations';
import { ROOM } from './room';

/** Range the pet's feet may be in so the whole pet, tail included, stays inside the 360 px room. */
export const WALK_MIN_X = 125;
export const WALK_MAX_X = 235;

/** Nose reach ahead of the feet at the drawn size, with the head down (see demo tuning in Part 1D). */
const NOSE_REACH = 105;

export const SPEED = { walk: 55, run: 170, sneak: 45 } as const;

export type SockAction = 'pickSock' | 'dropSock';

export type Phase =
  | { kind: 'go'; anim: AnimationName; x: number; speed: number; face?: 1 | -1; startAction?: SockAction; endAction?: SockAction }
  | { kind: 'do'; anim: AnimationName; ms: number; y?: number; face?: 1 | -1; react?: AnimationName; startAction?: SockAction };

export interface PlanContext {
  /** Where the pet is now. */
  x: number;
  /** Where the sock is on the floor. */
  sockX: number;
}

/** Map a 0..999 spot to a position the pet can walk to. */
export function spotToX(spot: number): number {
  return WALK_MIN_X + ((WALK_MAX_X - WALK_MIN_X) * spot) / 999;
}

/** Feet position and facing so the nose reaches a prop at `propX`. */
function standNear(propX: number): { x: number; face: 1 | -1 } {
  const face: 1 | -1 = propX < 180 ? -1 : 1;
  return { x: propX - face * NOSE_REACH, face };
}

/** Where a stolen sock is stashed: the hammock, or the far corner if it is already there. */
export function stashSpot(sockX: number): number {
  return sockX > 165 ? WALK_MIN_X + 5 : ROOM.hammockX;
}

export function planFor(decision: Decision, ctx: PlanContext): Phase[] {
  const [s0, s1, s2] = decision.spots;
  switch (decision.behavior) {
    case 'idle':
      return [{ kind: 'do', anim: 'idle', ms: decision.durationMs }];

    case 'wander':
      return [{ kind: 'go', anim: 'walk', x: spotToX(s0), speed: SPEED.walk }];

    case 'sniff':
      return [
        { kind: 'go', anim: 'walk', x: spotToX(s0), speed: SPEED.walk },
        { kind: 'do', anim: 'sniff', ms: decision.durationMs },
      ];

    case 'curious': {
      const at = standNear(ROOM.toyX);
      return [
        { kind: 'go', anim: 'walk', x: at.x, speed: SPEED.walk, face: at.face },
        { kind: 'do', anim: 'curious', ms: decision.durationMs, face: at.face },
      ];
    }

    case 'eat': {
      const at = standNear(ROOM.foodBowlX);
      return [
        { kind: 'go', anim: 'walk', x: at.x, speed: SPEED.walk, face: at.face },
        { kind: 'do', anim: 'eat', ms: decision.durationMs, face: at.face },
      ];
    }

    case 'drink': {
      const at = standNear(ROOM.waterBowlX);
      return [
        { kind: 'go', anim: 'walk', x: at.x, speed: SPEED.walk, face: at.face },
        { kind: 'do', anim: 'drink', ms: decision.durationMs, face: at.face },
      ];
    }

    case 'playful':
      return [
        { kind: 'go', anim: 'run', x: spotToX(s0), speed: SPEED.run },
        { kind: 'go', anim: 'run', x: spotToX(s1), speed: SPEED.run },
        { kind: 'go', anim: 'run', x: spotToX(s2), speed: SPEED.run },
        { kind: 'do', anim: 'idle', ms: 400, react: 'happy' },
      ];

    case 'steal':
      return [
        { kind: 'go', anim: 'walk', x: ctx.sockX, speed: SPEED.walk },
        { kind: 'do', anim: 'idle', ms: 500 },
        { kind: 'go', anim: 'sneak', x: stashSpot(ctx.sockX), speed: SPEED.sneak, startAction: 'pickSock', endAction: 'dropSock' },
        { kind: 'do', anim: 'idle', ms: 700 },
      ];

    case 'sleep':
      // Sleep in the hammock until the simulation wakes the pet: an endless step.
      return [
        { kind: 'go', anim: 'walk', x: ROOM.hammockX, speed: SPEED.walk },
        { kind: 'do', anim: 'sleep', ms: Infinity, y: ROOM.hammockRestY, face: 1 },
      ];
  }
}
