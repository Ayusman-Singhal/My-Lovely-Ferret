import { describe, expect, it } from 'vitest';
import { ANIMATIONS, sampleAnimation } from './animations';
import { blinkFrame, createAnimator } from './animator';
import { POSE_KEYS, type Pose } from './pose';

const PIXEL_KEYS = ['bodyLift', 'headDX', 'headDY', 'noseTwitch'];
/** Largest per-key change, counted separately for pixel fields and angle or scale fields. */
const maxJump = (a: Pose, b: Pose): { px: number; other: number } => {
  let px = 0;
  let other = 0;
  for (const k of POSE_KEYS) {
    if (k === 'eyes' || k === 'mouth' || k === 'carry') continue;
    const d = Math.abs(a[k] - b[k]);
    if (PIXEL_KEYS.includes(k)) px = Math.max(px, d);
    else other = Math.max(other, d);
  }
  return { px, other };
};

describe('blinkFrame', () => {
  it('is reproducible for a seed and differs between seeds', () => {
    const run = (seed: number) => Array.from({ length: 600 }, (_, i) => blinkFrame(i * 50, seed));
    expect(run(7)).toEqual(run(7));
    expect(run(7)).not.toEqual(run(8));
  });

  it('blinks about once every 3 seconds, briefly, and closes fully at the peak', () => {
    let closedFrames = 0;
    let blinks = 0;
    let prev = 0;
    for (let t = 0; t < 60_000; t += 10) {
      const f = blinkFrame(t, 1);
      if (f === 2) closedFrames++;
      if (f !== 0 && prev === 0) blinks++;
      prev = f;
    }
    expect(blinks).toBeGreaterThanOrEqual(18); // 60 s, one per 3 s cycle
    expect(blinks).toBeLessThanOrEqual(21);
    expect(closedFrames * 10).toBeGreaterThan(20 * 30); // fully closed at least ~30 ms per blink
    expect(closedFrames * 10).toBeLessThan(20 * 150); // never longer than the blink itself
  });

  it('never leaves the eyes closed for long (max 150 ms per blink)', () => {
    let run = 0;
    let longest = 0;
    for (let t = 0; t < 120_000; t += 5) {
      run = blinkFrame(t, 3) !== 0 ? run + 5 : 0;
      longest = Math.max(longest, run);
    }
    expect(longest).toBeLessThanOrEqual(150);
  });
});

describe('createAnimator', () => {
  it('starts in idle and reports it', () => {
    const a = createAnimator();
    a.update(0);
    expect(a.current()).toBe('idle');
    expect(a.frameIntervalMs()).toBe(ANIMATIONS.idle.frameIntervalMs);
  });

  it('switches base animation, blending smoothly with no jump between frames', () => {
    const a = createAnimator({ blendMs: 200 });
    a.setBase('idle', 0);
    a.update(1000);
    a.setBase('sleep', 1000);
    let prev = a.update(1000);
    for (let t = 1016; t <= 1400; t += 16) {
      const p = a.update(t);
      const jump = maxJump(prev, p);
      expect(jump.px).toBeLessThan(3.5); // idle to sleep moves about 34 px in total, spread over the blend
      expect(jump.other).toBeLessThan(0.7);
      prev = p;
    }
    // After the blend, it is exactly the clip's own pose.
    const done = a.update(2000);
    expect(done.legTuck).toBe(1);
    expect(a.current()).toBe('sleep');
  });

  it('setBase to the same animation does not restart it', () => {
    const a = createAnimator();
    a.setBase('walk', 0);
    a.update(100);
    a.setBase('walk', 100);
    const p1 = a.update(200);
    const b = createAnimator();
    b.setBase('walk', 0);
    b.update(100);
    expect(a.update(300)).toEqual(b.update(300));
    expect(p1).toEqual(sampleAnimation('walk', 200));
  });

  it('a reaction plays over the base, then hands back to it', () => {
    const a = createAnimator({ blendMs: 100 });
    a.setBase('walk', 0);
    a.update(500);
    a.react('happy', 500);
    a.update(510);
    expect(a.current()).toBe('happy');
    a.update(500 + ANIMATIONS.happy.durationMs - 10);
    expect(a.current()).toBe('happy');
    a.update(500 + ANIMATIONS.happy.durationMs + 1);
    expect(a.current()).toBe('walk');
  });

  it('changing the base during a reaction waits for the reaction to finish', () => {
    const a = createAnimator();
    a.setBase('idle', 0);
    a.update(100);
    a.react('annoyed', 100);
    a.setBase('sleep', 300);
    a.update(400);
    expect(a.current()).toBe('annoyed');
    a.update(100 + ANIMATIONS.annoyed.durationMs + 5);
    expect(a.current()).toBe('sleep');
  });

  it('the pose never jumps between 60 fps frames while switching through every animation', () => {
    const a = createAnimator({ blendMs: 180 });
    const names = Object.keys(ANIMATIONS) as Array<keyof typeof ANIMATIONS>;
    let now = 0;
    let prev = a.update(now);
    for (const name of names) {
      if (ANIMATIONS[name].loop) a.setBase(name, now);
      else a.react(name, now);
      for (let i = 0; i < 90; i++) {
        now += 16;
        const p = a.update(now);
        // A fast run cycle legitimately moves legs ~0.3 rad per frame, and blends between far poses
        // move up to about 3.5 px or 0.7 rad per frame.
        const jump = maxJump(prev, p);
        expect(jump.px, `${name} at ${now}`).toBeLessThan(3.5);
        expect(jump.other, `${name} at ${now}`).toBeLessThan(0.7);
        prev = p;
      }
    }
  });

  it('adds blinks over open eyes only', () => {
    const a = createAnimator({ seed: 5 });
    a.setBase('idle', 0);
    let sawBlink = false;
    for (let t = 0; t < 12_000; t += 10) if (a.update(t).eyes === 2) sawBlink = true;
    expect(sawBlink).toBe(true);

    const s = createAnimator({ seed: 5 });
    s.setBase('sleep', 0);
    s.update(0);
    for (let t = 1000; t < 12_000; t += 10) expect(s.update(t).eyes).toBe(2); // asleep: always closed

    const h = createAnimator({ seed: 5, blendMs: 1 });
    h.setBase('idle', 0);
    h.react('happy', 0);
    for (let t = 200; t < 700; t += 10) expect(h.update(t).eyes).toBe(3); // squint is not overwritten
  });

  it('is deterministic for the same seed and calls', () => {
    const run = () => {
      const a = createAnimator({ seed: 9 });
      a.setBase('walk', 0);
      return Array.from({ length: 200 }, (_, i) => a.update(i * 16));
    };
    expect(run()).toEqual(run());
  });

  it('reports slower frame intervals for calm clips (sleep, idle) than for action clips', () => {
    const a = createAnimator();
    a.setBase('sleep', 0);
    a.update(0);
    const sleepInterval = a.frameIntervalMs();
    a.setBase('run', 10);
    a.update(10);
    expect(sleepInterval).toBeGreaterThan(a.frameIntervalMs());
  });
});
