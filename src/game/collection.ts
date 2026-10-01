// The collection album (Part 1L.4): what the ferret has brought as gifts, in the order of the album,
// with the ones still out there shown as unknowns. Pure, so it is tested without the UI.

import { FOUND_ITEMS } from '../core/simulate';
import { localDate } from '../core/time';
import type { PetRecord } from '../core/types';

export type GiftTier = (typeof FOUND_ITEMS)[number]['tier'];

export interface AlbumRow {
  id: string;
  tier: GiftTier;
  found: boolean;
  /** Owner-local date of the first time, "YYYY-MM-DD". Null while not found. */
  firstDate: string | null;
  count: number;
}

export function albumRows(pet: PetRecord): AlbumRow[] {
  return FOUND_ITEMS.map((item) => {
    const entry = pet.collection[item.id];
    return {
      id: item.id,
      tier: item.tier,
      found: entry !== undefined,
      firstDate: entry ? localDate(entry.first, pet.tzOffsetMin) : null,
      count: entry?.count ?? 0,
    };
  });
}

export function albumProgress(pet: PetRecord): { found: number; total: number } {
  return { found: FOUND_ITEMS.filter((item) => pet.collection[item.id] !== undefined).length, total: FOUND_ITEMS.length };
}

/** The gift in a batch of events, if any, so the screen can say the pet brought something. */
export function giftIn(events: ReadonlyArray<{ type: string; payload: Record<string, string | number> }>): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e && e.type === 'PET_FOUND_ITEM' && typeof e.payload['itemId'] === 'string') return e.payload['itemId'];
  }
  return null;
}
