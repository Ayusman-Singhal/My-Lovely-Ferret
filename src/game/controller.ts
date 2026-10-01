// Game controller: the glue between the pet (core), what the player does (commands, touch,
// the mini-game) and what the player sees (the brain and the scene). It owns the pet, sends
// every change through the command layer (guide §18 rule 3), and never draws or touches the
// DOM itself. The UI calls dispatch() and reads getPet().

import { applyCommand, type Command, type CommandResult } from '../core/commands';
import type { AIWorld } from '../core/petAI';
import { hashString } from '../core/rng';
import type { Clock } from '../core/time';
import { CHASE, bandFromCatches, createChase, stepChase, type ChaseState } from '../core/toyChase';
import { createTouchTracker } from '../core/touch';
import type { HistoryEvent, PetRecord, ToyId } from '../core/types';
import { createBrain, type Brain, type BrainScene } from '../render/brain';
import { ROOM } from '../render/layout';
import type { PickTarget, SceneHit, ScenePropsState } from '../render/petScene';
import { callPlan, clampX, clampZ, fetchPlan, previewPlan, windowPlan } from '../render/plan';

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
  /** Called after every command, from a button or from touching the pet. */
  onCommand?(command: Command, result: CommandResult): void;
  /**
   * The pet changed without a command (the simulation moved time on). At most once a second, so
   * the UI can refresh the meters and the autosave can run without a timer.
   */
  onPetChange?(): void;
  onPlayEnd?(result: PlayResult): void;
  /** The player tapped a thing in the room that is also a button: the bowls and the hammock. */
  onTarget?(target: 'foodBowl' | 'waterBowl' | 'hammock'): void;
  /** The player touched the room itself, for the counters and the first-time hints. */
  onRoomTouch?(kind: RoomTouch): void;
}

export type RoomTouch = 'call' | 'fetch' | 'window';

export interface MiniGameStatus {
  toyId: ToyId;
  remainingMs: number;
  catches: number;
}

export interface Game {
  readonly world: AIWorld;
  readonly brain: Brain;
  getPet(): PetRecord;
  /** Dev panel only (guide §25.7): put a changed pet in place of the current one. */
  replacePet(next: PetRecord): void;
  /** Run a command through the command layer and show its effects. */
  dispatch(command: Command): CommandResult;
  /** StartPlay, and if the pet is willing, begin the toy-chase mini-game. */
  startPlay(toyId: ToyId): CommandResult;
  minigame(): MiniGameStatus | null;
  /** Raw mini-game state for the debug overlay and scripts. */
  debugChase(): { toyTarget: number; chase: ChaseState | null };
  /** Scene hooks. */
  tick(frameMs: number, scene: BrainScene): void;
  /** What the scene should draw besides the room and the pet: the sock, the toy, and the timer. */
  props(): ScenePropsState;
  /** The shop is open on a tab (or closed, null): the camera shows what the pet wears, or the whole room. */
  setPreview(mode: 'pet' | 'room' | null): void;
  /**
   * Pointer input in logical room coordinates. Times are real milliseconds (event.timeStamp), not
   * game time, so a long press lasts 2 real seconds even when the preview runs the game faster.
   */
  pointerDown(x: number, y: number, realMs: number, hit?: SceneHit): void;
  pointerMove(x: number, y: number, hit?: SceneHit): void;
  pointerUp(realMs: number, hit?: SceneHit): void;
}

/** Where a touch counts as touching the pet, around its feet position. */
const PET_HIT = { halfWidth: 80, top: 62, bottom: 12 } as const;

const clampToy = (x: number): number => Math.min(284, Math.max(76, x));

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
  let preview: 'pet' | 'room' | null = null;
  // Touching the room (Part 1L.2): a tap on the floor calls the pet, a tap on the ball throws it, a
  // drag moves the ball or the sock, a tap on the window makes the pet look out, a tap on a bowl or
  // the hammock is the same as the button.
  let dragging: 'ball' | 'sock' | null = null;
  let dragMoved = false;
  let dragFrom: { x: number; z: number } | null = null;
  let tap: SceneHit | null = null;
  let marker: { x: number; z: number; startMs: number } | null = null;
  let flight: { fromX: number; fromZ: number; startMs: number } | null = null;
  let throws = 0;
  /** A touch that began during the mini-game is the toy's, even if the game ends before the finger lifts. */
  let gameTouch = false;
  let petChanged = false;
  let lastNotify = 0;

  const brain = createBrain({
    pet: {
      get: () => pet,
      set: (p) => {
        pet = p;
        petChanged = true;
      },
    },
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
    options.onCommand?.(command, result);
    options.onChange?.();
    return result;
  };

  /** Progress of the ball in the air, 0 to 1, or null when it has landed. */
  const flightNow = (): { fromX: number; fromZ: number; t: number } | null => {
    if (!flight) return null;
    const t = (lastFrame - flight.startMs) / 650;
    if (t >= 1) {
      flight = null;
      return null;
    }
    return { fromX: flight.fromX, fromZ: flight.fromZ, t: Math.max(0, t) };
  };
  const markerNow = (): { x: number; z: number; t: number } | null => {
    if (!marker) return null;
    const t = (lastFrame - marker.startMs) / 700;
    if (t >= 1) {
      marker = null;
      return null;
    }
    return { x: marker.x, z: marker.z, t: Math.max(0, t) };
  };
  const awake = (): boolean => pet.state.sleepState === 'awake';

  /** Throw the ball somewhere on the floor and send the pet after it. */
  const throwBall = (): void => {
    if (!awake() || brain.ball.carried) return;
    throws += 1;
    const h = hashString(`${pet.pet.id}|throw|${throws}`);
    const x = clampX(ROOM.minX + ((h % 1000) / 999) * (ROOM.maxX - ROOM.minX));
    const z = clampZ(ROOM.minZ + (((h >>> 10) % 1000) / 999) * (ROOM.maxZ - ROOM.minZ));
    flight = { fromX: brain.ball.x, fromZ: brain.ball.z, startMs: lastFrame };
    brain.ball.x = x;
    brain.ball.z = z;
    brain.script(fetchPlan({ x, z }));
    options.onRoomTouch?.('fetch');
  };

  const handleTap = (hit: SceneHit): void => {
    if (hit.target === 'foodBowl' || hit.target === 'waterBowl' || hit.target === 'hammock') {
      options.onTarget?.(hit.target);
      return;
    }
    if (!awake()) return; // a sleeping pet is not called
    if (hit.target === 'window') {
      brain.script(windowPlan());
      options.onRoomTouch?.('window');
      return;
    }
    if (hit.floor && lastScene) {
      marker = { x: clampX(hit.floor.x), z: clampZ(hit.floor.z), startMs: lastFrame };
      brain.script(callPlan({ x: lastScene.x, z: lastScene.z }, hit.floor));
      options.onRoomTouch?.('call');
    }
  };

  const finishPlay = (scene: BrainScene, frameMs: number): void => {
    const played = chase as ChaseState;
    const band = bandFromCatches(played.catches);
    const result = dispatch({ type: 'FinishPlay', band });
    chase = null;
    scene.y = ROOM.groundY;
    scene.heading = null;
    scene.animator.setBase('idle', frameMs);
    brain.setPaused(false);
    options.onPlayEnd?.({ band, catches: played.catches, result });
    options.onChange?.();
  };

  return {
    world,
    brain,
    getPet: () => pet,
    replacePet(next) {
      pet = next;
      petChanged = true;
      options.onChange?.();
    },
    dispatch,

    startPlay(toyId) {
      const result = dispatch({ type: 'StartPlay', toyId });
      if (result.outcome.ok && lastScene) {
        chaseToy = toyId;
        toyTarget = clampToy(lastScene.x + lastScene.facing * 60);
        chase = createChase(lastScene.x, toyTarget);
        lastScene.y = ROOM.groundY;
        lastScene.z = ROOM.chaseZ;
        lastScene.heading = null;
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
      if (petChanged && frameMs - lastNotify >= 1000) {
        petChanged = false;
        lastNotify = frameMs;
        options.onPetChange?.();
      }
      if (!chase) {
        brain.tick(frameMs, scene);
        return;
      }
      const before = scene.x;
      chase = stepChase(chase, dt, toyTarget);
      scene.x = chase.ferretX;
      scene.z = ROOM.chaseZ;
      scene.facing = chase.facing;
      scene.heading = null;
      const moved = Math.abs(chase.ferretX - before) > 0.05;
      scene.animator.setBase(chase.pauseMs > 0 ? 'idle' : moved ? 'run' : 'curious', frameMs);
      if (chase.justCaught) scene.animator.react('happy', frameMs);
      if (chase.over) finishPlay(scene, frameMs);
    },

    setPreview(mode) {
      const was = preview;
      preview = mode;
      if (chase || was === mode) return;
      // On the pet tab it comes to the middle and faces the player. Leaving it, it carries on with its day.
      if (mode === 'pet') brain.script(previewPlan());
      else if (was === 'pet') brain.script([{ kind: 'do', anim: 'idle', ms: 200 }]);
    },

    props() {
      return {
        sock: { x: brain.sock.x, z: brain.sock.z, carried: brain.sock.carried },
        ball: { x: brain.ball.x, z: brain.ball.z, carried: brain.ball.carried, flight: flightNow() },
        marker: markerNow(),
        outfit: pet.inventory.equipped,
        preview,
        toy: chase ? { id: chaseToy, x: toyTarget } : null,
        timerFraction: chase ? Math.max(0, 1 - chase.elapsedMs / CHASE.durationMs) : null,
        pressing: pressingPet,
      };
    },

    pointerDown(x, y, realMs, hit) {
      if (chase) {
        gameTouch = true;
        toyTarget = clampToy(x);
        return;
      }
      if (lastScene && hitsPet(lastScene, x, y)) {
        pressingPet = true;
        touch.down(realMs);
        return;
      }
      const target: PickTarget | null = hit?.target ?? null;
      if ((target === 'ball' && !brain.ball.carried) || (target === 'sock' && !brain.sock.carried)) {
        dragging = target as 'ball' | 'sock';
        dragMoved = false;
        dragFrom = hit?.floor ?? null;
        tap = null;
      } else {
        tap = hit ?? null;
      }
    },

    pointerMove(x, _y, hit) {
      if (chase) {
        toyTarget = clampToy(x);
        return;
      }
      if (dragging && hit?.floor) {
        if (!dragMoved && dragFrom && Math.hypot(hit.floor.x - dragFrom.x, hit.floor.z - dragFrom.z) < 10) return;
        dragMoved = true;
        const item = dragging === 'ball' ? brain.ball : brain.sock;
        if (!item.carried) {
          item.x = Math.min(330, Math.max(30, hit.floor.x));
          item.z = Math.min(110, Math.max(-110, hit.floor.z));
        }
      }
    },

    pointerUp(realMs, hit) {
      if (chase) return;
      if (gameTouch) {
        gameTouch = false;
        return;
      }
      if (pressingPet) {
        pressingPet = false;
        const { session } = touch.up(realMs);
        dispatch({ type: 'PetTouch', session });
        return;
      }
      if (dragging) {
        const was = dragging;
        dragging = null;
        // A tap on the ball (no drag) throws it; a tap on the sock makes the pet look at it.
        if (!dragMoved) {
          if (was === 'ball') throwBall();
          else if (awake()) brain.react('surprise');
        }
        return;
      }
      const landed = tap ?? hit ?? null;
      tap = null;
      if (landed) handleTap(landed);
    },
  };
}
