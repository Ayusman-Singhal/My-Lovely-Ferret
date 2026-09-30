import { describe, expect, it } from 'vitest';
import { NAME_MAX_CLUSTERS, countClusters, validateName } from './name';

const FAMILY = '👨‍👩‍👧‍👦'; // one grapheme cluster made of 7 code points

describe('countClusters', () => {
  it('counts what the player sees, not code units', () => {
    expect(countClusters('Mochi')).toBe(5);
    expect(countClusters(FAMILY)).toBe(1);
    expect(FAMILY.length).toBeGreaterThan(5);
    expect(countClusters('é')).toBe(1);
    expect(countClusters('é')).toBe(1); // e plus combining accent
  });

  it('counts Devanagari conjuncts as single clusters', () => {
    const word = 'नमस्ते';
    expect(Array.from(word).length).toBe(6);
    expect(countClusters(word)).toBeLessThan(6);
  });
});

describe('validateName', () => {
  it('accepts normal names', () => {
    expect(validateName('Mochi')).toEqual({ ok: true });
    expect(validateName('A')).toEqual({ ok: true });
    expect(validateName('Sir Fluffington')).toEqual({ ok: true }); // inner space is fine
    expect(validateName('मोची')).toEqual({ ok: true });
  });

  it('accepts exactly 16 clusters, rejects 17', () => {
    expect(validateName('a'.repeat(NAME_MAX_CLUSTERS))).toEqual({ ok: true });
    expect(validateName('a'.repeat(NAME_MAX_CLUSTERS + 1))).toEqual({ ok: false, reason: 'too_long' });
    expect(validateName(FAMILY.repeat(16))).toEqual({ ok: true });
    expect(validateName(FAMILY.repeat(17))).toEqual({ ok: false, reason: 'too_long' });
  });

  it('rejects empty, edge whitespace, and control characters', () => {
    expect(validateName('')).toEqual({ ok: false, reason: 'empty' });
    expect(validateName(' Mochi')).toEqual({ ok: false, reason: 'edge_space' });
    expect(validateName('Mochi ')).toEqual({ ok: false, reason: 'edge_space' });
    expect(validateName('   ')).toEqual({ ok: false, reason: 'edge_space' });
    expect(validateName('Mo\u0000chi')).toEqual({ ok: false, reason: 'control_chars' });
    expect(validateName('Mo\nchi')).toEqual({ ok: false, reason: 'control_chars' });
  });
});
