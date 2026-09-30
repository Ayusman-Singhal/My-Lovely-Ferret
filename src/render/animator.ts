// Runs the animations over time: one looping base animation, optional one-shot reactions
// on top, smooth blending between clips, and blinking. Pure: it takes "now" as an argument
// and never reads a clock, so it is tested without a browser.

import { hashString } from '../core/rng';
import { ANIMATIONS, type AnimationName } from './animations';
import { NEUTRAL, lerpPose, type Pose } from './pose';

const BLINK_CYCLE_MS = 3000;
const BLINK_MS = 150;

/**
 * 0 = eyes open, 1 = half closed, 2 = closed, at time `nowMs`. One blink per cycle at a
 * pseudo-random point inside it, so blinks look natural but are reproducible for a seed.
 */
export function blinkFrame(nowMs: number, seed: number): 0 | 1 | 2 {
  const cycle = Math.floor(nowMs / BLINK_CYCLE_MS);
  const offset = 400 + (hashString(`${seed}|${cycle}`) % 2200);
  const local = nowMs - cycle * BLINK_CYCLE_MS - offset;
  if (local < 0 || local >= BLINK_MS) return 0;
  const closure = Math.sin((Math.PI * local) / BLINK_MS);
  return closure > 0.6 ? 2 : closure > 0.2 ? 1 : 0;
}

const smooth = (k: number): number => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

export interface Animator {
  /** Set the looping base animation. Does nothing if it is already playing. */
  setBase(name: AnimationName, nowMs: number): void;
  /** Play a one-shot reaction over the base. It hands back to the base when it ends. */
  react(name: AnimationName, nowMs: number): void;
  /** The pose to draw at `nowMs`, including blinking. */
  update(nowMs: number): Pose;
  /** Name of the clip playing right now. */
  current(): AnimationName;
  /** Minimum ms between frames for the current clip (0 = every display frame). */
  frameIntervalMs(): number;
}

export interface AnimatorOptions {
  /** Seed for blink timing, for example a hash of the pet id. */
  seed?: number;
  /** Time to blend from the previous pose into a new clip. */
  blendMs?: number;
}

export function createAnimator(options: AnimatorOptions = {}): Animator {
  const seed = options.seed ?? 0;
  const blendMs = options.blendMs ?? 180;

  let base: AnimationName = 'idle';
  let reaction: AnimationName | null = null;
  let clip: AnimationName = 'idle';
  let clipStart = 0;
  let from: Pose = NEUTRAL;
  let last: Pose = NEUTRAL;
  let started = false;

  const startClip = (name: AnimationName, nowMs: number): void => {
    from = last;
    clip = name;
    clipStart = nowMs;
  };

  return {
    setBase(name, nowMs) {
      if (name === base && started) return;
      base = name;
      started = true;
      if (reaction === null) startClip(name, nowMs);
    },

    react(name, nowMs) {
      started = true;
      reaction = name;
      startClip(name, nowMs);
    },

    update(nowMs) {
      if (!started) {
        started = true;
        startClip(base, nowMs);
      }
      if (reaction !== null && nowMs - clipStart >= ANIMATIONS[reaction].durationMs) {
        // The reaction just ended: continue from wherever the last frame left off.
        reaction = null;
        startClip(base, nowMs);
      }
      const localT = Math.max(0, nowMs - clipStart);
      const target = ANIMATIONS[clip].sample(localT);
      const k = smooth(localT / blendMs);
      const pose = k >= 1 ? target : lerpPose(from, target, k);
      last = pose;

      // Blink overlay: only over open eyes, so sleep, squint, and surprise keep their own eyes.
      if (pose.eyes === 0 && pose.eyeWide === 0) {
        const frame = blinkFrame(nowMs, seed);
        if (frame !== 0) return { ...pose, eyes: frame };
      }
      return pose;
    },

    current: () => clip,
    frameIntervalMs: () => ANIMATIONS[clip].frameIntervalMs,
  };
}
