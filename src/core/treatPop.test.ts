import { describe, expect, it } from 'vitest';
import { bandFromTaps, createTreatPop, stepTreatPop, tapTreat, TREAT_POP, type TreatPopState } from './treatPop';

const FRAME = 16;

/** Run until the game ends. `onShow` taps a cell whenever a treat is up. */
function play(start: TreatPopState, onShow: (s: TreatPopState) => number | null): TreatPopState {
  let s = start;
  let guard = 0;
  while (!s.over && guard++ < 20000) {
    s = stepTreatPop(s, FRAME);
    if (s.phase === 'show') {
      const tap = onShow(s);
      if (tap !== null) s = tapTreat(s, tap);
    }
  }
  return s;
}

describe('bandFromTaps (docs/GAME_DESIGN.md §7)', () => {
  it('maps 0, 1-2, 3-4, 5-6 to bands 0, 1, 2, 3', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(bandFromTaps)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });
});

describe('treat pop', () => {
  it('is deterministic for the same seed', () => {
    const a = play(createTreatPop('seed-1'), () => null);
    const b = play(createTreatPop('seed-1'), () => null);
    expect(a).toEqual(b);
  });

  it('a player who taps every treat gets them all', () => {
    const s = play(createTreatPop('quick'), (g) => g.spots[g.round] ?? 0);
    expect(s.tapped).toBe(TREAT_POP.rounds);
    expect(bandFromTaps(s.tapped)).toBe(3);
  });

  it('a player who never taps gets nothing, and the game still ends', () => {
    const s = play(createTreatPop('idle'), () => null);
    expect(s.tapped).toBe(0);
    expect(bandFromTaps(s.tapped)).toBe(0);
  });

  it('wrong cells never score and do not eat the treat', () => {
    let s = createTreatPop('wrong');
    let guard = 0;
    while (s.phase !== 'show' && guard++ < 20000) s = stepTreatPop(s, FRAME);
    const spot = s.spots[s.round] as number;
    const before = s.tapped;
    s = tapTreat(s, (spot + 1) % TREAT_POP.cells);
    expect(s.tapped).toBe(before);
    expect(s.phase).toBe('show'); // still up, the player can try again
    s = tapTreat(s, spot);
    expect(s.tapped).toBe(before + 1);
  });

  it('never shows the same cell twice in a row', () => {
    for (let i = 0; i < 20; i++) {
      const s = createTreatPop(`variety-${i}`);
      for (let r = 1; r < s.spots.length; r++) {
        expect(s.spots[r]).not.toBe(s.spots[r - 1]);
      }
    }
  });

  it('taps outside a shown treat do nothing, and bad cells are ignored', () => {
    let s = createTreatPop('early');
    expect(tapTreat(s, 0)).toBe(s); // gap: nothing up yet
    expect(tapTreat(s, 9)).toBe(s); // not a cell
    let guard = 0;
    while (s.phase !== 'show' && guard++ < 20000) s = stepTreatPop(s, FRAME);
    expect(tapTreat(s, -1)).toBe(s);
  });

  it('ignores zero or negative time steps', () => {
    const s = createTreatPop('dt');
    expect(stepTreatPop(s, 0)).toBe(s);
    expect(stepTreatPop(s, -5)).toBe(s);
  });
});
