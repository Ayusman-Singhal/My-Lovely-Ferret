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
  /** Position of the ferret's feet, in logical px. */
  x: number;
  y: number;
  facing: 1 | -1;
  setCoat(coat: Coat): void;
  /** Ask for a redraw, for example after a state change while everything was settled. */
  requestFrame(): void;
  destroy(): void;
}

/** Small movable things the controller owns and the scene draws. Plain data. */
export interface ScenePropsState {
  /** The sock lies on the floor at x, or the pet carries it. */
  sock: { x: number; carried: boolean };
  /** The toy in the mini-game, on the floor at x. */
  toy: { id: ToyId; x: number } | null;
  /** 1 at the start of the mini-game down to 0 at the end, null outside it. */
  timerFraction: number | null;
}

/** Pointer events in logical room coordinates (360 by 540), with real timestamps. */
export interface ScenePointer {
  down(x: number, y: number, realMs: number): void;
  move(x: number, y: number, realMs: number): void;
  up(realMs: number): void;
}
