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
import { planFor, type ItemAction, type Phase } from './plan';

/** The part of the scene the brain moves. Kept small so the brain is tested without a canvas. */
/** Time away that counts as the player being gone (docs/GAME_DESIGN.md §8). */
export const AWAY_MS = 30 * 60_000;

/** Walking starts and stops gently over this long, so the pet does not jerk into and out of its pace. */
const EASE_IN_MS = 350;
const EASE_OUT_MS = 500;
/** Never slower than this share of the pace, so a walk always arrives. */
const MIN_PACE = 0.2;
/** How fast the body turns, radians per second: a walk turns in about 0.3 s, a run a little faster. */
const TURN_RATE_WALK = 5.5;
const TURN_RATE_RUN = 9;
/** Share of the pace a run keeps in the middle of a sharp turn. */
const RUN_TURN_PACE = 0.55;
/** The decision shown while the pet follows a script from the player. It has no effect on the pet's needs. */
const SCRIPTED: Decision = { behavior: 'idle', durationMs: 0, spots: [0, 0, 0] };
const wrap = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));
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
  /** The ball, the same way. The player can throw it, and the pet fetches it. */
  readonly ball: { x: number; z: number; carried: boolean };
  /** Run these steps now (the player called the pet, threw the ball, tapped the window). Ignored while asleep. */
  script(steps: Phase[]): void;
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
  const ball: { x: number; z: number; carried: boolean } = { x: ROOM.toyX, z: ROOM.toyZ, carried: false };
  let scripted: Phase[] | null = null;
  let ai: AIState = createAIState();
  let decision: Decision | null = null;
  let plan: Phase[] = [];
  let index = 0;
  let phaseStart = 0;
  let phaseStarted = false;
  let lastFrame = 0;
  let paused = false;
  let resumed = false;
  /** Direction to turn to while standing, set by a phase that wants the nose somewhere (at a bowl). */
  let turnTo: number | null = null;
  let startedRequest = false;
  /** Requested behaviors, oldest first. The first starts at once, the rest wait their turn. */
  const requests: Behavior[] = [];
  const pendingReactions: AnimationName[] = [];

  const startDecision = (next: Decision, frameMs: number, scene: BrainScene): void => {
    decision = next;
    plan = planFor(next, { x: scene.x, z: scene.z, sockX: sock.x, sockZ: sock.z, ballX: ball.x, ballZ: ball.z });
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

  const runAction = (action: ItemAction | undefined, scene: BrainScene): void => {
    if (action === 'pickBall') ball.carried = true;
    if (action === 'dropBall') {
      ball.carried = false;
      ball.x = scene.x;
      ball.z = scene.z;
    }
    if (action === 'pickSock') sock.carried = true;
    if (action === 'dropSock') {
      sock.carried = false;
      sock.x = scene.x;
      sock.z = scene.z;
    }
  };

  return {
    sock,
    ball,
    script(steps) {
      scripted = steps;
    },
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
        if (ball.carried) runAction('dropBall', scene);
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

      if (scripted && !asleep) {
        // The player asked for something by touch: it interrupts what the pet is doing.
        const steps = scripted;
        scripted = null;
        if (sock.carried) runAction('dropSock', scene);
        if (ball.carried) runAction('dropBall', scene);
        decision = SCRIPTED;
        plan = steps;
        index = 0;
        phaseStarted = false;
        phaseStart = frameMs;
      }
      if (requests.length > 0 && !asleep && !startedRequest) {
        // A new request interrupts what the pet is doing. Later ones wait until this one is finished.
        startedRequest = true;
        if (sock.carried) runAction('dropSock', scene);
        if (ball.carried) runAction('dropBall', scene);
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
          turnTo = phase.heading ?? (phase.face ? (phase.face * Math.PI) / 2 : null);
          if (phase.react) scene.animator.react(phase.react, frameMs);
        } else {
          runAction(phase.startAction, scene);
          turnTo = null;
        }
      }

      // The body is always pointed somewhere. The controller may have set only `facing` (the mini-game).
      let heading = scene.heading ?? (scene.facing * Math.PI) / 2;

      if (phase.kind === 'do') {
        if (turnTo !== null) {
          const turn = wrap(turnTo - heading);
          const most = TURN_RATE_WALK * (dt / 1000);
          heading = wrap(heading + Math.max(-most, Math.min(most, turn)));
          scene.heading = heading;
          if (Math.abs(Math.sin(heading)) > 0.05) scene.facing = Math.sin(heading) > 0 ? 1 : -1;
        }
        if (frameMs - phaseStart >= phase.ms) {
          index++;
          phaseStarted = false;
        }
        return;
      }

      // Walking: steer toward the target. The body turns at a limited rate and moves along the way it
      // points, so it never strafes (a pet that slides sideways to a bowl looks like a puppet, and its
      // paws cannot match the ground). A sharp turn slows it to a near stop first, like a real animal.
      const dx = phase.x - scene.x;
      const dz = phase.z - scene.z;
      const distance = Math.hypot(dx, dz);
      const wanted = Math.atan2(dx, dz);
      const most = (phase.speed > 80 ? TURN_RATE_RUN : TURN_RATE_WALK) * (dt / 1000);
      heading = wrap(heading + Math.max(-most, Math.min(most, wrap(wanted - heading))));
      const off = Math.abs(wrap(wanted - heading));
      // A walk almost stops for a sharp turn; a run (zoomies) swings wide and keeps most of its pace.
      const aligned = Math.max(phase.speed > 80 ? RUN_TURN_PACE : 0, off > Math.PI / 2 ? 0 : Math.cos(off) ** 2);
      // Start and stop gently, except between two runs in a row: zoomies should flow.
      const easeIn = plan[index - 1]?.kind === 'go' ? 1 : smooth((frameMs - phaseStart) / EASE_IN_MS);
      const easeOut = plan[index + 1]?.kind === 'go' ? 1 : smooth(distance / (phase.speed * (EASE_OUT_MS / 1000)));
      const pace = phase.speed * Math.max(MIN_PACE, Math.min(easeIn, easeOut)) * aligned;
      const step = Math.min(distance, pace * (dt / 1000));
      scene.heading = heading;
      if (Math.abs(Math.sin(heading)) > 0.05) scene.facing = Math.sin(heading) > 0 ? 1 : -1;
      if (distance - step < 1e-6) {
        // The last step reaches the target: land on it exactly, with no jump.
        scene.x = phase.x;
        scene.z = phase.z;
        runAction(phase.endAction, scene);
        index++;
        phaseStarted = false;
      } else {
        // A wide turn near the edge of the floor must not carry the pet out of the roaming area.
        scene.x = Math.min(ROOM.maxX, Math.max(ROOM.minX, scene.x + Math.sin(heading) * step));
        scene.z = Math.min(ROOM.maxZ, Math.max(ROOM.minZ, scene.z + Math.cos(heading) * step));
      }
    },
  };
}
