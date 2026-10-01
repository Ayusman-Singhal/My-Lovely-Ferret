// What the game needs from a scene, whatever draws it. The brain moves `x`, `y`, `facing` (logical
// px) and asks for clips; the controller reads the same. Keeping this small is what let the
// renderer change from 2D to 3D without touching PetAI, the plan, or the mini-game.

import type { Coat, ToyId } from '../core/types';
import type { AnimationName } from './clipSpec';

export interface PetAnimator {
  /** Set the looping base clip. Does nothing if it is already playing. */
  setBase(name: AnimationName, nowMs: number): void;
  /** Play a one-shot on top of the base. It hands back to the base when it ends. */
  react(name: AnimationName, nowMs: number): void;
  /** Name of the base clip. */
  current(): AnimationName;
}

export interface PetScene {
  readonly animator: PetAnimator;
  /** Position of the ferret's feet, in logical px (layout.ts): x across, z in depth, y the lift above the floor. */
  x: number;
  y: number;
  z: number;
  facing: 1 | -1;
  /** Direction of travel in radians, or null to face left or right by `facing`. */
  heading: number | null;
  setCoat(coat: Coat): void;
  /** Ask for a redraw, for example after a state change while everything was settled. */
  requestFrame(): void;
  destroy(): void;
}

/** A thing in the room the player can touch. */
export type PickTarget = 'window' | 'foodBowl' | 'waterBowl' | 'hammock' | 'ball' | 'sock';

/** What a touch landed on besides the pet: the floor spot under the finger, and the thing, if any. */
export interface SceneHit {
  /** Logical px on the floor (x across, z in depth), or null if the finger is not over the floor. */
  floor: { x: number; z: number } | null;
  target: PickTarget | null;
}

/** Small movable things the controller owns and the scene draws. Plain data. */
export interface ScenePropsState {
  /** The sock lies on the floor at x, or the pet carries it. */
  sock: { x: number; z: number; carried: boolean };
  /** The ball. `flight` is set while it is in the air after a throw, t from 0 to 1. */
  ball: { x: number; z: number; carried: boolean; flight: { fromX: number; fromZ: number; t: number } | null };
  /** What the pet is wearing, by item id (docs/GAME_DESIGN.md, Part 1L.5). */
  outfit: readonly string[];
  /** The shop is open: the camera comes close to show the pet, a little higher on screen. */
  preview: boolean;
  /** A ring where the player tapped the floor, t from 0 (just now) to 1 (gone). */
  marker: { x: number; z: number; t: number } | null;
  /** The toy in the mini-game, on the floor at x. */
  toy: { id: ToyId; x: number } | null;
  /** 1 at the start of the mini-game down to 0 at the end, null outside it. */
  timerFraction: number | null;
  /** The player is pressing the pet, so the camera moves in close. */
  pressing: boolean;
}

/** Pointer events in logical room coordinates (360 by 540), with real timestamps. */
export interface ScenePointer {
  down(x: number, y: number, realMs: number, hit: SceneHit): void;
  move(x: number, y: number, realMs: number, hit: SceneHit): void;
  up(realMs: number, hit: SceneHit): void;
}
