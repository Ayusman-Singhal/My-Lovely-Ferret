import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { TRICKS, findTrick, newlyUnlocked, unlockedTricks } from './tricks';
import { T0, makePet } from './testkit';

describe('tricks and the bond', () => {
  it('are ordered by the bond they need, with each one reachable', () => {
    for (let i = 1; i < TRICKS.length; i++) expect((TRICKS[i] as { bond: number }).bond).toBeGreaterThan((TRICKS[i - 1] as { bond: number }).bond);
    expect(TRICKS.every((t) => t.bond > 1000 && t.bond <= 10000)).toBe(true); // a new pet starts at 1000, none opens at once
    expect(findTrick('bow')?.bond).toBe(2500);
    expect(findTrick('nope')).toBeUndefined();
  });

  it('unlock when the bond reaches the line, exactly', () => {
    expect(unlockedTricks(1000)).toEqual([]);
    expect(unlockedTricks(1499)).toEqual([]);
    expect(unlockedTricks(1500).map((t) => t.id)).toEqual(['sit_up']);
    expect(unlockedTricks(10000)).toHaveLength(TRICKS.length);
  });

  it('newlyUnlocked lists only the lines a change crosses', () => {
    expect(newlyUnlocked(1400, 1500).map((t) => t.id)).toEqual(['sit_up']);
    expect(newlyUnlocked(1500, 1600)).toEqual([]);
    expect(newlyUnlocked(1000, 4100).map((t) => t.id)).toEqual(['sit_up', 'bow', 'spin']);
    expect(newlyUnlocked(5000, 5000)).toEqual([]);
  });
});

describe('a command that carries the bond over a line', () => {
  const nearLine = () => makePet({ state: { bond: 1480, hunger: 2000, hydration: 5000 } });

  it('records a milestone event, once, and returns it to the caller', () => {
    const fed = applyCommand(nearLine(), { type: 'FeedPet', foodId: 'kibble' }, T0 + 1000);
    expect(fed.pet.state.bond).toBeGreaterThanOrEqual(1500);
    const milestones = fed.events.filter((e) => e.type === 'MILESTONE_REACHED');
    expect(milestones).toHaveLength(1);
    expect(milestones[0]?.payload).toEqual({ trick: 'sit_up', bond: 1500 });
    expect(fed.pet.history.filter((e) => e.type === 'MILESTONE_REACHED')).toHaveLength(1);
    // More care afterwards does not repeat it.
    const again = applyCommand(fed.pet, { type: 'PetTouch', session: true }, T0 + 2000);
    expect(again.events.filter((e) => e.type === 'MILESTONE_REACHED')).toHaveLength(0);
  });

  it('does nothing when the bond stays on one side of every line', () => {
    const far = makePet({ state: { bond: 1000, hunger: 2000 } });
    const fed = applyCommand(far, { type: 'FeedPet', foodId: 'kibble' }, T0 + 1000);
    expect(fed.events.filter((e) => e.type === 'MILESTONE_REACHED')).toHaveLength(0);
  });
});
