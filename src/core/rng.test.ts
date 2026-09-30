import { describe, expect, it } from 'vitest';
import { createRng, hashString, simulationSeed } from './rng';

// Reference mulberry32 as widely published (float output), written independently of the
// integer implementation under test.
function referenceMulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('createRng', () => {
  it('matches the reference mulberry32 sequence', () => {
    for (const seed of [0, 1, 42, 0xdeadbeef, -7]) {
      const rng = createRng(seed);
      const ref = referenceMulberry32(seed);
      for (let i = 0; i < 100; i++) {
        expect(rng.nextU32() / 4294967296).toBe(ref());
      }
    }
  });

  it('is deterministic: same seed, same sequence', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    for (let i = 0; i < 50; i++) expect(a.nextU32()).toBe(b.nextU32());
  });

  it('differs for different seeds', () => {
    expect(createRng(1).nextU32()).not.toBe(createRng(2).nextU32());
  });

  it('int stays in [0, n)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('range includes both ends', () => {
    const rng = createRng(9);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(rng.range(3, 5));
    expect([...seen].sort()).toEqual([3, 4, 5]);
  });

  it('chance(0, n) never fires and chance(n, n) always fires', () => {
    const rng = createRng(3);
    for (let i = 0; i < 200; i++) {
      expect(rng.chance(0, 10)).toBe(false);
      expect(rng.chance(10, 10)).toBe(true);
    }
  });

  it('pickWeighted respects weights, skips zeros, and rejects bad input', () => {
    const rng = createRng(11);
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 4000; i++) {
      const v = rng.pickWeighted(['a', 'b', 'c'], [3, 1, 0]);
      counts[v] = (counts[v] ?? 0) + 1;
    }
    expect(counts['c']).toBe(0);
    expect(counts['a']).toBeGreaterThan(counts['b'] as number);
    expect((counts['a'] as number) / 4000).toBeGreaterThan(0.7);
    expect(() => rng.pickWeighted(['a'], [0])).toThrow();
    expect(() => rng.pickWeighted(['a', 'b'], [1])).toThrow();
    expect(() => rng.pickWeighted([], [])).toThrow();
  });

  it('pick returns an element and rejects an empty array', () => {
    const rng = createRng(5);
    expect(['a', 'b', 'c']).toContain(rng.pick(['a', 'b', 'c']));
    expect(() => rng.pick([])).toThrow();
  });
});

describe('hashString', () => {
  it('matches known FNV-1a 32-bit vectors', () => {
    expect(hashString('')).toBe(0x811c9dc5);
    expect(hashString('a')).toBe(0xe40c292c);
    expect(hashString('foobar')).toBe(0xbf9cf968);
  });
});

describe('simulationSeed', () => {
  it('depends on both pet id and start time', () => {
    const base = simulationSeed('pet-1', 1_790_000_000_000);
    expect(simulationSeed('pet-1', 1_790_000_000_000)).toBe(base);
    expect(simulationSeed('pet-2', 1_790_000_000_000)).not.toBe(base);
    expect(simulationSeed('pet-1', 1_790_000_600_000)).not.toBe(base);
  });
});
