import type { Mood, Personality, PetState } from './types';

/**
 * Mood is derived, never stored (guide §7.1, docs/GAME_DESIGN.md §5). First matching rule wins.
 */
export function deriveMood(
  state: Pick<PetState, 'hunger' | 'hydration' | 'energy' | 'happiness'>,
  personality: Pick<Personality, 'mischief'>,
): Mood {
  if (state.hunger < 3000 || state.hydration < 3000) return 'needy';
  if (state.energy < 3000) return 'sleepy';
  if (state.happiness >= 7000 && state.energy >= 6000 && personality.mischief >= 60) return 'playful';
  if (state.happiness >= 7500) return 'happy';
  return 'content';
}
