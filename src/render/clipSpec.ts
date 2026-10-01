// The clip list the game relies on, read from animation/clips.json: the same file the Blender
// export is checked against. A name that is not in it cannot be played. Walking speed matters:
// paws only stay planted when a walk, sneak, or run clip plays at the pace the pet moves
// (animation/README.md), so the 3D scene scales playback with playbackRate().

import clipsFile from '../../animation/clips.json';

export interface ClipSpec {
  loop: boolean;
  frames: number;
  required: boolean;
  /** PetAI behavior the clip is the base animation for. */
  behavior?: string;
  /** One-shot played on top of the running loop. */
  reaction?: boolean;
  /** Ground covered per cycle, in metres. Only locomotion clips have it. */
  stride_m?: number;
  /** Pet speed in metres per second at normal playback. Only locomotion clips have it. */
  ground_speed_mps?: number;
  bones?: string[];
}

export type AnimationName = keyof typeof clipsFile.clips;

export const CLIP_FPS: number = clipsFile.fps;
export const CLIPS = clipsFile.clips as unknown as Readonly<Record<AnimationName, ClipSpec>>;
export const ANIMATION_NAMES = Object.keys(clipsFile.clips) as AnimationName[];
/** Bone names the game looks up in the model. */
export const BONES: readonly string[] = clipsFile.bones;

/** Slow clips need fewer frames: a sleeping pet is drawn 10 times a second (guide §4.4). */
const FRAME_INTERVAL_MS: Partial<Record<AnimationName, number>> = { sleep: 100 };
export const frameIntervalMs = (name: AnimationName): number => FRAME_INTERVAL_MS[name] ?? 0;

/**
 * Playback speed so the paws keep up with the ground. `speedMps` is how fast the pet really moves.
 * Clips without a ground speed (idle, eat, reactions) always play at 1. Clamped so a stray number
 * can never freeze or blur the legs.
 */
export function playbackRate(name: AnimationName, speedMps: number): number {
  const ground = CLIPS[name].ground_speed_mps;
  if (ground === undefined || speedMps < 0.005) return 1;
  return Math.min(2.2, Math.max(0.5, speedMps / ground));
}
