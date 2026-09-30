// Code-driven animations (guide §9.1). Each one is a pure function of time in milliseconds
// since it started, returning the parts of the pose it moves. Quality of movement matters
// more than the number of animations. The rig is a placeholder shape set; these numbers
// carry over to the final art as long as the part names and pivots stay the same.

import { NEUTRAL, pose, type Pose } from './pose';

export type AnimationName =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sniff'
  | 'curious'
  | 'sleep'
  | 'eat'
  | 'drink'
  | 'sneak'
  | 'happy'
  | 'annoyed'
  | 'surprise';

export interface AnimationDef {
  /** Loops forever, or plays once for `durationMs` and then hands back to the base animation. */
  loop: boolean;
  /** Length of a one-shot. For a loop it is about one cycle of the main motion (informational). */
  durationMs: number;
  /** Minimum time between drawn frames. 0 = every display frame. Slow animations need fewer. */
  frameIntervalMs: number;
  sample(tMs: number): Pose;
}

const TAU = Math.PI * 2;
const wave = (t: number, periodMs: number, phase = 0): number => Math.sin((TAU * t) / periodMs + phase);
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** A short bump of height 1 that happens once per period and lasts `widthMs`. */
function pulse(t: number, periodMs: number, widthMs: number): number {
  const local = ((t % periodMs) + periodMs) % periodMs;
  return local < widthMs ? Math.sin((Math.PI * local) / widthMs) : 0;
}

/** Envelope for one-shots: ramps in over `inMs`, holds, and fades to 0 at `durationMs`. */
function envelope(t: number, durationMs: number, inMs: number): number {
  if (t <= 0 || t >= durationMs) return 0;
  return t < inMs ? t / inMs : clamp01((durationMs - t) / (durationMs - inMs));
}

// Ears and tail idle motion shared by calm animations.
const calmEars = (t: number): Partial<Pose> => ({
  earNear: 0.05 + 0.3 * pulse(t + 700, 5300, 240),
  earFar: 0.05 + 0.3 * pulse(t + 2900, 6100, 240),
});

/** Legs for a walk or run cycle. Diagonal pairs move together, like a real quadruped. */
function legs(t: number, periodMs: number, swing: number): Partial<Pose> {
  return {
    legFN: swing * wave(t, periodMs),
    legBF: swing * wave(t, periodMs),
    legFF: swing * wave(t, periodMs, Math.PI),
    legBN: swing * wave(t, periodMs, Math.PI),
  };
}

const idle: AnimationDef = {
  loop: true,
  durationMs: 3200 * 4,
  frameIntervalMs: 33,
  sample: (t) =>
    pose({
      bodyScaleY: 1 + 0.022 * wave(t, 3200),
      bodyLift: 0.5 * wave(t, 3200),
      headRot: 0.03 * wave(t, 4100),
      tailRot: 0.15 + 0.12 * wave(t, 2600),
      tailRot2: 0.1 * wave(t, 2600, -1),
      noseTwitch: 0.5 * wave(t, 900),
      ...calmEars(t),
    }),
};

const walk: AnimationDef = {
  loop: true,
  durationMs: 520,
  frameIntervalMs: 0,
  sample: (t) => {
    const p = (TAU * t) / 520;
    return pose({
      ...legs(t, 520, 0.55),
      bodyLift: 1.5 * Math.abs(Math.sin(p)),
      bodyRot: 0.03 * Math.sin(2 * p),
      bodyScaleX: 1 + 0.04 * Math.sin(2 * p + 1),
      headDY: Math.sin(2 * p + 1),
      headRot: 0.05 * Math.sin(2 * p),
      tailRot: 0.1 + 0.1 * Math.sin(p + 1),
      tailRot2: 0.1 * Math.sin(p),
      earNear: 0.15,
      earFar: 0.15,
    });
  },
};

// Zoomies: fast bounding run with hops (the "playful" behavior).
const run: AnimationDef = {
  loop: true,
  durationMs: 320,
  frameIntervalMs: 0,
  sample: (t) => {
    const p = (TAU * t) / 320;
    return pose({
      ...legs(t, 320, 0.85),
      bodyLift: 5 * Math.abs(Math.sin(p)),
      bodyRot: -0.05 * Math.sin(p),
      bodyScaleX: 1 + 0.1 * Math.sin(2 * p + 1),
      bodyScaleY: 1 - 0.04 * Math.sin(2 * p + 1),
      headRot: -0.1 + 0.06 * Math.sin(2 * p),
      tailRot: 0.7 + 0.15 * Math.sin(p),
      tailRot2: 0.3,
      earNear: 0.4,
      earFar: 0.4,
      mouth: 2,
    });
  },
};

const sniff: AnimationDef = {
  loop: true,
  durationMs: 1400,
  frameIntervalMs: 0,
  sample: (t) =>
    pose({
      headRot: 0.25 + 0.08 * wave(t, 1400),
      headDX: 3 * wave(t, 700),
      bodyRot: 0.05,
      noseTwitch: 1.4 * wave(t, 110),
      earNear: -0.2,
      earFar: -0.2,
      tailRot: 0.1 + 0.08 * wave(t, 2000),
      legFN: 0.1,
    }),
};

const curious: AnimationDef = {
  loop: true,
  durationMs: 2600,
  frameIntervalMs: 0,
  sample: (t) =>
    pose({
      bodyRot: -0.16,
      bodyLift: 1,
      headRot: -0.25 + 0.1 * wave(t, 2600),
      headDX: 2 * wave(t, 2600, 1),
      earNear: -0.3,
      earFar: -0.3,
      noseTwitch: 0.8 * wave(t, 150),
      eyeWide: 0.5,
      legFN: -0.1,
      legFF: -0.1,
      tailRot: 0.4 + 0.1 * wave(t, 1800),
    }),
};

// Curled up and nearly still: only slow breathing, so a sleeping pet costs almost no CPU.
const sleep: AnimationDef = {
  loop: true,
  durationMs: 4200,
  frameIntervalMs: 100,
  sample: (t) =>
    pose({
      bodyLift: -18,
      bodyScaleX: 0.92,
      bodyScaleY: 0.86 + 0.035 * wave(t, 4200),
      headRot: 0.55,
      headDX: -6,
      headDY: 16,
      earNear: 0.5,
      earFar: 0.5,
      tailRot: -2.75,
      tailRot2: -0.7,
      legTuck: 1,
      eyes: 2,
    }),
};

const eat: AnimationDef = {
  loop: true,
  durationMs: 1300,
  frameIntervalMs: 0,
  sample: (t) =>
    pose({
      bodyRot: 0.1,
      headRot: 0.75,
      headDX: 4,
      headDY: 8,
      mouth: wave(t, 260) > 0 ? 1 : 0,
      earNear: 0.1,
      earFar: 0.1,
      tailRot: 0.2 + 0.15 * wave(t, 700),
    }),
};

const drink: AnimationDef = {
  loop: true,
  durationMs: 1200,
  frameIntervalMs: 0,
  sample: (t) =>
    pose({
      bodyRot: 0.14,
      headRot: 0.95,
      headDX: 6,
      headDY: 12,
      mouth: wave(t, 200) > 0 ? 1 : 0,
      earNear: 0.3,
      earFar: 0.3,
      noseTwitch: 0.5 * wave(t, 400),
      tailRot: 0.1 + 0.1 * wave(t, 900),
    }),
};

// Mischief: a low, sneaky walk with an item in the mouth.
const sneak: AnimationDef = {
  loop: true,
  durationMs: 640,
  frameIntervalMs: 0,
  sample: (t) => {
    const p = (TAU * t) / 640;
    return pose({
      ...legs(t, 640, 0.45),
      bodyLift: -3 + Math.abs(Math.sin(p)),
      bodyScaleY: 0.92,
      headRot: -0.2,
      headDX: 3 * Math.sin(p / 2),
      earNear: 0.25,
      earFar: 0.25,
      tailRot: -0.1,
      carry: 1,
    });
  },
};

const HAPPY_MS = 1300;
const happy: AnimationDef = {
  loop: false,
  durationMs: HAPPY_MS,
  frameIntervalMs: 0,
  sample: (t) => {
    const env = envelope(t, HAPPY_MS, 150);
    const hop = Math.abs(Math.sin((3 * Math.PI * t) / HAPPY_MS));
    return pose({
      bodyLift: 9 * hop * env,
      bodyScaleY: 1 - 0.06 * (1 - hop) * env,
      tailRot: 0.4 * env + 0.5 * wave(t, 140) * env,
      tailRot2: 0.3 * wave(t, 140, 1) * env,
      headRot: -0.1 * env,
      earNear: 0.05,
      earFar: 0.05,
      eyes: env > 0.05 ? 3 : 0,
      mouth: env > 0.05 ? 2 : 0,
    });
  },
};

const ANNOYED_MS = 1000;
const annoyed: AnimationDef = {
  loop: false,
  durationMs: ANNOYED_MS,
  frameIntervalMs: 0,
  sample: (t) => {
    const env = envelope(t, ANNOYED_MS, 100);
    return pose({
      headRot: 0.18 * wave(t, 160) * env,
      earNear: 0.7 * env,
      earFar: 0.7 * env,
      tailRot: 0.2 * env + 0.3 * wave(t, 260) * env,
      bodyScaleY: 1 - 0.03 * env,
      eyes: env > 0.05 ? 1 : 0,
    });
  },
};

const SURPRISE_MS = 800;
const surprise: AnimationDef = {
  loop: false,
  durationMs: SURPRISE_MS,
  frameIntervalMs: 0,
  sample: (t) => {
    const env = envelope(t, SURPRISE_MS, 90);
    const jump = t < 300 ? Math.sin((Math.PI * t) / 300) : 0;
    return pose({
      bodyLift: 10 * jump,
      bodyScaleX: 1 - 0.05 * env,
      bodyScaleY: 1 + 0.05 * env,
      bodyRot: -0.1 * env,
      headRot: -0.2 * env,
      earNear: -0.25 * env,
      earFar: -0.25 * env,
      tailRot: 0.9 * env,
      eyeWide: env,
      mouth: env > 0.3 ? 1 : 0,
    });
  },
};

export const ANIMATIONS: Readonly<Record<AnimationName, AnimationDef>> = {
  idle,
  walk,
  run,
  sniff,
  curious,
  sleep,
  eat,
  drink,
  sneak,
  happy,
  annoyed,
  surprise,
};

export const ANIMATION_NAMES = Object.keys(ANIMATIONS) as AnimationName[];

/** The base animation for each PetAI behavior (docs/PET_BEHAVIOR.md §2). */
export const ANIMATION_FOR_BEHAVIOR: Readonly<Record<string, AnimationName>> = {
  idle: 'idle',
  wander: 'walk',
  sniff: 'sniff',
  curious: 'curious',
  eat: 'eat',
  drink: 'drink',
  playful: 'run',
  steal: 'sneak',
  sleep: 'sleep',
};

export function sampleAnimation(name: AnimationName, tMs: number): Pose {
  return ANIMATIONS[name].sample(tMs);
}

/** The rest pose, exported for tests and the gallery. */
export const REST: Readonly<Pose> = NEUTRAL;
