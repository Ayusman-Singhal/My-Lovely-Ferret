import { describe, expect, it } from 'vitest';
import { createPet } from './pet';
import { T0 } from './testkit';

const params = { id: 'a0b1c2d3-0000-4000-8000-000000000001', name: 'Mochi', nowMs: T0, tzOffsetMin: 330, deviceId: 'dev-1' };

describe('createPet', () => {
  it('is deterministic: the same id gives the same pet', () => {
    expect(createPet(params)).toEqual(createPet(params));
  });

  it('differs for different ids', () => {
    const a = createPet(params);
    const b = createPet({ ...params, id: 'a0b1c2d3-0000-4000-8000-000000000002' });
    expect(JSON.stringify(a.personality) + a.pet.coat + a.state.favoriteToy).not.toBe(
      JSON.stringify(b.personality) + b.pet.coat + b.state.favoriteToy,
    );
  });

  // Regression pin. If this fails, the draw order or the RNG changed and EVERY existing pet
  // would change (docs/PET_BEHAVIOR.md §4). Do not update the numbers to make it pass.
  it('draws traits in the fixed order (pinned)', () => {
    const p = createPet(params);
    expect({
      personality: p.personality,
      coat: p.pet.coat,
      food: p.state.favoriteFood,
      toy: p.state.favoriteToy,
      activity: p.state.favoriteActivity,
    }).toMatchInlineSnapshot(`
      {
        "activity": "hide",
        "coat": "panda",
        "food": "egg",
        "personality": {
          "affection": 62,
          "curiosity": 10,
          "mischief": 77,
        },
        "toy": "ball",
      }
    `);
  });

  it('keeps traits in range and starts with the documented values', () => {
    for (let i = 0; i < 500; i++) {
      const p = createPet({ ...params, id: `id-${i}` });
      for (const value of Object.values(p.personality)) {
        expect(value).toBeGreaterThanOrEqual(5);
        expect(value).toBeLessThanOrEqual(95);
        expect(Number.isInteger(value)).toBe(true);
      }
      expect(p.state).toMatchObject({
        hunger: 7500,
        hydration: 8000,
        energy: 8000,
        happiness: 7000,
        bond: 1000,
        sleepState: 'awake',
      });
    }
  });

  it('follows the coat weights (40, 25, 20, 15) over many ids', () => {
    const counts: Record<string, number> = {};
    const n = 8000;
    for (let i = 0; i < n; i++) {
      const coat = createPet({ ...params, id: `coat-${i}` }).pet.coat;
      counts[coat] = (counts[coat] ?? 0) + 1;
    }
    const share = (coat: string) => ((counts[coat] ?? 0) / n) * 100;
    expect(share('sable')).toBeGreaterThan(37);
    expect(share('sable')).toBeLessThan(43);
    expect(share('cinnamon')).toBeGreaterThan(22);
    expect(share('cinnamon')).toBeLessThan(28);
    expect(share('panda')).toBeGreaterThan(17);
    expect(share('panda')).toBeLessThan(23);
    expect(share('albino')).toBeGreaterThan(12);
    expect(share('albino')).toBeLessThan(18);
  });

  it('starts with an adoption event, no found item on day one, and the owner offset', () => {
    const p = createPet(params);
    expect(p.history).toHaveLength(1);
    expect(p.history[0]).toMatchObject({ type: 'PET_ADOPTED', actor: 'owner', payload: { name: 'Mochi' } });
    // 09:00 UTC with +330 offset is 14:30 on 2026-10-01 locally.
    expect(p.state.lastFoundDate).toBe('2026-10-01');
    expect(p.state.daily.date).toBe('2026-10-01');
    expect(p.tzOffsetMin).toBe(330);
    expect(p.timestamps.lastSimulationTime).toBe(T0);
    expect(p.ownership).toMatchObject({ role: 'owner', epoch: 1, status: 'active', deviceId: 'dev-1' });
  });

  it('rejects an invalid name', () => {
    expect(() => createPet({ ...params, name: '' })).toThrow(/empty/);
    expect(() => createPet({ ...params, name: ' x' })).toThrow(/edge_space/);
    expect(() => createPet({ ...params, name: 'x'.repeat(17) })).toThrow(/too_long/);
  });
});
