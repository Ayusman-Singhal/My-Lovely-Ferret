// What the shinies can buy (Part 1L.5, guide §7.8, §14). Cosmetic only: nothing here is ever needed
// to keep the pet alive or happy, and basic food and water stay free. Shinies are earned by caring
// and are never sold for money. Prices are in shinies, a plain count (not hundredths).

export type ItemKind = 'outfit' | 'decor';
/** Where an item goes. Wearing a second item in the same slot takes the first off. */
export type ItemSlot = 'head' | 'neck' | 'wall' | 'floor' | 'rug' | 'corner';

export interface CatalogItem {
  id: string;
  kind: ItemKind;
  slot: ItemSlot;
  price: number;
}

export const CATALOG: readonly CatalogItem[] = [
  { id: 'bow', kind: 'outfit', slot: 'head', price: 20 },
  { id: 'flower', kind: 'outfit', slot: 'head', price: 25 },
  { id: 'party_hat', kind: 'outfit', slot: 'head', price: 55 },
  { id: 'bell_collar', kind: 'outfit', slot: 'neck', price: 30 },
  { id: 'bandana', kind: 'outfit', slot: 'neck', price: 35 },
  { id: 'scarf', kind: 'outfit', slot: 'neck', price: 45 },
  // The room (Part 1L.6): one wall colour, one floor, one rug, and one piece of furniture at a time.
  { id: 'wall_sage', kind: 'decor', slot: 'wall', price: 40 },
  { id: 'wall_sky', kind: 'decor', slot: 'wall', price: 40 },
  { id: 'wall_blush', kind: 'decor', slot: 'wall', price: 40 },
  { id: 'floor_pale', kind: 'decor', slot: 'floor', price: 40 },
  { id: 'floor_dark', kind: 'decor', slot: 'floor', price: 40 },
  { id: 'floor_slate', kind: 'decor', slot: 'floor', price: 50 },
  { id: 'rug_blue', kind: 'decor', slot: 'rug', price: 30 },
  { id: 'rug_green', kind: 'decor', slot: 'rug', price: 30 },
  { id: 'rug_red', kind: 'decor', slot: 'rug', price: 30 },
  { id: 'plant', kind: 'decor', slot: 'corner', price: 60 },
  { id: 'lamp', kind: 'decor', slot: 'corner', price: 70 },
];

export function findItem(id: string): CatalogItem | undefined {
  return CATALOG.find((item) => item.id === id);
}
