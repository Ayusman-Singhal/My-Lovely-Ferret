import { describe, expect, it } from 'vitest';
import { HOUR, T0, makePet } from '../core/testkit';
import { simulate } from '../core/simulate';
import { devRequested, pretendAway, setNeed } from './devTools';

describe('setNeed', () => {
  it('sets a need from the 0 to 100 number, clamped, without touching the others', () => {
    const pet = makePet();
    const low = setNeed(pet, 'hunger', 12.5);
    expect(low.state.hunger).toBe(1250);
    expect(low.state.hydration).toBe(pet.state.hydration);
    expect(setNeed(pet, 'energy', 250).state.energy).toBe(10_000);
    expect(setNeed(pet, 'bond', -5).state.bond).toBe(0);
  });

  it('returns a new pet and leaves the old one alone', () => {
    const pet = makePet();
    const next = setNeed(pet, 'happiness', 1);
    expect(next).not.toBe(pet);
    expect(pet.state.happiness).not.toBe(100);
  });
});

describe('pretendAway', () => {
  it('moves the remembered times back so the catch-up simulation covers the gap', () => {
    const pet = makePet({ nowMs: T0 });
    const away = pretendAway(pet, 5 * HOUR);
    expect(away.timestamps.lastSimulationTime).toBe(T0 - 5 * HOUR);
    const caught = simulate(away, T0).pet;
    expect(caught.timestamps.lastSimulationTime).toBeGreaterThan(T0 - HOUR);
    expect(caught.state.hunger).toBeLessThan(pet.state.hunger);
  });

  it('shifts the optional times too and keeps nulls as null', () => {
    const pet = makePet();
    const withTimes = { ...pet, state: { ...pet.state, sleepStartedAt: T0, lastStoleAt: null } };
    const away = pretendAway(withTimes, HOUR);
    expect(away.state.sleepStartedAt).toBe(T0 - HOUR);
    expect(away.state.lastStoleAt).toBeNull();
  });
});

describe('devRequested', () => {
  it('is true only when the address asks for it', () => {
    expect(devRequested('?dev=1')).toBe(true);
    expect(devRequested('?pet=x&dev')).toBe(true);
    expect(devRequested('?pet=x')).toBe(false);
    expect(devRequested('')).toBe(false);
  });
});
