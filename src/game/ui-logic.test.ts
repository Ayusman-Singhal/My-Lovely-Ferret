import { describe, expect, it } from 'vitest';
import { bumpInteraction, createEmptySave, recordSession } from '../core/save';
import { simulate } from '../core/simulate';
import { DAY, HOUR, MINUTE, T0, makePet } from '../core/testkit';
import type { HistoryEvent } from '../core/types';
import { createMemoryBackend } from '../platform/memoryBackend';
import { createSaveStore } from '../platform/saveStore';
import { HINT_ORDER, interactionOf, nextHint } from './hints';
import { announcements, hudMeters, levelOf } from './needs';
import { createAutosave } from './persistence';
import { adoptPet, bootSession } from './session';
import { AWAY_SUMMARY_MS, MAX_EVENT_LINES, buildWelcomeBack } from './summary';

const event = (type: string, t: number, itemId: string): HistoryEvent => ({ id: `${type}-${t}`, t, type, actor: 'pet', payload: { itemId } });

describe('buildWelcomeBack', () => {
  const pet = makePet({ id: 'w', state: { hunger: 6000, hydration: 6000, energy: 6000, happiness: 6000 } });

  it('is null for a short absence', () => {
    expect(buildWelcomeBack({ pet, events: [], asleepSteps: 6, awayMs: AWAY_SUMMARY_MS - 1 })).toBeNull();
    expect(buildWelcomeBack({ pet, events: [], asleepSteps: 6, awayMs: AWAY_SUMMARY_MS })).not.toBeNull();
  });

  it('says how long the pet slept, in whole hours, and uses the singular for one', () => {
    const many = buildWelcomeBack({ pet, events: [], asleepSteps: 44, awayMs: 10 * HOUR });
    expect(many?.lines[0]).toEqual({ key: 'welcome.slept', params: { name: 'Mochi', hours: 7 } });
    const one = buildWelcomeBack({ pet, events: [], asleepSteps: 8, awayMs: 3 * HOUR });
    expect(one?.lines[0]?.key).toBe('welcome.slept1');
    const none = buildWelcomeBack({ pet, events: [], asleepSteps: 2, awayMs: 3 * HOUR });
    expect(none?.lines.some((l) => l.key.startsWith('welcome.slept'))).toBe(false);
  });

  it('lists notable events newest first, at most three, and skips unremarkable ones', () => {
    const events = [
      event('PET_FOUND_ITEM', 1, 'button'),
      event('PET_SLEPT_LONG', 2, 'x'),
      event('PET_STOLE_ITEM', 3, 'sock'),
      event('PET_FOUND_ITEM', 4, 'feather'),
      event('PET_FOUND_ITEM', 5, 'hair_tie'),
    ];
    const s = buildWelcomeBack({ pet, events, asleepSteps: 0, awayMs: DAY });
    const eventLines = s?.lines.filter((l) => l.key === 'welcome.found' || l.key === 'welcome.stole') ?? [];
    expect(eventLines).toHaveLength(MAX_EVENT_LINES);
    expect(eventLines.map((l) => l.params['itemId'])).toEqual(['hair_tie', 'feather', 'sock']);
  });

  it('always ends with a warm mood line, and never mentions how long the player was gone', () => {
    const s = buildWelcomeBack({ pet, events: [], asleepSteps: 0, awayMs: 40 * DAY });
    expect(s?.lines.at(-1)?.key).toMatch(/^welcome\.mood\./);
    for (const line of s?.lines ?? []) {
      expect(JSON.stringify(line.params)).not.toMatch(/days?|hours away|away/);
    }
  });

  it('the mood line follows the pet: needy when starving, content when fine', () => {
    const starving = makePet({ id: 'hungry', state: { hunger: 1000, hydration: 1000 } });
    expect(buildWelcomeBack({ pet: starving, events: [], asleepSteps: 0, awayMs: DAY })?.mood).toBe('needy');
  });

  it('works on a real 3 day absence from the simulation', () => {
    const before = makePet({ id: 'real', personality: { mischief: 90, curiosity: 60, affection: 40 } });
    const sim = simulate(before, T0 + 3 * DAY);
    const s = buildWelcomeBack({ pet: sim.pet, events: sim.events, asleepSteps: sim.asleepSteps, awayMs: 3 * DAY });
    expect(s).not.toBeNull();
    expect(s?.lines[0]?.key).toBe('welcome.slept');
    expect(Number(s?.lines[0]?.params['hours'])).toBeGreaterThan(20);
  });
});

describe('hudMeters', () => {
  it('shows values 0 to 100 with a level word, and floors the hundredths', () => {
    const m = hudMeters({ hunger: 7599, hydration: 2999, energy: 3000, happiness: 10000 });
    expect(m.map((x) => [x.id, x.value, x.level])).toEqual([
      ['hunger', 75, 'good'],
      ['hydration', 29, 'low'],
      ['energy', 30, 'ok'],
      ['happiness', 100, 'good'],
    ]);
    for (const x of m) expect(x.labelKey).toMatch(/^hud\./);
  });

  it('levels change at 30 and 60', () => {
    expect([2999, 3000, 5999, 6000].map(levelOf)).toEqual(['low', 'ok', 'ok', 'good']);
  });
});

describe('announcements', () => {
  const base = makePet().state;
  it('announces only real transitions', () => {
    expect(announcements(null, base)).toEqual([]);
    expect(announcements(base, base)).toEqual([]);
    expect(announcements(base, { ...base, sleepState: 'asleep' })).toEqual(['live.asleep']);
    expect(announcements({ ...base, sleepState: 'asleep' }, base)).toEqual(['live.awake']);
    expect(announcements({ ...base, hunger: 3000 }, { ...base, hunger: 2999 })).toEqual(['live.hungry']);
    expect(announcements({ ...base, hunger: 2500 }, { ...base, hunger: 2000 })).toEqual([]); // already low: no chatter
    expect(announcements({ ...base, hydration: 3000 }, { ...base, hydration: 100 })).toEqual(['live.thirsty']);
  });
});

describe('hints', () => {
  it('offers the first interaction not done yet, in order, and none when all are done', () => {
    expect(nextHint({})).toBe('feed');
    expect(nextHint({ feed: 1 })).toBe('water');
    expect(nextHint({ feed: 2, water: 1, play: 1 })).toBe('sleep');
    expect(nextHint(Object.fromEntries(HINT_ORDER.map((i) => [i, 1])))).toBeNull();
    expect(nextHint({ water: 5 })).toBe('feed'); // the earliest missing one wins
  });

  it('maps commands to interactions', () => {
    expect(interactionOf({ type: 'FeedPet', foodId: 'egg' })).toBe('feed');
    expect(interactionOf({ type: 'GiveWater' })).toBe('water');
    expect(interactionOf({ type: 'StartPlay', toyId: 'ball' })).toBe('play');
    expect(interactionOf({ type: 'PutToBed' })).toBe('sleep');
    expect(interactionOf({ type: 'PetTouch', session: false })).toBe('pet');
    expect(interactionOf({ type: 'FinishPlay', band: 1 })).toBeNull();
  });

  it('tester counters accumulate without mutating the save', () => {
    const save = createEmptySave('i', T0);
    const a = bumpInteraction(bumpInteraction(save, 'feed'), 'feed');
    expect(a.tester.interactionCounts).toEqual({ feed: 2 });
    expect(save.tester.interactionCounts).toEqual({});
    const s = recordSession(recordSession(save, T0 + 5), T0 + 9);
    expect(s.tester.sessions).toBe(2);
    expect(s.tester.lastOpenDate).toBe(T0 + 9);
    expect(s.tester.firstOpenDate).toBe(T0);
  });
});

describe('createAutosave', () => {
  function harness(failures = 0) {
    const timers: Array<{ fn: () => void; ms: number; live: boolean }> = [];
    let saves = 0;
    let concurrent = 0;
    let maxConcurrent = 0;
    let toFail = failures;
    const save = async (): Promise<void> => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await Promise.resolve();
      concurrent--;
      if (toFail > 0) {
        toFail--;
        throw new Error('disk full');
      }
      saves++;
    };
    const autosave = createAutosave(save, {
      setTimer: (fn, ms) => {
        const t = { fn, ms, live: true };
        timers.push(t);
        return t;
      },
      clearTimer: (h) => {
        (h as { live: boolean }).live = false;
      },
    });
    const fire = async (): Promise<void> => {
      for (const t of timers.filter((x) => x.live)) {
        t.live = false;
        t.fn();
      }
      await autosave.flush();
    };
    return { autosave, timers, fire, saves: () => saves, maxConcurrent: () => maxConcurrent };
  }

  it('many changes make one debounced save', async () => {
    const h = harness();
    for (let i = 0; i < 20; i++) h.autosave.markDirty();
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0]?.ms).toBe(2000);
    expect(h.autosave.isDirty()).toBe(true);
    await h.fire();
    expect(h.saves()).toBe(1);
    expect(h.autosave.isDirty()).toBe(false);
  });

  it('flush saves at once (page hidden), and does nothing when clean', async () => {
    const h = harness();
    await h.autosave.flush();
    expect(h.saves()).toBe(0);
    h.autosave.markDirty();
    await h.autosave.flush();
    expect(h.saves()).toBe(1);
    expect(h.timers[0]?.live).toBe(false); // the pending timer was cancelled
  });

  it('never runs two saves at once, and saves again when a change arrives during a save', async () => {
    const h = harness();
    h.autosave.markDirty();
    const first = h.autosave.flush();
    await Promise.resolve(); // the first save is now running
    h.autosave.markDirty(); // a change arrives during it
    const second = h.autosave.flush();
    await Promise.all([first, second]);
    expect(h.maxConcurrent()).toBe(1);
    expect(h.saves()).toBe(2);

    // Two changes made before a save starts share one save.
    h.autosave.markDirty();
    h.autosave.markDirty();
    await h.autosave.flush();
    expect(h.saves()).toBe(3);
    expect(h.autosave.isDirty()).toBe(false);
  });

  it('a failed save stays dirty, reports the error, and is retried', async () => {
    const h = harness(1);
    h.autosave.markDirty();
    await h.autosave.flush();
    expect(h.saves()).toBe(0);
    expect(h.autosave.isDirty()).toBe(true);
    expect(String(h.autosave.lastError())).toContain('disk full');
    await h.autosave.flush();
    expect(h.saves()).toBe(1);
    expect(h.autosave.lastError()).toBeNull();
  });
});

describe('bootSession and adoptPet', () => {
  function env(nowMs = T0) {
    const backend = createMemoryBackend();
    let n = 0;
    const deps = { randomId: () => `id-${++n}`, nowMs: () => nowMs };
    return { backend, deps, store: createSaveStore(backend, deps) };
  }

  it('a fresh install is a first run with an empty save', async () => {
    const { store, deps } = env();
    const r = await bootSession(store, deps);
    expect(r.kind).toBe('first-run');
    if (r.kind === 'first-run') {
      expect(r.save.pets).toEqual([]);
      expect(r.save.installId).toBe('id-1');
    }
  });

  it('adopting validates the name and adds the pet as the active one', async () => {
    const { store, deps } = env();
    const first = await bootSession(store, deps);
    if (first.kind !== 'first-run') throw new Error('expected first run');
    expect(adoptPet(first.save, { id: 'p1', name: '', nowMs: T0, tzOffsetMin: 0 })).toEqual({ ok: false, reason: 'empty' });
    expect(adoptPet(first.save, { id: 'p1', name: 'x'.repeat(17), nowMs: T0, tzOffsetMin: 0 })).toEqual({ ok: false, reason: 'too_long' });
    const ok = adoptPet(first.save, { id: 'p1', name: 'Mochi', nowMs: T0, tzOffsetMin: 330 });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.save.activePetId).toBe('p1');
      expect(ok.save.pets).toHaveLength(1);
      expect(ok.pet.tzOffsetMin).toBe(330);
      expect(ok.pet.ownership.deviceId).toBe('id-1');
    }
  });

  it('a saved pet comes back after a reload, caught up on the time away, with a summary', async () => {
    const { store, backend, deps } = env(T0);
    const first = await bootSession(store, deps);
    if (first.kind !== 'first-run') throw new Error('expected first run');
    const adopted = adoptPet(first.save, { id: 'p1', name: 'Mochi', nowMs: T0, tzOffsetMin: 0 });
    if (!adopted.ok) throw new Error('adopt failed');
    await store.save(adopted.save);

    // The player comes back 9 hours later, in a "new page load" (new store over the same storage).
    const later = { randomId: () => 'unused', nowMs: () => T0 + 9 * HOUR };
    const r = await bootSession(createSaveStore(backend, later), later);
    expect(r.kind).toBe('ready');
    if (r.kind === 'ready') {
      expect(r.pet.timestamps.lastSimulationTime).toBeGreaterThan(T0 + 8 * HOUR);
      expect(r.pet.state.hunger).toBeLessThan(7500);
      expect(r.welcome).not.toBeNull();
      expect(r.save.tester.sessions).toBe(1);
      expect(r.save.activePetId).toBe('p1');
      expect(r.recovered).toBe(false);
    }
  });

  it('a quick reload shows no summary', async () => {
    const { store, backend, deps } = env(T0);
    const first = await bootSession(store, deps);
    if (first.kind !== 'first-run') throw new Error('expected first run');
    const adopted = adoptPet(first.save, { id: 'p1', name: 'Mochi', nowMs: T0, tzOffsetMin: 0 });
    if (!adopted.ok) throw new Error('adopt failed');
    await store.save(adopted.save);
    const soon = { randomId: () => 'unused', nowMs: () => T0 + 5 * MINUTE };
    const r = await bootSession(createSaveStore(backend, soon), soon);
    expect(r.kind === 'ready' && r.welcome).toBeNull();
  });

  it('reports corrupt and too-new saves without touching them', async () => {
    const { backend, deps } = env();
    backend.data.set('save.a', { seq: 1, checksum: 'nope', json: '{' });
    const corrupt = await bootSession(createSaveStore(backend, deps), deps);
    expect(corrupt.kind).toBe('corrupt');
    const newer = env();
    const json = JSON.stringify({ schemaVersion: 99 });
    // A checksum-valid slot from a newer app.
    const { checksum } = await import('../core/save');
    newer.backend.data.set('save.a', { seq: 3, checksum: checksum(json), json });
    expect((await bootSession(newer.store, newer.deps)).kind).toBe('too_new');
  });
});
