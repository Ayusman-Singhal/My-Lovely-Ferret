// The link between the game and the picture: it asks PetAI what to do, runs the resulting
// steps (walk here, play this animation), keeps the simulation up to date while the app is
// open, and moves the pet to bed when the simulation says it is asleep. It moves the
// scene's pet but draws nothing itself. Replaces the temporary demo brain of Part 1D.

import { completeBehavior, createAIState, forceDecision, nextDecision, type AIState, type AIWorld, type Behavior, type Decision } from '../core/petAI';
import { simulate } from '../core/simulate';
import type { Clock } from '../core/time';
import type { HistoryEvent, PetRecord } from '../core/types';
import type { AnimationName } from './clipSpec';
import { ROOM } from './layout';
import { planFor, type Phase, type SockAction } from './plan';

/** The part of the scene the brain moves. Kept small so the brain is tested without a canvas. */
/** Time away that counts as the player being gone (docs/GAME_DESIGN.md §8). */
export const AWAY_MS = 30 * 60_000;

/** Walking starts and stops gently over this long, so the pet does not jerk into and out of its pace. */
const EASE_IN_MS = 350;
const EASE_OUT_MS = 500;
/** Never slower than this share of the pace, so a walk always arrives. */
const MIN_PACE = 0.2;
const smooth = (k: number): number => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

export interface BrainScene {
  x: number;
  y: number;
  /** Depth on the floor: negative toward the back wall (layout.ts). */
  z: number;
  facing: 1 | -1;
  /** Direction of travel in radians (0 = toward the camera, pi/2 = right), or null to face left or right by `facing`. */
  heading: number | null;
  animator: { setBase(name: AnimationName, nowMs: number): void; react(name: AnimationName, nowMs: number): void };
}

export interface BrainOptions {
  pet: { get(): PetRecord; set(pet: PetRecord): void };
  /** The game clock (wall time in epoch ms). Time of day and the simulation use this. */
  clock: Clock;
  /** What is in the room. The brain empties a bowl when the pet has eaten or drunk from it. */
  world: AIWorld;
  onDecision?(decision: Decision, pet: PetRecord): void;
  onEvents?(events: HistoryEvent[]): void;
}

export interface Brain {
  tick(frameMs: number, scene: BrainScene): void;
  /** The sock lies on the floor here, or is being carried. Drawn by the scene. */
  readonly sock: { x: number; z: number; carried: boolean };
  /** Make the pet do this next, for example go and eat after a feed command. Ignored while asleep. */
  request(behavior: Behavior): void;
  /** Play a one-shot reaction on the next frame. */
  react(name: AnimationName): void;
  /** Hand control to something else (the mini-game). The brain picks a fresh decision on resume. */
  setPaused(paused: boolean): void;
  /** Current decision, for the debug overlay and tests. */
  current(): Decision | null;
  /** Steps left in the current plan, for tests. */
  phaseIndex(): number;
}

export function createBrain(options: BrainOptions): Brain {
  const sock = { x: 130, z: 0, carried: false };
  let ai: AIState = createAIState();
  let decision: Decision | null = null;
  let plan: Phase[] = [];
  let index = 0;
  let phaseStart = 0;
  let phaseStarted = false;
  let lastFrame = 0;
  let paused = false;
  let resumed = false;
  let startedRequest = false;
  /** Requested behaviors, oldest first. The first starts at once, the rest wait their turn. */
  const requests: Behavior[] = [];
  const pendingReactions: AnimationName[] = [];

  const startDecision = (next: Decision, frameMs: number, scene: BrainScene): void => {
    decision = next;
    plan = planFor(next, { x: scene.x, z: scene.z, sockX: sock.x, sockZ: sock.z });
    index = 0;
    phaseStarted = false;
    phaseStart = frameMs;
    options.onDecision?.(next, options.pet.get());
  };

  const decide = (frameMs: number, scene: BrainScene, wallMs: number): void => {
    const pet = options.pet.get();
    const r = nextDecision(ai, pet, options.world, wallMs);
    ai = r.ai;
    startDecision(r.decision, frameMs, scene);
  };

  const runAction = (action: SockAction | undefined, scene: BrainScene): void => {
    if (action === 'pickSock') sock.carried = true;
    if (action === 'dropSock') {
      sock.carried = false;
      sock.x = scene.x;
      sock.z = scene.z;
    }
  };

  return {
    sock,
    request(behavior) {
      requests.push(behavior);
    },
    react(name) {
      pendingReactions.push(name);
    },
    setPaused(next) {
      if (paused && !next) resumed = true;
      paused = next;
    },
    current: () => decision,
    phaseIndex: () => index,

    tick(frameMs, scene) {
      const dt = lastFrame === 0 ? 0 : Math.min(100, frameMs - lastFrame);
      lastFrame = frameMs;
      const wall = options.clock.nowMs();
      if (paused) return; // the mini-game moves the pet and keeps its own time

      // Keep the simulation current: needs, sleep, and daily events while the app is open.
      const before = options.pet.get();
      // A gap of 30 minutes or more counts as time away: the pet may have done mischief unseen.
      // Shorter gaps happen while the player watches, and PetAI performs steals on screen.
      const away = wall - before.timestamps.lastSimulationTime >= AWAY_MS;
      const sim = simulate(before, wall, { autonomousSteal: away });
      if (sim.pet !== before) options.pet.set(sim.pet);
      if (sim.events.length > 0) options.onEvents?.(sim.events);
      const asleep = sim.pet.state.sleepState === 'asleep';

      // The simulation put the pet to sleep or woke it: switch straight away.
      if (asleep && decision?.behavior !== 'sleep') {
        if (sock.carried) runAction('dropSock', scene);
        decide(frameMs, scene, wall);
      } else if (!asleep && decision?.behavior === 'sleep') {
        scene.y = ROOM.groundY;
        scene.z = ROOM.hammockApproachZ;
        decide(frameMs, scene, wall);
      }
      if (decision === null || resumed) {
        resumed = false;
        scene.y = ROOM.groundY;
        decide(frameMs, scene, wall);
      }

      if (requests.length > 0 && !asleep && !startedRequest) {
        // A new request interrupts what the pet is doing. Later ones wait until this one is finished.
        startedRequest = true;
        if (sock.carried) runAction('dropSock', scene);
        const r = forceDecision(ai, options.pet.get(), requests.shift() as Behavior);
        ai = r.ai;
        startDecision(r.decision, frameMs, scene);
      }
      for (const name of pendingReactions.splice(0)) scene.animator.react(name, frameMs);

      const phase = plan[index];
      if (!phase) {
        // The plan is finished: log its outcome, then choose again.
        const finished = decision as Decision;
        // The meal or drink is finished: the bowl is empty until the player fills it again.
        if (finished.behavior === 'eat') options.world.foodInBowl = false;
        if (finished.behavior === 'drink') options.world.waterInBowl = false;
        const done = completeBehavior(options.pet.get(), finished.behavior, wall);
        if (done.events.length > 0) {
          options.pet.set(done.pet);
          options.onEvents?.(done.events);
        }
        scene.y = ROOM.groundY;
        const next = requests.shift();
        if (next && !asleep) {
          const r = forceDecision(ai, options.pet.get(), next);
          ai = r.ai;
          startDecision(r.decision, frameMs, scene);
        } else {
          decide(frameMs, scene, wall);
        }
        startedRequest = requests.length > 0; // waiting requests are started by the next finished plan
        return;
      }

      if (!phaseStarted) {
        phaseStarted = true;
        phaseStart = frameMs;
        scene.animator.setBase(phase.anim, frameMs);
        if (phase.kind === 'do') {
          runAction(phase.startAction, scene);
          if (phase.y !== undefined) scene.y = phase.y;
          if (phase.z !== undefined) scene.z = phase.z;
          if (phase.face) {
            scene.facing = phase.face;
            scene.heading = null;
          }
          if (phase.react) scene.animator.react(phase.react, frameMs);
        } else {
          runAction(phase.startAction, scene);
          if (phase.face) {
            scene.facing = phase.face;
            scene.heading = null;
          }
        }
      }

      if (phase.kind === 'do') {
        if (frameMs - phaseStart >= phase.ms) {
          index++;
          phaseStarted = false;
        }
        return;
      }

      // Walking: move straight toward the target and arrive exactly on it. The pet always turns to
      // face the way it goes (a pet that walks sideways to a bowl looks like a puppet); a phase that
      // wants a direction at the end (nose to the bowl) turns it on arrival.
      const dx = phase.x - scene.x;
      const dz = phase.z - scene.z;
      const distance = Math.hypot(dx, dz);
      // Start and stop gently, except between two runs in a row: zoomies should flow.
      const easeIn = plan[index - 1]?.kind === 'go' ? 1 : smooth((frameMs - phaseStart) / EASE_IN_MS);
      const easeOut = plan[index + 1]?.kind === 'go' ? 1 : smooth(distance / (phase.speed * (EASE_OUT_MS / 1000)));
      const step = phase.speed * Math.max(MIN_PACE, Math.min(easeIn, easeOut)) * (dt / 1000);
      if (distance > 0.001) {
        scene.heading = Math.atan2(dx, dz);
        if (Math.abs(dx) > 0.01) scene.facing = dx > 0 ? 1 : -1;
      }
      if (distance <= step) {
        scene.x = phase.x;
        scene.z = phase.z;
        runAction(phase.endAction, scene);
        index++;
        phaseStarted = false;
      } else {
        scene.x += (dx / distance) * step;
        scene.z += (dz / distance) * step;
      }
    },
  };
}
