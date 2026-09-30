// What the HUD shows for the pet's needs, and which changes are worth announcing to a screen
// reader. Pure, so it is tested without a browser. State is never shown by color alone
// (guide §9.3, §17): every meter also has an icon, a label, a number, and a level word.

import type { PetState } from '../core/types';

export type NeedId = 'hunger' | 'hydration' | 'energy' | 'happiness';
export type Level = 'low' | 'ok' | 'good';

export interface MeterModel {
  id: NeedId;
  /** i18n key of the label. */
  labelKey: string;
  /** 0 to 100, rounded down. */
  value: number;
  level: Level;
}

export const NEED_ORDER: readonly NeedId[] = ['hunger', 'hydration', 'energy', 'happiness'];
const LABEL_KEY: Record<NeedId, string> = {
  hunger: 'hud.hunger',
  hydration: 'hud.water',
  energy: 'hud.energy',
  happiness: 'hud.happiness',
};

/** Below 30 is low, 30 to 59 is OK, 60 and up is good. Input is hundredths. */
export function levelOf(hundredths: number): Level {
  if (hundredths < 3000) return 'low';
  if (hundredths < 6000) return 'ok';
  return 'good';
}

export function hudMeters(state: Pick<PetState, NeedId>): MeterModel[] {
  return NEED_ORDER.map((id) => ({
    id,
    labelKey: LABEL_KEY[id],
    value: Math.floor(state[id] / 100),
    level: levelOf(state[id]),
  }));
}

/**
 * Screen-reader announcements for a change of state (an aria-live region, guide §25.9). Only
 * real transitions, so it does not chatter: falling asleep, waking up, and a need first
 * becoming urgent (below 30).
 */
export function announcements(prev: PetState | null, next: PetState): string[] {
  if (!prev) return [];
  const keys: string[] = [];
  if (prev.sleepState === 'awake' && next.sleepState === 'asleep') keys.push('live.asleep');
  if (prev.sleepState === 'asleep' && next.sleepState === 'awake') keys.push('live.awake');
  if (prev.hunger >= 3000 && next.hunger < 3000) keys.push('live.hungry');
  if (prev.hydration >= 3000 && next.hydration < 3000) keys.push('live.thirsty');
  return keys;
}
