// The rig pose: every number the renderer needs to draw the ferret once (docs/ART_STYLE.md §4).
// Animations are pure functions of time that produce a Pose, so they can be tested without a canvas.
// The rig faces right. Facing left is a horizontal flip done by the drawing code.

export interface Pose {
  /** Whole body lift in px. Positive = up, negative = lowered (sleeping). */
  bodyLift: number;
  bodyScaleX: number;
  bodyScaleY: number;
  /** Radians about the hips. Positive = front of the body tips down. */
  bodyRot: number;
  /** Radians about the neck. Positive = nod down. */
  headRot: number;
  headDX: number;
  headDY: number;
  /** Radians. 0 = up, positive = flattened back, negative = pricked forward. */
  earNear: number;
  earFar: number;
  /** Radians. 0 = pointing straight back. Positive = raised. */
  tailRot: number;
  tailRot2: number;
  /** Leg swing in radians. Positive = foot swings back. F = front, B = back, N = near, F = far. */
  legFN: number;
  legFF: number;
  legBN: number;
  legBF: number;
  /** 0 = legs out, 1 = tucked under the body. */
  legTuck: number;
  /** 0 open, 1 half, 2 closed, 3 happy squint. Discrete. */
  eyes: number;
  /** 0..1 extra eye size for surprise. */
  eyeWide: number;
  /** 0 closed, 1 open, 2 smile. Discrete. */
  mouth: number;
  /** Nose offset in px, for twitching. */
  noseTwitch: number;
  /** 1 while carrying an item in the mouth. Discrete. */
  carry: number;
}

export const NEUTRAL: Readonly<Pose> = {
  bodyLift: 0,
  bodyScaleX: 1,
  bodyScaleY: 1,
  bodyRot: 0,
  headRot: 0,
  headDX: 0,
  headDY: 0,
  earNear: 0,
  earFar: 0,
  tailRot: 0,
  tailRot2: 0,
  legFN: 0,
  legFF: 0,
  legBN: 0,
  legBF: 0,
  legTuck: 0,
  eyes: 0,
  eyeWide: 0,
  mouth: 0,
  noseTwitch: 0,
  carry: 0,
};

export type PoseKey = keyof Pose;
export const POSE_KEYS = Object.keys(NEUTRAL) as PoseKey[];
const DISCRETE: ReadonlySet<PoseKey> = new Set<PoseKey>(['eyes', 'mouth', 'carry']);

/** A neutral pose with some fields overridden. */
export function pose(delta: Partial<Pose> = {}): Pose {
  return { ...NEUTRAL, ...delta };
}

/** Blend two poses. Continuous fields interpolate, discrete ones switch at the halfway point. */
export function lerpPose(a: Pose, b: Pose, k: number): Pose {
  const out = { ...a };
  for (const key of POSE_KEYS) {
    out[key] = DISCRETE.has(key) ? (k >= 0.5 ? b[key] : a[key]) : a[key] + (b[key] - a[key]) * k;
  }
  return out;
}
