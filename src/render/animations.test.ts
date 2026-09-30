import { describe, expect, it } from 'vitest';
import { ANIMATIONS, ANIMATION_FOR_BEHAVIOR, ANIMATION_NAMES, sampleAnimation, type AnimationName } from './animations';
import { NEUTRAL, POSE_KEYS, lerpPose, pose, type Pose } from './pose';

const LIMITS: Partial<Record<keyof Pose, [number, number]>> = {
  bodyLift: [-30, 20],
  bodyScaleX: [0.7, 1.3],
  bodyScaleY: [0.7, 1.3],
  bodyRot: [-0.5, 0.5],
  headRot: [-1.3, 1.3],
  headDX: [-15, 15],
  headDY: [-5, 30],
  earNear: [-1, 1.2],
  earFar: [-1, 1.2],
  tailRot: [-3.3, 1.6],
  tailRot2: [-1.6, 1.6],
  legFN: [-1.5, 1.5],
  legFF: [-1.5, 1.5],
  legBN: [-1.5, 1.5],
  legBF: [-1.5, 1.5],
  legTuck: [0, 1],
  eyes: [0, 3],
  eyeWide: [0, 1],
  mouth: [0, 2],
  noseTwitch: [-3, 3],
  carry: [0, 1],
};

describe('pose helpers', () => {
  it('pose() overrides only what it is given', () => {
    const p = pose({ headRot: 0.4 });
    expect(p.headRot).toBe(0.4);
    expect(p.bodyScaleX).toBe(1);
    expect(p.eyes).toBe(0);
  });

  it('lerpPose blends continuous fields and switches discrete ones at the halfway point', () => {
    const a = pose({ headRot: 0, eyes: 0, mouth: 0, carry: 0 });
    const b = pose({ headRot: 1, eyes: 3, mouth: 2, carry: 1 });
    const quarter = lerpPose(a, b, 0.25);
    expect(quarter.headRot).toBeCloseTo(0.25);
    expect([quarter.eyes, quarter.mouth, quarter.carry]).toEqual([0, 0, 0]);
    const half = lerpPose(a, b, 0.5);
    expect([half.eyes, half.mouth, half.carry]).toEqual([3, 2, 1]);
    expect(lerpPose(a, b, 1)).toEqual(b);
    expect(lerpPose(a, b, 0)).toEqual(a);
  });
});

describe('every animation', () => {
  it('covers the Phase 1 list (docs/ART_ASSET_LIST.md)', () => {
    for (const name of ['idle', 'walk', 'sniff', 'sleep', 'eat', 'drink', 'happy', 'run', 'curious', 'sneak', 'annoyed', 'surprise']) {
      expect(ANIMATION_NAMES).toContain(name);
    }
  });

  for (const name of ANIMATION_NAMES) {
    const def = ANIMATIONS[name];

    it(`${name}: returns finite, in-range numbers over 30 seconds`, () => {
      for (let t = 0; t <= 30_000; t += 37) {
        const p = def.sample(t);
        for (const key of POSE_KEYS) {
          const v = p[key];
          expect(Number.isFinite(v), `${key} at ${t}`).toBe(true);
          const limit = LIMITS[key];
          if (limit) {
            expect(v, `${key} at ${t}`).toBeGreaterThanOrEqual(limit[0]);
            expect(v, `${key} at ${t}`).toBeLessThanOrEqual(limit[1]);
          }
        }
      }
    });

    it(`${name}: is deterministic`, () => {
      expect(def.sample(1234)).toEqual(def.sample(1234));
    });

    if (def.loop) {
      // Clips keep playing with a growing time value (they never restart), so what matters is
      // that they are continuous: no frame-to-frame jump at 60 fps.
      it(`${name}: is smooth, with no jump between 60 fps frames`, () => {
        const PIXEL_KEYS = ['bodyLift', 'headDX', 'headDY', 'noseTwitch'];
        for (let t = 0; t < 20_000; t += 16) {
          const p = def.sample(t);
          const q = def.sample(t + 16);
          for (const key of POSE_KEYS) {
            if (key === 'eyes' || key === 'mouth' || key === 'carry') continue;
            const limit = PIXEL_KEYS.includes(key) ? 2.5 : 0.4;
            expect(Math.abs(q[key] - p[key]), `${key} at ${t}`).toBeLessThan(limit);
          }
        }
      });
    } else {
      it(`${name}: starts and ends at the rest pose, so returning to the base does not pop`, () => {
        for (const t of [0, def.durationMs]) {
          const p = def.sample(t);
          for (const key of POSE_KEYS) {
            // Ears are allowed a small resting offset in idle, so compare against a tolerance.
            expect(Math.abs(p[key] - NEUTRAL[key]), `${key} at ${t}`).toBeLessThan(0.11);
          }
        }
      });
    }
  }
});

describe('specific animations', () => {
  it('walk swings diagonal leg pairs together and the other pair opposite', () => {
    const p = sampleAnimation('walk', 130);
    expect(p.legFN).toBeCloseTo(p.legBF);
    expect(p.legFF).toBeCloseTo(p.legBN);
    expect(p.legFN).toBeCloseTo(-p.legFF);
    expect(Math.abs(p.legFN)).toBeGreaterThan(0.3);
  });

  it('run is faster and bouncier than walk', () => {
    expect(ANIMATIONS.run.durationMs).toBeLessThan(ANIMATIONS.walk.durationMs);
    let walkMax = 0;
    let runMax = 0;
    for (let t = 0; t < 700; t += 5) {
      walkMax = Math.max(walkMax, sampleAnimation('walk', t).bodyLift);
      runMax = Math.max(runMax, sampleAnimation('run', t).bodyLift);
    }
    expect(runMax).toBeGreaterThan(walkMax * 2);
  });

  it('sleep is curled: low, tucked, eyes closed, and slow to update', () => {
    const p = sampleAnimation('sleep', 500);
    expect(p.bodyLift).toBeLessThan(-10);
    expect(p.legTuck).toBe(1);
    expect(p.eyes).toBe(2);
    expect(ANIMATIONS.sleep.frameIntervalMs).toBeGreaterThanOrEqual(100); // near-zero CPU (guide §4.4)
  });

  it('eat and drink chew: the mouth opens and closes', () => {
    for (const name of ['eat', 'drink'] as const) {
      const mouths = new Set<number>();
      for (let t = 0; t < 600; t += 10) mouths.add(sampleAnimation(name, t).mouth);
      expect(mouths).toEqual(new Set([0, 1]));
    }
  });

  it('drink puts the head lower than eat', () => {
    expect(sampleAnimation('drink', 0).headRot).toBeGreaterThan(sampleAnimation('eat', 0).headRot);
  });

  it('sneak carries an item, nothing else does', () => {
    expect(sampleAnimation('sneak', 100).carry).toBe(1);
    for (const name of ANIMATION_NAMES.filter((n) => n !== 'sneak')) {
      expect(sampleAnimation(name, 100).carry, name).toBe(0);
    }
  });

  it('happy hops, squints, and smiles mid-way', () => {
    const p = sampleAnimation('happy', 455);
    expect(p.eyes).toBe(3);
    expect(p.mouth).toBe(2);
    let maxLift = 0;
    for (let t = 0; t < 1300; t += 10) maxLift = Math.max(maxLift, sampleAnimation('happy', t).bodyLift);
    expect(maxLift).toBeGreaterThan(5);
  });

  it('surprise widens the eyes and jumps', () => {
    expect(sampleAnimation('surprise', 250).eyeWide).toBeGreaterThan(0.7);
    expect(sampleAnimation('surprise', 150).bodyLift).toBeGreaterThan(5);
  });

  it('idle is calm: small movement only', () => {
    for (let t = 0; t < 13_000; t += 50) {
      const p = sampleAnimation('idle', t);
      expect(Math.abs(p.bodyLift)).toBeLessThan(1);
      expect(p.eyes).toBe(0); // blinking is added by the animator, not the clip
    }
  });
});

describe('behavior mapping (docs/PET_BEHAVIOR.md §2)', () => {
  it('maps every PetAI behavior to a real animation', () => {
    const behaviors = ['idle', 'wander', 'sniff', 'curious', 'eat', 'drink', 'playful', 'steal', 'sleep'];
    for (const b of behaviors) {
      const anim = ANIMATION_FOR_BEHAVIOR[b] as AnimationName | undefined;
      expect(anim, b).toBeDefined();
      expect(ANIMATION_NAMES).toContain(anim);
    }
  });

  it('only the looping animations are base animations', () => {
    for (const anim of Object.values(ANIMATION_FOR_BEHAVIOR)) expect(ANIMATIONS[anim].loop, anim).toBe(true);
  });
});
