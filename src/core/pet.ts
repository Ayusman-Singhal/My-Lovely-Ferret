import { createRng, hashString } from './rng';
import { validateName } from './name';
import { localDate } from './time';
import { TUNING } from './tuning';
import type { ActivityId, Coat, FoodId, PetRecord, ToyId } from './types';

// Weights out of 100 (docs/GAME_DESIGN.md §10).
export const COATS: readonly Coat[] = ['sable', 'cinnamon', 'panda', 'albino'];
const COAT_WEIGHTS = [40, 25, 20, 15] as const;
export const FOODS: readonly FoodId[] = ['chicken', 'egg', 'salmon', 'kibble'];
export const TOYS: readonly ToyId[] = ['ball', 'sock', 'feather', 'ring'];
export const ACTIVITIES: readonly ActivityId[] = ['chase', 'dig', 'hide', 'climb'];

export interface CreatePetParams {
  /** Random UUID made by the platform layer (crypto.randomUUID), never by core. */
  id: string;
  name: string;
  nowMs: number;
  tzOffsetMin: number;
  /** installId of this device. Becomes ownership.deviceId. */
  deviceId: string;
}

/**
 * New pet. Traits, coat, and favorites come from the pet id, drawn in a FIXED order
 * (docs/PET_BEHAVIOR.md §4). Never reorder these draws: it would change every existing pet.
 * Adding a draw at the end is safe.
 */
export function createPet(params: CreatePetParams): PetRecord {
  const check = validateName(params.name);
  if (!check.ok) throw new Error(`Invalid pet name: ${check.reason}`);

  const rng = createRng(hashString(params.id));
  const mischief = rng.range(5, 95);
  const curiosity = rng.range(5, 95);
  const affection = rng.range(5, 95);
  const coat = rng.pickWeighted(COATS, COAT_WEIGHTS);
  const favoriteFood = rng.pick(FOODS);
  const favoriteToy = rng.pick(TOYS);
  const favoriteActivity = rng.pick(ACTIVITIES);

  const today = localDate(params.nowMs, params.tzOffsetMin);

  return {
    pet: { id: params.id, name: params.name, species: 'ferret', coat, born: params.nowMs },
    personality: { mischief, curiosity, affection },
    state: {
      hunger: 7500,
      hydration: 8000,
      energy: 8000,
      happiness: 7000,
      bond: 1000,
      sleepState: 'awake',
      currentActivity: 'idle',
      favoriteFood,
      favoriteToy,
      favoriteActivity,
      lastInteractionTime: params.nowMs,
      sleepStartedAt: null,
      lastStoleAt: null,
      // The first gift can come on the next local date, not on day one.
      lastFoundDate: today,
      lastPlayRewardAt: null,
      playStartedAt: null,
      daily: { date: today, pet: 0, feed: 0, play: 0, shinies: 0 },
    },
    // A few shinies to start, so the first look at the shop is not empty.
    inventory: { shinies: TUNING.shinies.start, items: [], equipped: [] },
    collection: {},
    home: { furniture: [], mess: 0 },
    ownership: {
      role: 'owner',
      ownerUid: '',
      epoch: 1,
      deviceId: params.deviceId,
      caretaker: null,
      status: 'active',
    },
    careDays: { count: 0, dates: [] },
    history: [
      {
        id: `PET_ADOPTED-${params.nowMs}`,
        t: params.nowMs,
        type: 'PET_ADOPTED',
        actor: 'owner',
        payload: { name: params.name },
      },
    ],
    sync: { outbox: [], lastAppliedSeq: {}, lastPairRevision: '' },
    timestamps: { lastSimulationTime: params.nowMs, lastSaved: params.nowMs },
    tzOffsetMin: params.tzOffsetMin,
  };
}
