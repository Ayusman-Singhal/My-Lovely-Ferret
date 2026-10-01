// What the "About my pet" screen shows (guide §25.3): the pet, and the tester's local counters.
// Pure, so it is tested without a screen. The counters never leave the device unless the tester
// sends feedback (feedback.ts).

import { DAY_MS, floorDiv } from '../core/time';
import type { FoodId, PetRecord, ToyId } from '../core/types';
import type { TesterCounters } from '../core/save';

export type Level = 'high' | 'mid' | 'low';

/** The word for a 0..100 trait, the same cut-offs the introduction uses. */
export const levelOf = (value: number): Level => (value >= 66 ? 'high' : value <= 33 ? 'low' : 'mid');

export interface AboutPet {
  name: string;
  coat: PetRecord['pet']['coat'];
  /** 1 on the day the pet was adopted. */
  dayNumber: number;
  /** Bond as the 0..100 number the player sees. */
  bond: number;
  traits: { mischief: Level; curiosity: Level; affection: Level };
  favoriteFood: FoodId;
  favoriteToy: ToyId;
  sessions: number;
  firstOpen: number;
  lastOpen: number;
  /** Interaction counts in a fixed order, zeros included, so the list never jumps around. */
  counts: Array<{ key: string; count: number }>;
}

const COUNT_ORDER = ['feed', 'water', 'play', 'sleep', 'pet'] as const;

export function buildAboutPet(pet: PetRecord, tester: TesterCounters, nowMs: number): AboutPet {
  const known = COUNT_ORDER.map((key) => ({ key: key as string, count: tester.interactionCounts[key] ?? 0 }));
  const others = Object.entries(tester.interactionCounts)
    .filter(([key]) => !(COUNT_ORDER as readonly string[]).includes(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => ({ key, count }));
  return {
    name: pet.pet.name,
    coat: pet.pet.coat,
    dayNumber: Math.max(1, floorDiv(nowMs - pet.pet.born, DAY_MS) + 1),
    bond: Math.floor(pet.state.bond / 100),
    traits: {
      mischief: levelOf(pet.personality.mischief),
      curiosity: levelOf(pet.personality.curiosity),
      affection: levelOf(pet.personality.affection),
    },
    favoriteFood: pet.state.favoriteFood,
    favoriteToy: pet.state.favoriteToy,
    sessions: tester.sessions,
    firstOpen: tester.firstOpenDate,
    lastOpen: tester.lastOpenDate,
    counts: [...known, ...others],
  };
}
