import { describe, expect, it } from 'vitest';
import { CATALOG, findItem } from './catalog';
import { applyCommand, parseCommand } from './commands';
import { migrateV2toV3, validateSave, createEmptySave, type SaveFile } from './save';
import { FOUND_ITEMS, simulate } from './simulate';
import { DAY, HOUR, T0, makePet } from './testkit';
import { TUNING } from './tuning';

const hungry = () => makePet({ state: { hunger: 2000, hydration: 2000, energy: 8000, happiness: 5000, bond: 1000 } });
const withShinies = (n: number) => {
  const p = makePet();
  return { ...p, inventory: { ...p.inventory, shinies: n } };
};

describe('earning shinies', () => {
  it('a new pet starts with a few so the shop is not empty', () => {
    expect(makePet().inventory).toEqual({ shinies: TUNING.shinies.start, items: [], equipped: [] });
  });

  it('feeding and watering earn 1, a petting session 2, a played game 2 to 4, a short touch nothing', () => {
    const fed = applyCommand(hungry(), { type: 'FeedPet', foodId: 'kibble' }, T0 + 1000);
    expect(fed.outcome.ok && fed.outcome.shinyGain).toBe(TUNING.shinies.feed);
    const watered = applyCommand(hungry(), { type: 'GiveWater' }, T0 + 1000);
    expect(watered.pet.inventory.shinies).toBe(TUNING.shinies.start + TUNING.shinies.water);
    const session = applyCommand(makePet(), { type: 'PetTouch', session: true }, T0 + 1000);
    expect(session.pet.inventory.shinies).toBe(TUNING.shinies.start + TUNING.shinies.petSession);
    const tap = applyCommand(makePet(), { type: 'PetTouch', session: false }, T0 + 1000);
    expect(tap.pet.inventory.shinies).toBe(TUNING.shinies.start);
    for (const band of [1, 2, 3]) {
      const started = applyCommand(makePet(), { type: 'StartPlay', toyId: 'ball' }, T0 + 1000).pet;
      const finished = applyCommand(started, { type: 'FinishPlay', band }, T0 + 30_000);
      expect(finished.pet.inventory.shinies - TUNING.shinies.start, `band ${band}`).toBe(TUNING.shinies.play[band]);
    }
  });

  it('care earns at most the daily cap, then nothing until the next local day', () => {
    let pet = makePet();
    let t = T0 + 1000;
    for (let i = 0; i < 40; i++) {
      pet = applyCommand(pet, { type: 'PetTouch', session: true }, t).pet;
      t += 1000;
    }
    expect(pet.inventory.shinies).toBe(TUNING.shinies.start + TUNING.shinies.dailyCap);
    expect(pet.state.daily.shinies).toBe(TUNING.shinies.dailyCap);
    const nextDay = applyCommand(pet, { type: 'PetTouch', session: true }, t + DAY);
    expect(nextDay.pet.inventory.shinies).toBe(TUNING.shinies.start + TUNING.shinies.dailyCap + TUNING.shinies.petSession);
  });

  it('a refused command earns nothing', () => {
    const full = makePet({ state: { hunger: 9500 } });
    const r = applyCommand(full, { type: 'FeedPet', foodId: 'kibble' }, T0 + 1000);
    expect(r.outcome.ok).toBe(false);
    expect(r.pet.inventory.shinies).toBe(TUNING.shinies.start);
  });

  it('a gift adds its value on top, outside the daily cap, by tier', () => {
    const { pet, events } = simulate(makePet({ id: 'shiny-gifts', personality: { curiosity: 80 } }), T0 + 40 * DAY);
    const gifts = events.filter((e) => e.type === 'PET_FOUND_ITEM');
    expect(gifts.length).toBeGreaterThan(5);
    const expected = gifts.reduce((sum, e) => sum + TUNING.shinies.gift[findTier(String(e.payload['itemId']))], 0);
    expect(pet.inventory.shinies - TUNING.shinies.start).toBe(expected);
  });
});

function findTier(id: string): 'common' | 'odd' | 'rare' {
  return (FOUND_ITEMS.find((i) => i.id === id) as { tier: 'common' | 'odd' | 'rare' }).tier;
}

describe('the shop commands', () => {
  it('buying spends the shinies, owns the item, and puts it on', () => {
    const bow = findItem('bow');
    const r = applyCommand(withShinies(50), { type: 'BuyItem', itemId: 'bow' }, T0 + 1000);
    expect(r.outcome.ok).toBe(true);
    expect(r.pet.inventory).toEqual({ shinies: 50 - (bow?.price ?? 0), items: ['bow'], equipped: ['bow'] });
  });

  it('refuses an unknown item, one already owned, and one it cannot afford, and changes nothing', () => {
    const rich = withShinies(500);
    const owned = applyCommand(rich, { type: 'BuyItem', itemId: 'bow' }, T0 + 1000).pet;
    for (const [pet, itemId, reason] of [
      [rich, 'no_such_thing', 'unknown_item'],
      [owned, 'bow', 'already_owned'],
      [withShinies(1), 'scarf', 'not_enough_shinies'],
    ] as const) {
      const r = applyCommand(pet, { type: 'BuyItem', itemId }, T0 + 2000);
      expect(r.outcome).toMatchObject({ ok: false, reason });
      expect(r.pet.inventory).toEqual(pet.inventory);
    }
  });

  it('wearing a second item in the same slot takes the first off, and another slot keeps both', () => {
    let pet = withShinies(500);
    for (const itemId of ['bow', 'flower', 'scarf']) pet = applyCommand(pet, { type: 'BuyItem', itemId }, T0 + 1000).pet;
    expect(pet.inventory.equipped.sort()).toEqual(['flower', 'scarf']);
    pet = applyCommand(pet, { type: 'EquipItem', itemId: 'bow' }, T0 + 2000).pet;
    expect(pet.inventory.equipped.sort()).toEqual(['bow', 'scarf']);
    pet = applyCommand(pet, { type: 'UnequipItem', itemId: 'scarf' }, T0 + 3000).pet;
    expect(pet.inventory.equipped).toEqual(['bow']);
    expect(pet.inventory.items.sort()).toEqual(['bow', 'flower', 'scarf']); // still owned
  });

  it('cannot wear what it does not own, or take off what it does not wear', () => {
    const r = applyCommand(withShinies(500), { type: 'EquipItem', itemId: 'bow' }, T0 + 1000);
    expect(r.outcome).toMatchObject({ ok: false, reason: 'not_owned' });
    const u = applyCommand(withShinies(500), { type: 'UnequipItem', itemId: 'bow' }, T0 + 1000);
    expect(u.outcome).toMatchObject({ ok: false, reason: 'not_owned' });
  });

  it('shopping does not wake a sleeping pet', () => {
    const asleep = { ...withShinies(100), state: { ...makePet().state, sleepState: 'asleep' as const, sleepStartedAt: T0, energy: 3000 } };
    const r = applyCommand(asleep, { type: 'BuyItem', itemId: 'bow' }, T0 + 60_000);
    expect(r.outcome.ok).toBe(true);
    expect(r.pet.state.sleepState).toBe('asleep');
  });

  it('parseCommand accepts well-formed shop commands only', () => {
    expect(parseCommand({ type: 'BuyItem', itemId: 'bow' })).toEqual({ type: 'BuyItem', itemId: 'bow' });
    expect(parseCommand({ type: 'EquipItem', itemId: 'bow' })).toEqual({ type: 'EquipItem', itemId: 'bow' });
    expect(parseCommand({ type: 'BuyItem' })).toBeNull();
    expect(parseCommand({ type: 'BuyItem', itemId: '' })).toBeNull();
    expect(parseCommand({ type: 'BuyItem', itemId: 7 })).toBeNull();
    expect(parseCommand({ type: 'UnequipItem', itemId: 'x'.repeat(100) })).toBeNull();
  });
});

describe('the catalog', () => {
  it('has unique ids, positive whole prices, and every price reachable within about a week of care', () => {
    const ids = CATALOG.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of CATALOG) {
      expect(Number.isInteger(item.price) && item.price > 0, item.id).toBe(true);
      // The cap is per day, so anything costs at most a few days of care (guide §14: nothing to grind).
      expect(item.price / TUNING.shinies.dailyCap, item.id).toBeLessThanOrEqual(3);
    }
  });
});

describe('the v2 to v3 migration (Part 1L.5)', () => {
  it('adds the daily shinies counter and the worn list, and gives an empty pet its starting shinies', () => {
    const save = createEmptySave('i', T0) as SaveFile;
    const pet = makePet({ id: 'old' });
    const v2Pet = JSON.parse(JSON.stringify(pet)) as Record<string, unknown>;
    delete (v2Pet['state'] as { daily: Record<string, unknown> }).daily['shinies'];
    (v2Pet['inventory'] as Record<string, unknown>) = { shinies: 0, items: [] };
    const out = migrateV2toV3({ ...save, schemaVersion: 2, pets: [v2Pet] }) as unknown as SaveFile;
    const migrated = out.pets[0] as unknown as typeof pet;
    expect(migrated.state.daily.shinies).toBe(0);
    expect(migrated.inventory).toEqual({ shinies: 10, items: [], equipped: [] });
    expect(validateSave({ ...out, schemaVersion: 3, activePetId: 'old' })).toBeNull();
  });

  it('keeps what a pet already has', () => {
    const v2Pet = JSON.parse(JSON.stringify(makePet())) as Record<string, unknown>;
    (v2Pet['inventory'] as Record<string, unknown>) = { shinies: 7, items: ['bow'] };
    const out = migrateV2toV3({ schemaVersion: 2, pets: [v2Pet] }) as { pets: Array<{ inventory: unknown }> };
    expect(out.pets[0]?.inventory).toEqual({ shinies: 7, items: ['bow'], equipped: [] });
  });
});

describe('time passing does not cost shinies', () => {
  it('a long absence neither earns care shinies nor loses any', () => {
    const { pet } = simulate(makePet({ id: 'away' }), T0 + 3 * HOUR);
    expect(pet.inventory.shinies).toBeGreaterThanOrEqual(TUNING.shinies.start);
  });
});
