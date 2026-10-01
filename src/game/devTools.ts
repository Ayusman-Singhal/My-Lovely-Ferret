// Dev panel helpers (guide §25.7). Pure functions that return a changed pet; the panel hands the
// result to the controller. They exist for testing time and needs by hand, never in normal play.

import type { PetRecord, PetState } from '../core/types';

export type NeedKey = 'hunger' | 'hydration' | 'energy' | 'happiness' | 'bond';

export const NEED_KEYS: readonly NeedKey[] = ['hunger', 'hydration', 'energy', 'happiness', 'bond'];

const clampNeed = (value: number): number => Math.min(10_000, Math.max(0, Math.round(value)));

/** Set one need directly. `percent` is the 0..100 number the player sees; the pet stores hundredths. */
export function setNeed(pet: PetRecord, key: NeedKey, percent: number): PetRecord {
  return { ...pet, state: { ...pet.state, [key]: clampNeed(percent * 100) } };
}

/**
 * Pretend the player was away for `ms`: move every time the pet remembers back by that much, so the
 * normal catch-up simulation runs over the gap with the real clock. Safe on a real save, unlike
 * moving the clock forward, which would leave the saved time ahead of the real time.
 */
export function pretendAway(pet: PetRecord, ms: number): PetRecord {
  const back = (value: number | null): number | null => (value === null ? null : value - ms);
  const s = pet.state;
  const state: PetState = {
    ...s,
    lastInteractionTime: s.lastInteractionTime - ms,
    sleepStartedAt: back(s.sleepStartedAt),
    lastStoleAt: back(s.lastStoleAt),
    lastPlayRewardAt: back(s.lastPlayRewardAt),
    playStartedAt: back(s.playStartedAt),
  };
  return { ...pet, state, timestamps: { ...pet.timestamps, lastSimulationTime: pet.timestamps.lastSimulationTime - ms } };
}

/** The dev panel is offered when the address has `dev` (for example `?dev=1`). */
export function devRequested(search: string): boolean {
  return new URLSearchParams(search).has('dev');
}
