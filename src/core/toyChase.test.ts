import { describe, expect, it } from 'vitest';
import { CHASE, bandFromCatches, createChase, stepChase, type ChaseState } from './toyChase';
import { LONG_PRESS_MS, TAPS_FOR_SESSION, TAP_WINDOW_MS, createTouchTracker } from './touch';

const FRAME = 16;

/** Play a whole game. `toyAt(t)` gives the pointer position at time t (ms). */
function play(toyAt: (t: number) => number, start = createChase(180, toyAt(0))): ChaseState {
  let s = start;
  for (let t = FRAME; !s.over; t += FRAME) s = stepChase(s, FRAME, toyAt(t));
  return s;
}

describe('bandFromCatches (docs/GAME_DESIGN.md §7)', () => {
  it('maps 0-1, 2-4, 5-7, 8+ to bands 0, 1, 2, 3', () => {
    const bands = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 20].map(bandFromCatches);
    expect(bands).toEqual([0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3]);
  });
});

describe('stepChase', () => {
  it('ends after 20 seconds', () => {
    const s = play(() => 180);
    expect(s.over).toBe(true);
    expect(s.elapsedMs).toBeGreaterThanOrEqual(CHASE.durationMs);
    expect(s.elapsedMs).toBeLessThan(CHASE.durationMs + FRAME);
    // A finished game ignores further steps.
    expect(stepChase(s, FRAME, 100).catches).toBe(s.catches);
  });

  it('the ferret runs toward the toy at its own speed, no faster', () => {
    let s = createChase(130, 130);
    for (let t = FRAME; t <= 1000; t += FRAME) s = stepChase(s, FRAME, 300);
    expect(s.ferretX).toBeGreaterThan(130);
    expect(s.ferretX - 130).toBeLessThanOrEqual((CHASE.ferretSpeed * 1000) / 1000 + 1);
    expect(s.facing).toBe(1);
  });

  it('stays inside its walking range, even when the toy is dragged past the edge', () => {
    let s = createChase(180, 180);
    for (let t = FRAME; t <= 10_000; t += FRAME) {
      s = stepChase(s, FRAME, t % 2000 < 1000 ? -50 : 500);
      expect(s.ferretX).toBeGreaterThanOrEqual(CHASE.minX);
      expect(s.ferretX).toBeLessThanOrEqual(CHASE.maxX);
    }
  });

  it('a toy that never moves is caught once and then cannot be farmed', () => {
    const s = play(() => 200);
    expect(s.catches).toBe(1);
    expect(bandFromCatches(s.catches)).toBe(0);
  });

  it('a toy that never stops moving fast cannot be caught', () => {
    // Sweeping 130 px in 400 ms is about 325 px per second, far above the slow limit.
    const s = play((t) => 150 + 130 * Math.abs(((t / 400) % 2) - 1));
    expect(s.catches).toBe(0);
  });

  it('drag, stop, drag, stop: many catches, and a good player reaches band 3', () => {
    // Every 2 seconds: slide the toy 110 px away in 0.4 s, then hold it still.
    const toyAt = (t: number): number => {
      const cycle = Math.floor(t / 2000);
      const local = t - cycle * 2000;
      const from = cycle % 2 === 0 ? 150 : 260;
      const to = cycle % 2 === 0 ? 260 : 150;
      return local < 400 ? from + ((to - from) * local) / 400 : to;
    };
    const s = play(toyAt);
    expect(s.catches).toBeGreaterThanOrEqual(8);
    expect(bandFromCatches(s.catches)).toBe(3);
  });

  it('a casual player who moves the toy every few seconds gets a middle band', () => {
    const toyAt = (t: number): number => {
      const cycle = Math.floor(t / 4000);
      const local = t - cycle * 4000;
      const from = cycle % 2 === 0 ? 150 : 260;
      const to = cycle % 2 === 0 ? 260 : 150;
      return local < 600 ? from + ((to - from) * local) / 600 : to;
    };
    const s = play(toyAt);
    expect(bandFromCatches(s.catches)).toBeGreaterThanOrEqual(1);
    expect(bandFromCatches(s.catches)).toBeLessThanOrEqual(2);
  });

  it('dragging between two spots always re-arms, wherever the first catch happened', () => {
    // A real browser run found the first version stuck at one catch: the first catch was at 217, and
    // the drag between 150 and 260 never got 90 px away from that one spot.
    const toyAt = (tMs: number): number => (Math.floor(tMs / 2000) % 2 === 0 ? 150 : 260);
    const s = play(toyAt, createChase(180, 217));
    expect(s.catches).toBeGreaterThanOrEqual(8);
  });

  it('re-arms even when the ferret turns around, and a tiny wiggle does not re-arm', () => {
    // Slide the toy from one side of the ferret to the other, then hold: turning must not hide the drag.
    let s = createChase(190, 150);
    for (let tMs = 16; tMs <= 3000; tMs += 16) s = stepChase(s, 16, 150);
    expect(s.catches).toBe(1);
    for (let tMs = 16; tMs <= 600; tMs += 16) s = stepChase(s, 16, 150 + (110 * tMs) / 600);
    for (let tMs = 16; tMs <= 3000; tMs += 16) s = stepChase(s, 16, 260);
    expect(s.catches).toBe(2);
    // Wiggling 5 px back and forth for many seconds does not add catches.
    let w = createChase(190, 150);
    for (let tMs = 16; tMs <= 8000; tMs += 16) w = stepChase(w, 16, 150 + (Math.floor(tMs / 500) % 2 === 0 ? 0 : 4));
    expect(w.catches).toBe(1);
  });

  it('a catch makes the ferret pause and flags the frame once', () => {
    let s = createChase(180, 220);
    let flagged = 0;
    let pausedFrames = 0;
    for (let t = FRAME; t <= 3000; t += FRAME) {
      s = stepChase(s, FRAME, 220);
      if (s.justCaught) flagged++;
      if (s.pauseMs > 0) pausedFrames++;
    }
    expect(flagged).toBe(1);
    expect(pausedFrames).toBeGreaterThan(30);
  });

  it('is deterministic', () => {
    const toyAt = (t: number) => 150 + 100 * Math.abs(((t / 700) % 2) - 1); // a triangle wave
    expect(play(toyAt)).toEqual(play(toyAt));
  });

  it('ignores zero or negative time steps', () => {
    const s = createChase(180, 200);
    expect(stepChase(s, 0, 300).elapsedMs).toBe(0);
    expect(stepChase(s, -5, 300).ferretX).toBe(180);
  });
});

describe('touch tracker', () => {
  it('a single tap is not a session', () => {
    const t = createTouchTracker();
    t.down(1000);
    expect(t.up(1100)).toEqual({ session: false });
  });

  it('a press of 2 seconds or more is a session, and isLongPress reports it while held', () => {
    const t = createTouchTracker();
    t.down(1000);
    expect(t.isLongPress(2999)).toBe(false);
    expect(t.isLongPress(1000 + LONG_PRESS_MS)).toBe(true);
    expect(t.up(3100)).toEqual({ session: true });
    t.down(5000);
    expect(t.up(5000 + LONG_PRESS_MS - 1)).toEqual({ session: false });
  });

  it('three taps within 10 seconds make a session, then the count starts over', () => {
    const t = createTouchTracker();
    const results: boolean[] = [];
    for (const at of [0, 1000, 2000, 3000, 4000, 5000]) {
      t.down(at);
      results.push(t.up(at + 80).session);
    }
    expect(results).toEqual([false, false, true, false, false, true]);
    expect(TAPS_FOR_SESSION).toBe(3);
  });

  it('taps spread over more than 10 seconds never add up', () => {
    const t = createTouchTracker();
    const results: boolean[] = [];
    for (let i = 0; i < 10; i++) {
      t.down(i * (TAP_WINDOW_MS / 2 + 500));
      results.push(t.up(i * (TAP_WINDOW_MS / 2 + 500) + 50).session);
    }
    expect(results.every((r) => !r)).toBe(true);
  });

  it('cancel forgets a press in progress, and an up without a down does nothing', () => {
    const t = createTouchTracker();
    expect(t.up(10)).toEqual({ session: false });
    t.down(0);
    t.cancel();
    expect(t.up(5000)).toEqual({ session: false });
    expect(t.isLongPress(9999)).toBe(false);
  });
});
