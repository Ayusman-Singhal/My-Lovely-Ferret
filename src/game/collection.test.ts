import { describe, expect, it } from 'vitest';
import { FOUND_ITEMS } from '../core/simulate';
import { T0, makePet } from '../core/testkit';
import { albumProgress, albumRows, giftIn } from './collection';

describe('the album', () => {
  it('lists every possible gift in album order, all unknown for a new pet', () => {
    const rows = albumRows(makePet());
    expect(rows.map((r) => r.id)).toEqual(FOUND_ITEMS.map((i) => i.id));
    expect(rows.every((r) => !r.found && r.firstDate === null && r.count === 0)).toBe(true);
    expect(albumProgress(makePet())).toEqual({ found: 0, total: FOUND_ITEMS.length });
  });

  it('shows what was found with the owner-local first date and the count', () => {
    const pet = { ...makePet({ tzOffsetMin: 330 }), collection: { button: { first: T0, count: 3 }, coin: { first: T0 + 86_400_000, count: 1 } } };
    const rows = albumRows(pet);
    const button = rows.find((r) => r.id === 'button');
    expect(button).toMatchObject({ found: true, count: 3, tier: 'common' });
    expect(button?.firstDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(rows.find((r) => r.id === 'coin')).toMatchObject({ found: true, tier: 'rare' });
    expect(rows.find((r) => r.id === 'feather')?.found).toBe(false);
    expect(albumProgress(pet)).toEqual({ found: 2, total: FOUND_ITEMS.length });
  });

  it('tells the player about a gift in a batch of events, and ignores other events', () => {
    expect(giftIn([])).toBeNull();
    expect(giftIn([{ type: 'PET_STOLE_ITEM', payload: { itemId: 'sock' } }])).toBeNull();
    expect(
      giftIn([
        { type: 'PET_FOUND_ITEM', payload: { itemId: 'button' } },
        { type: 'PET_STOLE_ITEM', payload: { itemId: 'sock' } },
      ]),
    ).toBe('button');
  });
});
