// Game controller: the glue between the pet (core), what the player does (commands, touch,
// the mini-game) and what the player sees (the brain and the scene). It owns the pet, sends
// every change through the command layer (guide §18 rule 3), and never draws or touches the
// DOM itself. The UI calls dispatch() and reads getPet().

import { applyCommand, type Command, type CommandResult } from '../core/commands';
import type { AIWorld } from '../core/petAI';
import type { Clock } from '../core/time';
import { CHASE, bandFromCatches, createChase, stepChase, type ChaseState } from '../core/toyChase';
import { createTouchTracker } from '../core/touch';
import type { HistoryEvent, PetRecord, ToyId } from '../core/types';
import { createBrain, type Brain, type BrainScene } from '../render/brain';
import { VIEW } from '../render/palette';
import { drawSock, drawTimerBar, drawToy } from '../render/props';
import { ROOM } from '../render/room';

export interface PlayResult {
  band: 0 | 1 | 2 | 3;
  catches: number;
  result: CommandResult;
}

export interface GameOptions {
  pet: PetRecord;
  clock: Clock;
  /** Called after any change the UI should show (a command, a mini-game start or end). */
  onChange?(): void;
  onEvents?(events: HistoryEvent[]): void;
  onDecision?(pet: PetRecord): void;
  onPlayEnd?(result: PlayResult): void;
}

export interface MiniGameStatus {
  toyId: ToyId;
  remainingMs: number;
  catches: number;
}

export interface Game {
  readonly world: AIWorld;
  readonly brain: Brain;
  getPet(): PetRecord;
  /** Run a command through the command layer and show its effects. */
  dispatch(command: Command): CommandResult;
  /** StartPlay, and if the pet is willing, begin the toy-chase mini-game. */
  startPlay(toyId: ToyId): CommandResult;
  minigame(): MiniGameStatus | null;
  /** Raw mini-game state for the debug overlay and scripts. */
  debugChase(): { toyTarget: number; chase: ChaseState | null };
  /** Scene hooks. */
  tick(frameMs: number, scene: BrainScene): void;
  draw(ctx: CanvasRenderingContext2D): void;
  /**
   * Pointer input in logical room coordinates. Times are real milliseconds (event.timeStamp), not
   * game time, so a long press lasts 2 real seconds even when the preview runs the game faster.
   */
  pointerDown(x: number, y: number, realMs: number): void;
  pointerMove(x: number, y: number): void;
  pointerUp(realMs: number): void;
}

/** Where a touch counts as touching the pet, around its feet position. */
const PET_HIT = { halfWidth: 120, top: 110, bottom: 12 } as const;

const clampToy = (x: number): number => Math.min(300, Math.max(60, x));

function hitsPet(scene: BrainScene, x: number, y: number): boolean {
  return Math.abs(x - scene.x) <= PET_HIT.halfWidth && y >= scene.y - PET_HIT.top && y <= scene.y + PET_HIT.bottom;
}

export function createGame(options: GameOptions): Game {
  let pet = options.pet;
  const world: AIWorld = { foodInBowl: false, waterInBowl: false, hasToy: true, hasStealable: true, propNearby: false, pointerInRoom: false };
  const touch = createTouchTracker();
  let lastScene: BrainScene | null = null;

  let chase: ChaseState | null = null;
  let chaseToy: ToyId = 'ball';
  let toyTarget = 180;
  let lastFrame = 0;
  let pressingPet = false;

  const brain = createBrain({
    pet: { get: () => pet, set: (p) => (pet = p) },
    clock: options.clock,
    world,
    onDecision: () => options.onDecision?.(pet),
    onEvents: (e) => options.onEvents?.(e),
  });

  const dispatch = (command: Command): CommandResult => {
    const result = applyCommand(pet, command, options.clock.nowMs());
    pet = result.pet;
    if (result.events.length > 0) options.onEvents?.(result.events);
    const o = result.outcome;
    if (o.reaction) brain.react(o.reaction);
    if (o.ok && o.stock === 'food') {
      world.foodInBowl = true;
      brain.request('eat');
    }
    if (o.ok && o.stock === 'water') {
      world.waterInBowl = true;
      brain.request('drink');
    }
    options.onChange?.();
    return result;
  };

  const finishPlay = (scene: BrainScene, frameMs: number): void => {
    const played = chase as ChaseState;
    const band = bandFromCatches(played.catches);
    const result = dispatch({ type: 'FinishPlay', band });
    chase = null;
    scene.y = ROOM.groundY;
    scene.animator.setBase('idle', frameMs);
    brain.setPaused(false);
    options.onPlayEnd?.({ band, catches: played.catches, result });
    options.onChange?.();
  };

  return {
    world,
    brain,
    getPet: () => pet,
    dispatch,

    startPlay(toyId) {
      const result = dispatch({ type: 'StartPlay', toyId });
      if (result.outcome.ok && lastScene) {
        chaseToy = toyId;
        toyTarget = clampToy(lastScene.x + lastScene.facing * 60);
        chase = createChase(lastScene.x, toyTarget);
        lastScene.y = ROOM.groundY;
        brain.setPaused(true);
        options.onChange?.();
      }
      return result;
    },

    debugChase: () => ({ toyTarget, chase }),

    minigame: () =>
      chase ? { toyId: chaseToy, remainingMs: Math.max(0, CHASE.durationMs - chase.elapsedMs), catches: chase.catches } : null,

    tick(frameMs, scene) {
      lastScene = scene;
      const dt = lastFrame === 0 ? 0 : Math.min(100, frameMs - lastFrame);
      lastFrame = frameMs;
      if (!chase) {
        brain.tick(frameMs, scene);
        return;
      }
      const before = scene.x;
      chase = stepChase(chase, dt, toyTarget);
      scene.x = chase.ferretX;
      scene.facing = chase.facing;
      const moved = Math.abs(chase.ferretX - before) > 0.05;
      scene.animator.setBase(chase.pauseMs > 0 ? 'idle' : moved ? 'run' : 'curious', frameMs);
      if (chase.justCaught) scene.animator.react('happy', frameMs);
      if (chase.over) finishPlay(scene, frameMs);
    },

    draw(ctx) {
      if (!chase) {
        if (!brain.sock.carried) drawSock(ctx, brain.sock.x, ROOM.groundY);
        return;
      }
      drawToy(ctx, chaseToy, toyTarget, ROOM.groundY);
      drawTimerBar(ctx, Math.max(0, 1 - chase.elapsedMs / CHASE.durationMs), VIEW.width);
    },

    pointerDown(x, y, realMs) {
      if (chase) {
        toyTarget = clampToy(x);
        return;
      }
      if (lastScene && hitsPet(lastScene, x, y)) {
        pressingPet = true;
        touch.down(realMs);
      }
    },

    pointerMove(x) {
      if (chase) toyTarget = clampToy(x);
    },

    pointerUp(realMs) {
      if (chase || !pressingPet) return;
      pressingPet = false;
      const { session } = touch.up(realMs);
      dispatch({ type: 'PetTouch', session });
    },
  };
}
