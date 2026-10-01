// The command layer (guide §18 rule 3, docs/GAME_DESIGN.md §4): the only way the player, and
// later a caretaker, changes the pet. The UI never edits pet state directly. A command is
// validated, the pet is simulated forward to "now" first (guide §10.6 step 5, never applied
// in the past), and then the effect is applied. Pure: same pet, command, and time give the
// same result.

import { findItem } from './catalog';
import { NEED_MAX, clamp } from './fixed';
import { newlyUnlocked } from './tricks';
import { FOODS, TOYS } from './pet';
import { simulate } from './simulate';
import { MINUTE_MS, localDate } from './time';
import { TUNING } from './tuning';
import type { FoodId, HistoryEvent, PetRecord, PetState, ToyId } from './types';

export type Command =
  | { type: 'FeedPet'; foodId: FoodId }
  | { type: 'GiveWater' }
  | { type: 'PetTouch'; session: boolean }
  | { type: 'StartPlay'; toyId: ToyId }
  | { type: 'FinishPlay'; band: number }
  | { type: 'PutToBed' }
  | { type: 'BuyItem'; itemId: string }
  | { type: 'EquipItem'; itemId: string }
  | { type: 'UnequipItem'; itemId: string };

export type Reaction = 'happy' | 'annoyed' | 'surprise';
export type Refusal =
  | 'invalid'
  | 'not_hungry'
  | 'not_thirsty'
  | 'too_tired'
  | 'not_sleepy'
  | 'no_play_started'
  | 'unknown_item'
  | 'already_owned'
  | 'not_enough_shinies'
  | 'not_owned';

export type Outcome =
  | {
      ok: true;
      /** The pet was asleep and this command woke it. */
      woke: boolean;
      reaction: Reaction | null;
      /** A bowl was filled, so the room should show it and the pet may go and eat or drink. */
      stock: 'food' | 'water' | null;
      /** Bond gained by this command, after diminishing returns. */
      bondGain: number;
      /** FinishPlay only: the reward was given (not inside the 30 minute cooldown). */
      rewarded: boolean;
      /** Shinies earned by this command, after the daily cap. */
      shinyGain: number;
    }
  | { ok: false; reason: Refusal; reaction: 'annoyed' };

export interface CommandResult {
  pet: PetRecord;
  /** Memorable events from the catch-up simulation and from this command, oldest first. */
  events: HistoryEvent[];
  outcome: Outcome;
}

/** Bond by how many times that kind of care already counted today (docs/GAME_DESIGN.md §4.1). */
export const BOND_TABLE = {
  pet: [100, 50, 0],
  feed: [50, 25, 0],
  play: [150, 75, 0],
} as const;

export const PLAY_REWARD_COOLDOWN_MS = 30 * MINUTE_MS;
/** A StartPlay older than this is forgotten: the mini-game lasts about 20 seconds. */
export const PLAY_SESSION_MAX_MS = 10 * MINUTE_MS;
export const MIN_PLAY_ENERGY = 2000;
export const REFUSE_ABOVE = 9000;

/** Accept only well-formed commands. Anything else is dropped, never trusted (guide §10.6). */
export function parseCommand(raw: unknown): Command | null {
  if (raw === null || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  switch (c['type']) {
    case 'FeedPet':
      return FOODS.includes(c['foodId'] as FoodId) ? { type: 'FeedPet', foodId: c['foodId'] as FoodId } : null;
    case 'GiveWater':
      return { type: 'GiveWater' };
    case 'PetTouch':
      return typeof c['session'] === 'boolean' ? { type: 'PetTouch', session: c['session'] } : null;
    case 'StartPlay':
      return TOYS.includes(c['toyId'] as ToyId) ? { type: 'StartPlay', toyId: c['toyId'] as ToyId } : null;
    case 'FinishPlay':
      return typeof c['band'] === 'number' && Number.isFinite(c['band'])
        ? { type: 'FinishPlay', band: clamp(Math.trunc(c['band']), 0, 3) }
        : null;
    case 'PutToBed':
      return { type: 'PutToBed' };
    case 'BuyItem':
    case 'EquipItem':
    case 'UnequipItem':
      return typeof c['itemId'] === 'string' && c['itemId'].length > 0 && c['itemId'].length <= 40
        ? { type: c['type'], itemId: c['itemId'] }
        : null;
    default:
      return null;
  }
}

const refuse = (pet: PetRecord, events: HistoryEvent[], reason: Refusal): CommandResult => ({
  pet,
  events,
  outcome: { ok: false, reason, reaction: 'annoyed' },
});

/** Reset the daily counters when the owner-local date has changed. */
function withToday(state: PetState, today: string): PetState {
  return state.daily.date === today ? state : { ...state, daily: { date: today, pet: 0, feed: 0, play: 0, shinies: 0 } };
}

function wake(state: PetState): PetState {
  return { ...state, sleepState: 'awake', sleepStartedAt: null, currentActivity: 'idle' };
}

/**
 * Apply one command at `nowMs`. The pet is simulated forward first, so needs and sleep are
 * current when the effect lands. Refusals change nothing except the catch-up simulation.
 */
export function applyCommand(record: PetRecord, raw: unknown, nowMs: number): CommandResult {
  const sim = simulate(record, nowMs);
  const events: HistoryEvent[] = [...sim.events];
  const cmd = parseCommand(raw);
  if (!cmd) return refuse(sim.pet, events, 'invalid');

  const today = localDate(nowMs, record.tzOffsetMin);
  let state = withToday(sim.pet.state, today);
  const wasAsleep = state.sleepState === 'asleep';
  let inventory = sim.pet.inventory;
  let shinyGain = 0;
  /** Shinies for care, up to the daily cap (guide §14: nothing to grind). */
  const earn = (amount: number): void => {
    const room = Math.max(0, TUNING.shinies.dailyCap - state.daily.shinies);
    const given = Math.min(amount, room);
    if (given <= 0) return;
    state = { ...state, daily: { ...state.daily, shinies: state.daily.shinies + given } };
    inventory = { ...inventory, shinies: inventory.shinies + given };
    shinyGain += given;
  };
  const done = (extra: Partial<Extract<Outcome, { ok: true }>> = {}, commandEvents: HistoryEvent[] = []): CommandResult => {
    // A bond that grew past a line opens a trick: a memorable moment (Part 1L.7).
    const milestones: HistoryEvent[] = newlyUnlocked(sim.pet.state.bond, state.bond).map((trick) => ({
      id: `MILESTONE_REACHED-${trick.id}`,
      t: nowMs,
      type: 'MILESTONE_REACHED',
      actor: 'pet',
      payload: { trick: trick.id, bond: trick.bond },
    }));
    const extraEvents = [...commandEvents, ...milestones];
    return {
      pet: {
        ...sim.pet,
        state: { ...state, lastInteractionTime: nowMs },
        inventory,
        history: [...sim.pet.history, ...extraEvents].slice(-TUNING.history.maxEvents),
      },
      events: [...events, ...extraEvents],
      outcome: { ok: true, woke: false, reaction: null, stock: null, bondGain: 0, rewarded: false, shinyGain, ...extra },
    };
  };
  /** Wear or place an item: a second item in the same slot takes the first off. */
  const equip = (id: string): void => {
    const slot = findItem(id)?.slot;
    inventory = { ...inventory, equipped: [...inventory.equipped.filter((other) => findItem(other)?.slot !== slot && other !== id), id] };
  };
  const bond = (kind: keyof typeof BOND_TABLE): number => {
    const table = BOND_TABLE[kind];
    const gain = table[Math.min(state.daily[kind], table.length - 1)] as number;
    const bondNow = clamp(state.bond + gain, 0, NEED_MAX);
    state = { ...state, bond: bondNow, daily: { ...state.daily, [kind]: state.daily[kind] + 1 } };
    return gain;
  };

  switch (cmd.type) {
    case 'FeedPet': {
      if (state.hunger >= REFUSE_ABOVE) return refuse(sim.pet, events, 'not_hungry');
      const favorite = cmd.foodId === state.favoriteFood;
      const firstToday = state.daily.feed === 0;
      if (wasAsleep) state = wake(state);
      state = {
        ...state,
        hunger: Math.min(NEED_MAX, state.hunger + (favorite ? 3500 : 2500)),
        happiness: favorite ? Math.min(NEED_MAX, state.happiness + 500) : state.happiness,
      };
      const gain = bond('feed');
      earn(TUNING.shinies.feed);
      const fed: HistoryEvent[] =
        firstToday || favorite
          ? [{ id: `PET_FED-${nowMs}`, t: nowMs, type: 'PET_FED', actor: 'owner', payload: { foodId: cmd.foodId } }]
          : [];
      return done({ woke: wasAsleep, reaction: favorite ? 'happy' : null, stock: 'food', bondGain: gain }, fed);
    }

    case 'GiveWater': {
      if (state.hydration >= REFUSE_ABOVE) return refuse(sim.pet, events, 'not_thirsty');
      if (wasAsleep) state = wake(state);
      state = { ...state, hydration: Math.min(NEED_MAX, state.hydration + 3500) };
      earn(TUNING.shinies.water);
      return done({ woke: wasAsleep, stock: 'water' });
    }

    case 'PetTouch': {
      let reaction: Reaction = 'happy';
      if (wasAsleep) {
        const grumpy = state.energy < 5000;
        state = wake(state);
        if (grumpy) state = { ...state, happiness: Math.max(TUNING.floor, state.happiness - 300) };
        reaction = grumpy ? 'annoyed' : 'surprise';
      }
      let gain = 0;
      if (cmd.session) {
        state = { ...state, happiness: Math.min(NEED_MAX, state.happiness + 300) };
        gain = bond('pet');
        earn(TUNING.shinies.petSession);
      }
      return done({ woke: wasAsleep, reaction, bondGain: gain });
    }

    case 'StartPlay': {
      if (state.energy < MIN_PLAY_ENERGY) return refuse(sim.pet, events, 'too_tired');
      if (wasAsleep) state = wake(state);
      state = { ...state, playStartedAt: nowMs };
      return done({ woke: wasAsleep });
    }

    case 'FinishPlay': {
      const started = state.playStartedAt;
      if (started === null || nowMs - started > PLAY_SESSION_MAX_MS) {
        state = { ...state, playStartedAt: null };
        return refuse({ ...sim.pet, state }, events, 'no_play_started');
      }
      const band = clamp(cmd.band, 0, 3);
      const rewarded = state.lastPlayRewardAt === null || nowMs - state.lastPlayRewardAt >= PLAY_REWARD_COOLDOWN_MS;
      state = { ...state, playStartedAt: null, energy: Math.max(0, state.energy - 1500) };
      let gain = 0;
      let played: HistoryEvent[] = [];
      if (rewarded) {
        state = { ...state, happiness: Math.min(NEED_MAX, state.happiness + 500 + band * 400), lastPlayRewardAt: nowMs };
        if (band >= 1) {
          gain = bond('play');
          earn(TUNING.shinies.play[band] as number);
          played = [{ id: `PET_PLAYED-${nowMs}`, t: nowMs, type: 'PET_PLAYED', actor: 'owner', payload: { band } }];
        }
      }
      return done({ reaction: band >= 2 ? 'happy' : null, bondGain: gain, rewarded }, played);
    }

    case 'PutToBed': {
      if (wasAsleep) return done();
      if (state.energy >= REFUSE_ABOVE) return refuse(sim.pet, events, 'not_sleepy');
      state = { ...state, sleepState: 'asleep', sleepStartedAt: nowMs, currentActivity: 'sleep' };
      return done();
    }

    case 'BuyItem': {
      const item = findItem(cmd.itemId);
      if (!item) return refuse(sim.pet, events, 'unknown_item');
      if (inventory.items.includes(item.id)) return refuse(sim.pet, events, 'already_owned');
      if (inventory.shinies < item.price) return refuse(sim.pet, events, 'not_enough_shinies');
      inventory = { ...inventory, shinies: inventory.shinies - item.price, items: [...inventory.items, item.id] };
      equip(item.id); // a new thing is put on at once: the player wants to see it
      return done({ reaction: 'happy' });
    }

    case 'EquipItem': {
      if (!findItem(cmd.itemId)) return refuse(sim.pet, events, 'unknown_item');
      if (!inventory.items.includes(cmd.itemId)) return refuse(sim.pet, events, 'not_owned');
      equip(cmd.itemId);
      return done({ reaction: 'happy' });
    }

    case 'UnequipItem': {
      if (!inventory.equipped.includes(cmd.itemId)) return refuse(sim.pet, events, 'not_owned');
      inventory = { ...inventory, equipped: inventory.equipped.filter((id) => id !== cmd.itemId) };
      return done();
    }
  }
}
