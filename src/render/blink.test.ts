import { describe, expect, it } from 'vitest';
import { blinkFrame } from './blink';

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
