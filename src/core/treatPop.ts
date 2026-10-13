// Treat pop (docs/GAME_DESIGN.md §7, guide §7.8). The simplest game that works: three cups
// sit in a row over the room and a big treat pops out of one of them. Tap the treat.
// No room mapping, no choices, no fake-outs: tap exactly what you see. Pure and
// deterministic: the view feeds in taps, the seed fixes the order. Only the coarse
// band 0..3 leaves the game.

import { createRng, hashString } from './rng';

export const TREAT_POP = {
  /** Six treats a game. */
  rounds: 6,
  /** How long a treat stays up: generous on purpose. */
  showMs: 1600,
  /** A breather between treats. */
  gapMs: 600,
  /** Three cups in a row; the treat pops out of one of them. */
  cells: 3,
} as const;

export type TreatPhase = 'show' | 'gap';

export interface TreatPopState {
  elapsedMs: number;
  /** Current round, 0-based. */
  round: number;
  phase: TreatPhase;
  /** Time spent in the current phase. */
  phaseMs: number;
  /** Which cell the treat is in each round. */
  spots: readonly number[];
  /** Treats tapped so far. */
  tapped: number;
  over: boolean;
}

export function createTreatPop(seedText: string): TreatPopState {
  const rng = createRng(hashString(seedText));
  const spots: number[] = [];
  for (let r = 0; r < TREAT_POP.rounds; r++) {
    // Any cell, but never the same one twice in a row: variety without confusion.
    let cell = rng.int(TREAT_POP.cells);
    if (spots.length > 0 && cell === spots[spots.length - 1]) cell = (cell + 1) % TREAT_POP.cells;
    spots.push(cell);
  }
  return { elapsedMs: 0, round: 0, phase: 'gap', phaseMs: 0, spots, tapped: 0, over: false };
}

/** Coarse result for FinishPlay (docs/GAME_DESIGN.md §7). */
export function bandFromTaps(taps: number): 0 | 1 | 2 | 3 {
  if (taps >= 5) return 3;
  if (taps >= 3) return 2;
  if (taps >= 1) return 1;
  return 0;
}

function isCell(n: number): n is number {
  return Number.isInteger(n) && n >= 0 && n < TREAT_POP.cells;
}

/** Advance the game by `dtMs`. Taps are applied separately with tapTreat. */
export function stepTreatPop(state: TreatPopState, dtMs: number): TreatPopState {
  if (state.over || dtMs <= 0) return state;
  const elapsedMs = state.elapsedMs + dtMs;
  let { round, phase, phaseMs } = state;
  const { tapped } = state;
  phaseMs += dtMs;
  if (phase === 'gap' && phaseMs >= TREAT_POP.gapMs) {
    phase = 'show';
    phaseMs -= TREAT_POP.gapMs;
  } else if (phase === 'show' && phaseMs >= TREAT_POP.showMs) {
    // Too slow: the treat sinks. No penalty, the next one is already coming.
    phase = 'gap';
    phaseMs -= TREAT_POP.showMs;
    const next = round + 1;
    if (next >= TREAT_POP.rounds) {
      return { ...state, elapsedMs, over: true };
    }
    round = next;
  }
  return { ...state, elapsedMs, round, phase, phaseMs, tapped };
}

/** The player taps a cup. Only a tap on the cup with the shown treat scores. */
export function tapTreat(state: TreatPopState, cell: number): TreatPopState {
  if (state.over || state.phase !== 'show' || !isCell(cell)) return state;
  if (cell !== state.spots[state.round]) return state;
  const next = state.round + 1;
  if (next >= TREAT_POP.rounds) {
    return { ...state, elapsedMs: state.elapsedMs, tapped: state.tapped + 1, over: true };
  }
  return { ...state, tapped: state.tapped + 1, round: next, phase: 'gap', phaseMs: 0 };
}
