// Seeded integer RNG for the deterministic simulation (guide §7.2).
// Only integer arithmetic and Math.imul: no Math.random, no floats, so every JS engine
// gives the same sequence for the same seed.

export interface Rng {
  /** Next unsigned 32-bit integer, 0 to 4294967295. */
  nextU32(): number;
  /** Integer in [0, n). n must be an integer from 1 to 2^32. */
  int(n: number): number;
  /** Integer in [min, max], both inclusive. */
  range(min: number, max: number): number;
  /** True with probability num/den. */
  chance(num: number, den: number): boolean;
  /** One element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** One element, chosen with integer weights (one draw). Weights of 0 are never chosen. */
  pickWeighted<T>(items: readonly T[], weights: readonly number[]): T;
}

/** 32-bit FNV-1a hash of a string, used to turn ids and timestamps into seeds. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32. The seed can be any integer, it is reduced to 32 bits. */
export function createRng(seed: number): Rng {
  let a = seed | 0;

  const nextU32 = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };

  // The modulo bias is below 1 in 10^6 for the small n used by the game.
  const int = (n: number): number => nextU32() % n;

  return {
    nextU32,
    int,
    range: (min, max) => min + int(max - min + 1),
    chance: (num, den) => int(den) < num,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('pick() needs a non-empty array');
      return items[int(items.length)] as T;
    },
    pickWeighted<T>(items: readonly T[], weights: readonly number[]): T {
      if (items.length === 0 || items.length !== weights.length) {
        throw new Error('pickWeighted() needs equal-length, non-empty arrays');
      }
      const total = weights.reduce((sum, w) => sum + w, 0);
      if (total <= 0) throw new Error('pickWeighted() needs a positive total weight');
      let roll = int(total);
      for (let i = 0; i < items.length; i++) {
        const w = weights[i] as number;
        if (roll < w) return items[i] as T;
        roll -= w;
      }
      return items[items.length - 1] as T;
    },
  };
}

/**
 * Seed for one simulation step: petId plus the start time of that step in epoch ms
 * (guide §7.2, refinement R1: per step, so chunked and one-shot runs agree).
 */
export function simulationSeed(petId: string, stepStartMs: number): number {
  return hashString(`${petId}|${stepStartMs}`);
}
