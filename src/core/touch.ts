// Decides whether a touch on the pet counts as a "session" (docs/GAME_DESIGN.md §4): a long
// press of 2 seconds or more, or 3 or more taps within 10 seconds. A single tap only gets the
// pet's reaction, and repeated tapping never farms bond (guide §7.5). Pure: times are passed in.

export const LONG_PRESS_MS = 2000;
export const TAP_WINDOW_MS = 10_000;
export const TAPS_FOR_SESSION = 3;

export interface TouchTracker {
  down(nowMs: number): void;
  /** Call when the finger lifts. Returns whether this touch completes a session. */
  up(nowMs: number): { session: boolean };
  /** True while a press has lasted long enough to count as a session already. */
  isLongPress(nowMs: number): boolean;
  /** Forget everything, for example when the touch was cancelled. */
  cancel(): void;
}

export function createTouchTracker(): TouchTracker {
  let downAt: number | null = null;
  let taps: number[] = [];

  return {
    down(nowMs) {
      downAt = nowMs;
    },

    up(nowMs) {
      if (downAt === null) return { session: false };
      const held = nowMs - downAt;
      downAt = null;
      if (held >= LONG_PRESS_MS) {
        taps = [];
        return { session: true };
      }
      taps = [...taps.filter((t) => nowMs - t <= TAP_WINDOW_MS), nowMs];
      if (taps.length >= TAPS_FOR_SESSION) {
        taps = [];
        return { session: true };
      }
      return { session: false };
    },

    isLongPress: (nowMs) => downAt !== null && nowMs - downAt >= LONG_PRESS_MS,

    cancel() {
      downAt = null;
    },
  };
}
