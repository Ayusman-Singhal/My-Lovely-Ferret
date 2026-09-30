// "One tap prompt per interaction, shown the first time it is possible" (docs/GAME_DESIGN.md §9,
// guide §7.8). The counts live in the save (`tester.interactionCounts`), so a hint never comes
// back once the player has done the thing, even after a reload.

import type { Command } from '../core/commands';

export type Interaction = 'feed' | 'water' | 'play' | 'sleep' | 'pet';

/** The order hints are offered in. */
export const HINT_ORDER: readonly Interaction[] = ['feed', 'water', 'play', 'sleep', 'pet'];

/** Which counter a command feeds. */
export function interactionOf(command: Command): Interaction | null {
  switch (command.type) {
    case 'FeedPet':
      return 'feed';
    case 'GiveWater':
      return 'water';
    case 'StartPlay':
      return 'play';
    case 'PutToBed':
      return 'sleep';
    case 'PetTouch':
      return 'pet';
    case 'FinishPlay':
      return null;
  }
}

/** The first interaction the player has not done yet, or null when they have done them all. */
export function nextHint(counts: Readonly<Record<string, number>>): Interaction | null {
  return HINT_ORDER.find((i) => (counts[i] ?? 0) === 0) ?? null;
}
