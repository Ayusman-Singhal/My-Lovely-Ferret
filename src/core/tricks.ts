// Tricks the ferret learns as the bond grows (Part 1L.7). Pure data: which bond opens which trick.
// Bond only goes up (nothing in the game lowers it), so "learned" is simply "the bond is at least
// this", and the moment a command carries it past a line is a memorable event (guide §7.7).
// Bond is in hundredths like the needs (0 to 10000). How a trick looks is in render/plan.ts.

export interface TrickDef {
  id: string;
  /** Bond needed, in hundredths. */
  bond: number;
}

/** Ordered by the bond they need. A new pet starts at 1000, and care adds about 450 on a busy day. */
export const TRICKS: readonly TrickDef[] = [
  { id: 'sit_up', bond: 1500 },
  { id: 'bow', bond: 2500 },
  { id: 'spin', bond: 4000 },
  { id: 'dance', bond: 6000 },
];

export function findTrick(id: string): TrickDef | undefined {
  return TRICKS.find((trick) => trick.id === id);
}

export function unlockedTricks(bond: number): TrickDef[] {
  return TRICKS.filter((trick) => bond >= trick.bond);
}

/** The tricks a change of bond from `before` to `after` just opened. */
export function newlyUnlocked(before: number, after: number): TrickDef[] {
  return TRICKS.filter((trick) => before < trick.bond && after >= trick.bond);
}
