// What the shop screen shows (Part 1L.5): the catalog with, for this pet, what is owned, worn, and
// affordable. Pure, so the rules the screen follows are tested without it.

import { CATALOG, type ItemSlot } from '../core/catalog';
import type { PetRecord } from '../core/types';

export interface ShopRow {
  id: string;
  slot: ItemSlot;
  price: number;
  owned: boolean;
  worn: boolean;
  /** For an item not yet owned: how many more shinies it takes, 0 when the pet can buy it now. */
  missing: number;
}

export function shopRows(pet: PetRecord): ShopRow[] {
  const { shinies, items, equipped } = pet.inventory;
  return CATALOG.map((item) => {
    const owned = items.includes(item.id);
    return {
      id: item.id,
      slot: item.slot,
      price: item.price,
      owned,
      worn: equipped.includes(item.id),
      missing: owned ? 0 : Math.max(0, item.price - shinies),
    };
  });
}
