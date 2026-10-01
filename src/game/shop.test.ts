import { describe, expect, it } from 'vitest';
import { CATALOG } from '../core/catalog';
import { makePet } from '../core/testkit';
import { CORNER_PARTS, FLOOR_SKINS, RUG_SKINS, WALL_SKINS } from '../render/decor3d';
import { OUTFIT_PARTS } from '../render/outfits3d';
import { shopRows } from './shop';

describe('shopRows', () => {
  it('lists the whole catalog; a new pet owns nothing and can afford only the cheap things', () => {
    const rows = shopRows(makePet());
    expect(rows.map((r) => r.id)).toEqual(CATALOG.map((i) => i.id));
    expect(rows.every((r) => !r.owned && !r.worn)).toBe(true);
    const bow = rows.find((r) => r.id === 'bow');
    expect(bow?.missing).toBe(Math.max(0, (bow?.price ?? 0) - 10));
    expect(rows.find((r) => r.id === 'scarf')?.missing).toBeGreaterThan(0);
  });

  it('marks owned and worn items, and an owned item is never "missing" shinies', () => {
    const base = makePet();
    const pet = { ...base, inventory: { shinies: 0, items: ['bow', 'scarf'], equipped: ['scarf'] } };
    const rows = shopRows(pet);
    expect(rows.find((r) => r.id === 'bow')).toMatchObject({ owned: true, worn: false, missing: 0 });
    expect(rows.find((r) => r.id === 'scarf')).toMatchObject({ owned: true, worn: true, missing: 0 });
    expect(rows.find((r) => r.id === 'flower')).toMatchObject({ owned: false, worn: false });
  });
});

describe('decorations in the room', () => {
  it('every decoration in the shop has a look, and every look is in the shop', () => {
    const decor = CATALOG.filter((i) => i.kind === 'decor');
    const looks = [...Object.keys(WALL_SKINS), ...Object.keys(FLOOR_SKINS), ...Object.keys(RUG_SKINS), ...Object.keys(CORNER_PARTS)];
    expect(looks.sort()).toEqual(decor.map((i) => i.id).sort());
  });

  it('each look is on the slot its name says', () => {
    const slotOf = (id: string) => CATALOG.find((i) => i.id === id)?.slot;
    for (const id of Object.keys(WALL_SKINS)) expect(slotOf(id)).toBe('wall');
    for (const id of Object.keys(FLOOR_SKINS)) expect(slotOf(id)).toBe('floor');
    for (const id of Object.keys(RUG_SKINS)) expect(slotOf(id)).toBe('rug');
    for (const id of Object.keys(CORNER_PARTS)) expect(slotOf(id)).toBe('corner');
  });
});

describe('outfits in the room', () => {
  it('every outfit in the shop has a look, and every look is in the shop', () => {
    const outfits = CATALOG.filter((i) => i.kind === 'outfit').map((i) => i.id);
    expect(Object.keys(OUTFIT_PARTS).sort()).toEqual([...outfits].sort());
    for (const parts of Object.values(OUTFIT_PARTS)) expect(parts.length).toBeGreaterThan(0);
  });
});
