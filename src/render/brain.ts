// The link between the game and the picture: it asks PetAI what to do, runs the resulting
// steps (walk here, play this animation), keeps the simulation up to date while the app is
// open, and moves the pet to bed when the simulation says it is asleep. It moves the
// scene's pet but draws nothing itself. Replaces the temporary demo brain of Part 1D.

import { completeBehavior, createAIState, nextDecision, type AIState, type AIWorld, type Decision } from '../core/petAI';
import { simulate } from '../core/simulate';
import type { Clock } from '../core/time';
import type { HistoryEvent, PetRecord } from '../core/types';
import type { AnimationName } from './animations';
import { ROOM } from './room';
import { planFor, type Phase, type SockAction } from './plan';

/** The part of the scene the brain moves. Kept small so the brain is tested without a canvas. */
/** Time away that counts as the player being gone (docs/GAME_DESIGN.md §8). */
export const AWAY_MS = 30 * 60_000;

export interface BrainScene {
  x: number;
  y: number;
  facing: 1 | -1;
  animator: { setBase(name: AnimationName, nowMs: number): void; react(name: AnimationName, nowMs: number): void };
}

export interface BrainOptions {
  pet: { get(): PetRecord; set(pet: PetRecord): void };
  /** The game clock (wall time in epoch ms). Time of day and the simulation use this. */
  clock: Clock;
  world: AIWorld;
  /**
   * TEMPORARY, removed in Part 1F: until the feed and water commands exist, finishing a meal or a
   * drink restores the need itself (hunger and hydration +3500), so a preview pet does not stay hungry.
   */
  eatingSatisfiesNeeds?: boolean;
  onDecision?(decision: Decision, pet: PetRecord): void;
  onEvents?(events: HistoryEvent[]): void;
}

export interface Brain {
  tick(frameMs: number, scene: BrainScene): void;
  /** The sock lies on the floor here, or is being carried. Drawn by the scene. */
  readonly sock: { x: number; carried: boolean };
  /** Current decision, for the debug overlay and tests. */
  current(): Decision | null;
  /** Steps left in the current plan, for tests. */
  phaseIndex(): number;
}

export function createBrain(options: BrainOptions): Brain {
  const sock = { x: 130, carried: false };
  let ai: AIState = createAIState();
  let decision: Decision | null = null;
  let plan: Phase[] = [];
  let index = 0;
  let phaseStart = 0;
  let phaseStarted = false;
  let lastFrame = 0;

  const startDecision = (next: Decision, frameMs: number, scene: BrainScene): void => {
    decision = next;
    plan = planFor(next, { x: scene.x, sockX: sock.x });
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
    }
  };

  return {
    sock,
    current: () => decision,
    phaseIndex: () => index,

    tick(frameMs, scene) {
      const dt = lastFrame === 0 ? 0 : Math.min(100, frameMs - lastFrame);
      lastFrame = frameMs;
      const wall = options.clock.nowMs();

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
        decide(frameMs, scene, wall);
      }
      if (decision === null) decide(frameMs, scene, wall);

      const phase = plan[index];
      if (!phase) {
        // The plan is finished: log its outcome, then choose again.
        const finished = decision as Decision;
        let current = options.pet.get();
        if (options.eatingSatisfiesNeeds && (finished.behavior === 'eat' || finished.behavior === 'drink')) {
          const key = finished.behavior === 'eat' ? 'hunger' : 'hydration';
          current = { ...current, state: { ...current.state, [key]: Math.min(10000, current.state[key] + 3500) } };
          options.pet.set(current);
        }
        const done = completeBehavior(current, finished.behavior, wall);
        if (done.events.length > 0) {
          options.pet.set(done.pet);
          options.onEvents?.(done.events);
        }
        scene.y = ROOM.groundY;
        decide(frameMs, scene, wall);
        return;
      }

      if (!phaseStarted) {
        phaseStarted = true;
        phaseStart = frameMs;
        scene.animator.setBase(phase.anim, frameMs);
        if (phase.kind === 'do') {
          runAction(phase.startAction, scene);
          if (phase.y !== undefined) scene.y = phase.y;
          if (phase.face) scene.facing = phase.face;
          if (phase.react) scene.animator.react(phase.react, frameMs);
        } else {
          runAction(phase.startAction, scene);
          scene.facing = phase.face ?? (phase.x >= scene.x ? 1 : -1);
        }
      }

      if (phase.kind === 'do') {
        if (frameMs - phaseStart >= phase.ms) {
          index++;
          phaseStarted = false;
        }
        return;
      }

      // Walking: move toward the target and arrive exactly on it.
      const dir = phase.x >= scene.x ? 1 : -1;
      scene.x += dir * phase.speed * (dt / 1000);
      if ((dir === 1 && scene.x >= phase.x) || (dir === -1 && scene.x <= phase.x)) {
        scene.x = phase.x;
        runAction(phase.endAction, scene);
        index++;
        phaseStarted = false;
      }
    },
  };
}
