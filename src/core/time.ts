// Time helpers. src/core never reads a clock (guide §7.2, §7.3): time is always passed in
// as integer epoch milliseconds. Time of day comes from the owner's fixed UTC offset
// (tzOffsetMin), never from the device zone, so owner and caretaker devices agree.

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

/** Division that rounds toward negative infinity (correct for times before 1970). */
export function floorDiv(a: number, b: number): number {
  return Math.floor(a / b);
}

/** Modulo with the sign of the divisor, so the result is in [0, b). */
export function mod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

/** Minutes since local midnight, 0 to 1439. */
export function localMinuteOfDay(utcMs: number, tzOffsetMin: number): number {
  return mod(floorDiv(utcMs, MINUTE_MS) + tzOffsetMin, 1440);
}

/** Owner-local calendar date as "YYYY-MM-DD". Civil-from-days algorithm, integers only. */
export function localDate(utcMs: number, tzOffsetMin: number): string {
  const days = floorDiv(utcMs + tzOffsetMin * MINUTE_MS, DAY_MS);
  const z = days + 719468;
  const era = floorDiv(z, 146097);
  const doe = z - era * 146097;
  const yoe = floorDiv(doe - floorDiv(doe, 1460) + floorDiv(doe, 36524) - floorDiv(doe, 146096), 365);
  const doy = doe - (365 * yoe + floorDiv(yoe, 4) - floorDiv(yoe, 100));
  const mp = floorDiv(5 * doy + 2, 153);
  const day = doy - floorDiv(153 * mp + 2, 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export type HourClass = 'night' | 'nap' | 'day';

/** Sleep-pattern time class (docs/GAME_DESIGN.md §3.3). */
export function hourClass(minuteOfDay: number): HourClass {
  const hour = floorDiv(minuteOfDay, 60);
  if (hour >= 22 || hour < 7) return 'night';
  if (hour >= 12 && hour < 16) return 'nap';
  return 'day';
}

/** A source of "now" in epoch milliseconds. The game has exactly one (guide §25.7). */
export interface Clock {
  nowMs(): number;
}

/** A clock a test or the dev panel moves by hand. Never used in production code paths. */
export interface ManualClock extends Clock {
  set(ms: number): void;
  advance(ms: number): void;
}

export function createManualClock(startMs: number): ManualClock {
  let now = startMs;
  return {
    nowMs: () => now,
    set: (ms) => {
      now = ms;
    },
    advance: (ms) => {
      now += ms;
    },
  };
}

export type ResyncResult = 'same' | 'forward' | 'backward-ignored';

export interface SessionClock extends Clock {
  /**
   * Re-read the wall clock, for example when the tab becomes visible again. A backward
   * jump is ignored (no time passes), a forward jump is adopted (guide §7.3).
   */
  resync(): ResyncResult;
}

/**
 * Wall time is read once, then the clock follows the monotonic timer, so changing the
 * device clock mid-session has no effect until resync(). The platform layer passes
 * Date.now and performance.now. Kept here, with injected readers, so it is testable.
 */
export function createSessionClock(readWallMs: () => number, readMonotonicMs: () => number): SessionClock {
  let wallBase = readWallMs();
  let monoBase = readMonotonicMs();
  const nowMs = (): number => wallBase + (readMonotonicMs() - monoBase);
  return {
    nowMs,
    resync() {
      const current = nowMs();
      const wall = readWallMs();
      if (wall < current) return 'backward-ignored';
      wallBase = wall;
      monoBase = readMonotonicMs();
      return wall === current ? 'same' : 'forward';
    },
  };
}

/**
 * A session clock that runs `speed` times faster than real time. For the dev panel and the
 * preview page (`?speed=60` shows a day in 24 minutes), so time-based behavior can be watched
 * without waiting. It is still the single time source: nothing patches Date (guide §25.7).
 */
export function createScaledClock(readWallMs: () => number, readMonotonicMs: () => number, speed: number): Clock {
  const wallBase = readWallMs();
  const monoBase = readMonotonicMs();
  return { nowMs: () => wallBase + (readMonotonicMs() - monoBase) * speed };
}
