import { describe, expect, it } from 'vitest';
import { deriveMood } from './mood';

const calm = { hunger: 6000, hydration: 6000, energy: 6000, happiness: 6000 };

describe('deriveMood', () => {
  it('needy when hunger or hydration is below 3000', () => {
    expect(deriveMood({ ...calm, hunger: 2999 }, { mischief: 10 })).toBe('needy');
    expect(deriveMood({ ...calm, hydration: 2999 }, { mischief: 10 })).toBe('needy');
    expect(deriveMood({ ...calm, hunger: 3000 }, { mischief: 10 })).toBe('content');
  });

  it('sleepy when energy is below 3000', () => {
    expect(deriveMood({ ...calm, energy: 2999 }, { mischief: 10 })).toBe('sleepy');
    expect(deriveMood({ ...calm, energy: 3000 }, { mischief: 10 })).toBe('content');
  });

  it('playful needs high happiness, energy, and mischief', () => {
    const state = { ...calm, happiness: 7000, energy: 6000 };
    expect(deriveMood(state, { mischief: 60 })).toBe('playful');
    expect(deriveMood(state, { mischief: 59 })).toBe('content');
    expect(deriveMood({ ...state, energy: 5999 }, { mischief: 90 })).toBe('content');
    expect(deriveMood({ ...state, happiness: 6999 }, { mischief: 90 })).toBe('content');
  });

  it('happy at 7500 or more when not playful', () => {
    expect(deriveMood({ ...calm, happiness: 7500 }, { mischief: 10 })).toBe('happy');
    expect(deriveMood({ ...calm, happiness: 7499 }, { mischief: 10 })).toBe('content');
  });

  it('applies the rules in priority order', () => {
    const rich = { hunger: 2000, hydration: 9000, energy: 2000, happiness: 9000 };
    expect(deriveMood(rich, { mischief: 90 })).toBe('needy'); // needy beats sleepy
    expect(deriveMood({ ...rich, hunger: 9000 }, { mischief: 90 })).toBe('sleepy'); // sleepy beats playful
    expect(deriveMood({ hunger: 9000, hydration: 9000, energy: 9000, happiness: 9000 }, { mischief: 90 })).toBe('playful');
    expect(deriveMood({ hunger: 9000, hydration: 9000, energy: 9000, happiness: 9000 }, { mischief: 10 })).toBe('happy');
  });
});
