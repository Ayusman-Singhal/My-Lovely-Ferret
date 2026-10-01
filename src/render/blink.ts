// Blink timing. Pure: it takes "now" as an argument and never reads a clock, so it is tested
// without a browser. The 3D scene plays the `blink` clip when this goes from open to closing.

import { hashString } from '../core/rng';

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
