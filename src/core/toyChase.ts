// The toy-chase mini-game (docs/GAME_DESIGN.md §7, guide §7.8). About 20 seconds. The player
// drags a toy along the floor and the ferret chases it and pounces. Pure and deterministic:
// the view feeds in the pointer position each frame and draws the result. Only the coarse
// band 0..3 leaves the game, never the raw score.

import { clamp } from './fixed';

export const CHASE = {
  durationMs: 20_000,
  /** How fast the ferret runs after the toy, px per second. Slower than a hand can drag. */
  ferretSpeed: 120,
  /** The paws reach this far ahead of the ferret's feet position (about 0.3 m at 4.8 mm per px). */
  pawReach: 62,
  /** A pounce lands when the paws are this close to the toy. */
  catchRadius: 28,
  /** The toy must be nearly still to be caught. px per second, smoothed. */
  slowToySpeed: 70,
  /**
   * After a catch the toy must be dragged this far in total (path length, px) before it can be
   * caught again, so holding it still never farms catches. Path length, not distance from a spot:
   * a spot rule stranded players whose drags straddled the last catch, and a rule based on the
   * paws breaks when the ferret turns around (found in a real browser run, Part 1F).
   */
  rearmDistance: 80,
  /** Pause after a catch while the ferret pounces. */
  catchPauseMs: 700,
  /** The ferret keeps its whole body inside the room between these positions. */
  minX: 96,
  maxX: 264,
  /** The ferret turns around only when the toy is this far past its middle, so it does not flicker. */
  turnDeadZone: 15,
} as const;

export interface ChaseState {
  elapsedMs: number;
  ferretX: number;
  facing: 1 | -1;
  toyX: number;
  /** Smoothed toy speed in px per second. */
  toySpeed: number;
  catches: number;
  /** False after a catch until the toy has been dragged far enough. */
  armed: boolean;
  /** Toy path length since the last catch, while not armed. */
  travel: number;
  /** Counts down after a catch. */
  pauseMs: number;
  /** True during the frame a catch happened, so the view can play the pounce. */
  justCaught: boolean;
  over: boolean;
}

export function createChase(ferretX: number, toyX: number): ChaseState {
  return {
    elapsedMs: 0,
    ferretX: clamp(ferretX, CHASE.minX, CHASE.maxX),
    facing: toyX >= ferretX ? 1 : -1,
    toyX,
    toySpeed: 0,
    catches: 0,
    armed: true,
    travel: 0,
    pauseMs: 0,
    justCaught: false,
    over: false,
  };
}

/** Coarse result for FinishPlay (docs/GAME_DESIGN.md §7). */
export function bandFromCatches(catches: number): 0 | 1 | 2 | 3 {
  if (catches >= 8) return 3;
  if (catches >= 5) return 2;
  if (catches >= 2) return 1;
  return 0;
}

/** Advance the game by `dtMs`, with the toy now at `toyX` (the pointer, already clamped by the view). */
export function stepChase(state: ChaseState, dtMs: number, toyX: number): ChaseState {
  if (state.over || dtMs <= 0) return { ...state, justCaught: false };

  const elapsedMs = state.elapsedMs + dtMs;
  const instant = (Math.abs(toyX - state.toyX) / dtMs) * 1000;
  const toySpeed = state.toySpeed * 0.5 + instant * 0.5;

  // Face the toy, with a dead zone so a toy near the middle does not make the ferret flip every frame.
  let facing = state.facing;
  if (toyX - state.ferretX > CHASE.turnDeadZone) facing = 1;
  else if (state.ferretX - toyX > CHASE.turnDeadZone) facing = -1;

  // At the edge of the floor the ferret cannot stand on the far side of the toy. Then it turns round
  // and comes at the toy from the middle of the room, so its paws can still reach it.
  const wanted = (side: 1 | -1): number => toyX - side * CHASE.pawReach;
  const reachable = (x: number): boolean => x >= CHASE.minX && x <= CHASE.maxX;
  if (!reachable(wanted(facing)) && reachable(wanted(facing === 1 ? -1 : 1))) facing = facing === 1 ? -1 : 1;

  let ferretX = state.ferretX;
  let pauseMs = Math.max(0, state.pauseMs - dtMs);
  if (pauseMs === 0) {
    const desired = clamp(wanted(facing), CHASE.minX, CHASE.maxX);
    const step = (CHASE.ferretSpeed * dtMs) / 1000;
    ferretX = Math.abs(desired - ferretX) <= step ? desired : ferretX + Math.sign(desired - ferretX) * step;
  }

  let armed = state.armed;
  let travel = state.travel;
  if (!armed) {
    travel += Math.abs(toyX - state.toyX);
    if (travel >= CHASE.rearmDistance) {
      armed = true;
      travel = 0;
    }
  }
  const paw = ferretX + facing * CHASE.pawReach;

  let catches = state.catches;
  let justCaught = false;
  if (pauseMs === 0 && armed && toySpeed <= CHASE.slowToySpeed && Math.abs(paw - toyX) <= CHASE.catchRadius) {
    catches++;
    justCaught = true;
    armed = false;
    travel = 0;
    pauseMs = CHASE.catchPauseMs;
  }

  return {
    elapsedMs,
    ferretX,
    facing,
    toyX,
    toySpeed,
    catches,
    armed,
    travel,
    pauseMs,
    justCaught,
    over: elapsedMs >= CHASE.durationMs,
  };
}
