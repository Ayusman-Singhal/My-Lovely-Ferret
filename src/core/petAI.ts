// PetAI: what the ferret chooses to do while the app is open (docs/PET_BEHAVIOR.md §3).
// Personality lives here: traits, needs, time of day, and the room weigh each behavior with
// integers, and one is picked at random by weight. Pure and seeded, so it is testable and
// replayable. It does not need to match across devices (guide §10.7), only the owner runs it.

import { idiv } from './fixed';
import { createRng, hashString } from './rng';
import { hourClass, localMinuteOfDay } from './time';
import { TUNING } from './tuning';
import type { HistoryEvent, PetRecord } from './types';

export type Behavior = 'idle' | 'wander' | 'sniff' | 'curious' | 'eat' | 'drink' | 'playful' | 'steal' | 'sleep';

/** Behaviors PetAI can choose by score. Sleep is decided by the sleep rules, not scored. */
export const SCORED_BEHAVIORS = ['idle', 'wander', 'sniff', 'curious', 'eat', 'drink', 'playful', 'steal'] as const;
export type ScoredBehavior = (typeof SCORED_BEHAVIORS)[number];

/** What the pet can see and use in the room right now. */
export interface AIWorld {
  foodInBowl: boolean;
  waterInBowl: boolean;
  /** A toy to investigate or play with. */
  hasToy: boolean;
  /** Something small to steal. */
  hasStealable: boolean;
  /** A prop is close to the pet, which makes sniffing more likely. */
  propNearby: boolean;
  /** The player's finger or cursor is in the room, which draws affectionate pets. */
  pointerInRoom: boolean;
}

export interface Decision {
  behavior: Behavior;
  /** How long the main action lasts. 0 for behaviors defined by movement (wander, steal). */
  durationMs: number;
  /** Three integers 0..999 the renderer maps to places in the room, so PetAI stays geometry-free. */
  spots: readonly [number, number, number];
}

export interface AIState {
  /** Decisions made so far. Part of the RNG seed, so a run can be replayed. */
  counter: number;
  /** Decisions since the last steal and the last zoomies (back-to-back cooldown). */
  sinceSteal: number;
  sincePlayful: number;
}

export const AI_COOLDOWN_TICKS = 2;

export function createAIState(): AIState {
  return { counter: 0, sinceSteal: AI_COOLDOWN_TICKS, sincePlayful: AI_COOLDOWN_TICKS };
}

/** Time class from the owner's fixed offset, never the device zone (guide §7.2). */
function classAt(pet: PetRecord, nowMs: number) {
  return hourClass(localMinuteOfDay(nowMs, pet.tzOffsetMin));
}

/**
 * Integer score of every behavior. A score of 0 or less means "not eligible". Exposed so
 * tests and the dev panel can read the reasoning. Table: docs/PET_BEHAVIOR.md §3.
 */
export function scoreBehaviors(
  pet: PetRecord,
  world: AIWorld,
  nowMs: number,
  ai: Pick<AIState, 'sinceSteal' | 'sincePlayful'> = createAIState(),
): Record<ScoredBehavior, number> {
  const { mischief, curiosity, affection } = pet.personality;
  const { hunger, hydration, energy, happiness } = pet.state;
  const cls = classAt(pet, nowMs);

  let idle = 30 + idiv(100 - mischief, 8); // calm pets settle more
  if (affection < 30) idle += 20;
  if (energy < 3000) idle += 20;
  if (cls === 'day') idle += 10;

  let wander = 25 + idiv(curiosity, 4);
  if (cls === 'night') wander -= 10;
  if (world.pointerInRoom && affection >= 60) wander += idiv(affection, 3); // follows the player (guide §7.4)

  let sniff = 15 + idiv(curiosity, 3) + idiv(100 - mischief, 10);
  if (world.propNearby) sniff += 10;

  let curious = 5 + idiv(curiosity, 2);
  if (world.hasToy) curious += 20;

  // Needs first: while urgently hungry or thirsty with a stocked bowl, a pet does not play or scheme.
  const urgent = (world.foodInBowl && hunger < 3000) || (world.waterInBowl && hydration < 3000);

  let eat = 0;
  if (world.foodInBowl && hunger < 6000) {
    eat = idiv(10000 - hunger, 100);
    if (hunger < 3000) eat += 50; // a stocked bowl is never ignored while urgently hungry
  }

  let drink = 0;
  if (world.waterInBowl && hydration < 6000) {
    drink = idiv(10000 - hydration, 100);
    if (hydration < 3000) drink += 50;
  }

  // Zoomies need some energy to burn, and a cooldown so they are not back to back.
  let playful = 0;
  if (!urgent && energy >= 2500 && ai.sincePlayful >= AI_COOLDOWN_TICKS) {
    playful = 5 + mischief;
    if (happiness >= 6000) playful += idiv(energy, 400);
    if (cls !== 'day') playful += 10; // the bursts before and after a sleep
  }

  // Mischief: only mischievous pets, a stealable item, off cooldown, and 12 hours since the last one.
  let steal = 0;
  const stealReady = pet.state.lastStoleAt === null || nowMs - pet.state.lastStoleAt >= TUNING.events.stealCooldownMs;
  if (!urgent && world.hasStealable && mischief >= 50 && stealReady && ai.sinceSteal >= AI_COOLDOWN_TICKS) {
    steal = idiv(mischief, 2);
  }

  return { idle, wander, sniff, curious, eat, drink, playful, steal };
}

const DURATION_MS: Record<Behavior, readonly [number, number]> = {
  idle: [4000, 8000],
  wander: [0, 0],
  sniff: [2000, 4000],
  curious: [3000, 6000],
  eat: [4000, 7000],
  drink: [3000, 6000],
  playful: [4000, 8000],
  steal: [0, 0],
  sleep: [0, 0],
};

function makeDecision(behavior: Behavior, rng: ReturnType<typeof createRng>): Decision {
  const [min, max] = DURATION_MS[behavior];
  const durationMs = max === 0 ? 0 : rng.range(min / 100, max / 100) * 100;
  return { behavior, durationMs, spots: [rng.int(1000), rng.int(1000), rng.int(1000)] };
}

/**
 * Choose the next behavior. A sleeping pet just sleeps: waking is decided by the simulation
 * (GAME_DESIGN §3.3), and PetAI is asked again when that changes. Returns the updated AIState.
 */
export function nextDecision(
  ai: AIState,
  pet: PetRecord,
  world: AIWorld,
  nowMs: number,
): { ai: AIState; decision: Decision } {
  const counter = ai.counter + 1;
  const rng = createRng(hashString(`${pet.pet.id}|ai|${counter}`));

  if (pet.state.sleepState === 'asleep') {
    return { ai: { ...ai, counter }, decision: makeDecision('sleep', rng) };
  }

  const scores = scoreBehaviors(pet, world, nowMs, ai);
  const eligible = SCORED_BEHAVIORS.filter((b) => scores[b] > 0);
  const chosen = rng.pickWeighted(
    eligible,
    eligible.map((b) => scores[b]),
  );
  return {
    ai: {
      counter,
      sinceSteal: chosen === 'steal' ? 0 : ai.sinceSteal + 1,
      sincePlayful: chosen === 'playful' ? 0 : ai.sincePlayful + 1,
    },
    decision: makeDecision(chosen, rng),
  };
}

/** Dev hook (docs/PET_BEHAVIOR.md §9): a decision for a chosen behavior, bypassing the scores. */
export function forceDecision(ai: AIState, pet: PetRecord, behavior: Behavior): { ai: AIState; decision: Decision } {
  const counter = ai.counter + 1;
  const rng = createRng(hashString(`${pet.pet.id}|force|${counter}`));
  return {
    ai: {
      counter,
      sinceSteal: behavior === 'steal' ? 0 : ai.sinceSteal + 1,
      sincePlayful: behavior === 'playful' ? 0 : ai.sincePlayful + 1,
    },
    decision: makeDecision(behavior, rng),
  };
}

export interface CompletionResult {
  pet: PetRecord;
  events: HistoryEvent[];
}

/**
 * A behavior just finished. Steal is the only one that leaves a mark: it is logged as a
 * memorable event and starts the 12 hour cooldown (docs/PET_BEHAVIOR.md §6).
 */
export function completeBehavior(pet: PetRecord, behavior: Behavior, nowMs: number): CompletionResult {
  if (behavior !== 'steal') return { pet, events: [] };
  const event: HistoryEvent = {
    id: `PET_STOLE_ITEM-${nowMs}`,
    t: nowMs,
    type: 'PET_STOLE_ITEM',
    actor: 'pet',
    payload: { itemId: 'sock' },
  };
  return {
    pet: {
      ...pet,
      state: { ...pet.state, lastStoleAt: nowMs },
      history: [...pet.history, event].slice(-TUNING.history.maxEvents),
    },
    events: [event],
  };
}
