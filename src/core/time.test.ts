import { describe, expect, it } from 'vitest';
import { clamp, idiv, sign, toDisplay } from './fixed';
import {
  DAY_MS,
  createManualClock,
  createSessionClock,
  floorDiv,
  hourClass,
  localDate,
  localMinuteOfDay,
  mod,
} from './time';

describe('fixed', () => {
  it('idiv truncates toward zero', () => {
    expect(idiv(7, 2)).toBe(3);
    expect(idiv(-7, 2)).toBe(-3);
    expect(idiv(6, 3)).toBe(2);
    expect(idiv(0, 5)).toBe(0);
  });

  it('clamp, sign, and toDisplay', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(sign(-9)).toBe(-1);
    expect(sign(0)).toBe(0);
    expect(sign(3)).toBe(1);
    expect(toDisplay(7499)).toBe(74);
    expect(toDisplay(10000)).toBe(100);
  });
});

describe('floorDiv and mod', () => {
  it('round toward negative infinity for negatives', () => {
    expect(floorDiv(-1, 60)).toBe(-1);
    expect(floorDiv(-60, 60)).toBe(-1);
    expect(floorDiv(59, 60)).toBe(0);
    expect(mod(-1, 1440)).toBe(1439);
    expect(mod(1440, 1440)).toBe(0);
  });
});

describe('localMinuteOfDay', () => {
  it('applies the fixed offset, not the device zone', () => {
    const noonUtc = Date.UTC(2026, 9, 1, 12, 0, 0);
    expect(localMinuteOfDay(noonUtc, 0)).toBe(720);
    expect(localMinuteOfDay(noonUtc, 330)).toBe(720 + 330); // India, UTC+5:30
    expect(localMinuteOfDay(noonUtc, -300)).toBe(720 - 300); // UTC-5
  });

  it('wraps around midnight in both directions', () => {
    const t = Date.UTC(2026, 9, 1, 23, 0, 0);
    expect(localMinuteOfDay(t, 120)).toBe(60); // 01:00 next day
    const early = Date.UTC(2026, 9, 1, 1, 0, 0);
    expect(localMinuteOfDay(early, -120)).toBe(23 * 60); // 23:00 previous day
  });

  it('works before 1970', () => {
    expect(localMinuteOfDay(-60_000, 0)).toBe(1439);
  });
});

describe('localDate', () => {
  it('formats known dates', () => {
    expect(localDate(0, 0)).toBe('1970-01-01');
    expect(localDate(Date.UTC(2000, 1, 29, 0, 0, 0), 0)).toBe('2000-02-29');
    expect(localDate(Date.UTC(2026, 9, 1, 9, 0, 0), 0)).toBe('2026-10-01');
    expect(localDate(Date.UTC(2100, 2, 1, 0, 0, 0), 0)).toBe('2100-03-01'); // 2100 is not a leap year
    expect(localDate(-DAY_MS, 0)).toBe('1969-12-31');
  });

  it('follows the owner offset across the date line', () => {
    const t = Date.UTC(2026, 9, 1, 20, 0, 0); // 20:00 UTC
    expect(localDate(t, 0)).toBe('2026-10-01');
    expect(localDate(t, 330)).toBe('2026-10-02'); // 01:30 next day in India
    expect(localDate(t, -300)).toBe('2026-10-01');
    expect(localDate(Date.UTC(2026, 9, 1, 2, 0, 0), -300)).toBe('2026-09-30');
  });

  it('matches Date for many days', () => {
    // Independent check against the engine's own calendar for 3000 consecutive days.
    for (let d = 0; d < 3000; d++) {
      const t = Date.UTC(2020, 0, 1) + d * DAY_MS + 12_345;
      expect(localDate(t, 0)).toBe(new Date(t).toISOString().slice(0, 10));
    }
  });
});

describe('hourClass', () => {
  it('splits the day into night, nap, and day', () => {
    expect(hourClass(0)).toBe('night');
    expect(hourClass(6 * 60 + 59)).toBe('night');
    expect(hourClass(7 * 60)).toBe('day');
    expect(hourClass(11 * 60 + 59)).toBe('day');
    expect(hourClass(12 * 60)).toBe('nap');
    expect(hourClass(15 * 60 + 59)).toBe('nap');
    expect(hourClass(16 * 60)).toBe('day');
    expect(hourClass(21 * 60 + 59)).toBe('day');
    expect(hourClass(22 * 60)).toBe('night');
    expect(hourClass(1439)).toBe('night');
  });
});

describe('manual clock', () => {
  it('moves only when told to', () => {
    const clock = createManualClock(1000);
    expect(clock.nowMs()).toBe(1000);
    clock.advance(500);
    expect(clock.nowMs()).toBe(1500);
    clock.set(42);
    expect(clock.nowMs()).toBe(42);
  });
});

describe('session clock (guide §7.3)', () => {
  function fakeReaders(wall: number, mono: number) {
    const state = { wall, mono };
    return {
      state,
      readWall: () => state.wall,
      readMono: () => state.mono,
    };
  }

  it('follows the monotonic timer, ignoring wall changes mid-session', () => {
    const r = fakeReaders(1_000_000, 50);
    const clock = createSessionClock(r.readWall, r.readMono);
    expect(clock.nowMs()).toBe(1_000_000);
    r.state.mono += 5000;
    r.state.wall -= 999_000; // the player sets the device clock back
    expect(clock.nowMs()).toBe(1_005_000);
  });

  it('adopts a forward jump on resync', () => {
    const r = fakeReaders(1_000_000, 50);
    const clock = createSessionClock(r.readWall, r.readMono);
    r.state.mono += 1000; // the tab was suspended, so the monotonic timer barely moved
    r.state.wall += 3_600_000;
    expect(clock.resync()).toBe('forward');
    expect(clock.nowMs()).toBe(4_600_000);
    r.state.mono += 250;
    expect(clock.nowMs()).toBe(4_600_250);
  });

  it('ignores a backward jump on resync: no time passes', () => {
    const r = fakeReaders(1_000_000, 50);
    const clock = createSessionClock(r.readWall, r.readMono);
    r.state.mono += 2000;
    r.state.wall -= 500_000;
    expect(clock.resync()).toBe('backward-ignored');
    expect(clock.nowMs()).toBe(1_002_000);
  });

  it('reports "same" when nothing moved', () => {
    const r = fakeReaders(1_000_000, 50);
    const clock = createSessionClock(r.readWall, r.readMono);
    r.state.mono += 2000;
    r.state.wall += 2000;
    expect(clock.resync()).toBe('same');
  });
});
