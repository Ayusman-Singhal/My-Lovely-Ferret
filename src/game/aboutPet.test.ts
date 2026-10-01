import { describe, expect, it } from 'vitest';
import { DAY, T0, makePet } from '../core/testkit';
import { buildAboutPet, levelOf } from './aboutPet';

const tester = (counts: Record<string, number> = {}) => ({ sessions: 4, firstOpenDate: T0, lastOpenDate: T0 + DAY, interactionCounts: counts });

describe('levelOf', () => {
  it('uses the same cut-offs as the introduction', () => {
    expect(levelOf(66)).toBe('high');
    expect(levelOf(65)).toBe('mid');
    expect(levelOf(34)).toBe('mid');
    expect(levelOf(33)).toBe('low');
  });
});

describe('buildAboutPet', () => {
  it('counts days from 1 and shows bond as the 0 to 100 number', () => {
    const pet = makePet({ state: { bond: 1050 } });
    expect(buildAboutPet(pet, tester(), T0).dayNumber).toBe(1);
    expect(buildAboutPet(pet, tester(), T0 + 3 * DAY).dayNumber).toBe(4);
    expect(buildAboutPet(pet, tester(), T0).bond).toBe(10);
  });

  it('never shows a day before 1, even if the clock is behind the birth time', () => {
    expect(buildAboutPet(makePet(), tester(), T0 - 5 * DAY).dayNumber).toBe(1);
  });

  it('lists the five interactions in a fixed order with zeros, then any other counters', () => {
    const about = buildAboutPet(makePet(), tester({ pet: 2, feed: 3, zzz: 1 }), T0);
    expect(about.counts.map((c) => c.key)).toEqual(['feed', 'water', 'play', 'sleep', 'pet', 'zzz']);
    expect(about.counts.map((c) => c.count)).toEqual([3, 0, 0, 0, 2, 1]);
  });

  it('passes the session counters through', () => {
    const about = buildAboutPet(makePet(), tester(), T0);
    expect(about.sessions).toBe(4);
    expect(about.lastOpen).toBe(T0 + DAY);
  });
});
