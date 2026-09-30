// Shared helpers for core tests. Not imported by game code.
import { createPet } from './pet';
import type { Personality, PetRecord, PetState } from './types';

/** 2026-10-01 09:00 UTC: "day" time class with a zero offset. */
export const T0 = Date.UTC(2026, 9, 1, 9, 0, 0);
/** 2026-10-01 22:00 UTC: start of the "night" time class with a zero offset. */
export const T_NIGHT = Date.UTC(2026, 9, 1, 22, 0, 0);

export const STEP = 600_000;
export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

export interface PetOverrides {
  id?: string;
  nowMs?: number;
  tzOffsetMin?: number;
  state?: Partial<PetState>;
  personality?: Partial<Personality>;
}

export function makePet(overrides: PetOverrides = {}): PetRecord {
  const nowMs = overrides.nowMs ?? T0;
  const base = createPet({
    id: overrides.id ?? 'pet-test-1',
    name: 'Mochi',
    nowMs,
    tzOffsetMin: overrides.tzOffsetMin ?? 0,
    deviceId: 'device-test',
  });
  return {
    ...base,
    state: { ...base.state, ...overrides.state },
    personality: { ...base.personality, ...overrides.personality },
  };
}
