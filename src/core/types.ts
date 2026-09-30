// Core game types. The save file wraps these (docs/SAVE_SCHEMA.md). All times are integer
// epoch milliseconds (deviation D1), traits are integers 0..100 (D2), needs and bond are
// integers in hundredths, 0..10000 (guide §7.1).

export type Coat = 'sable' | 'albino' | 'cinnamon' | 'panda';
export type SleepState = 'awake' | 'asleep';
export type Mood = 'needy' | 'sleepy' | 'playful' | 'happy' | 'content';

export type FoodId = 'chicken' | 'egg' | 'salmon' | 'kibble';
export type ToyId = 'ball' | 'sock' | 'feather' | 'ring';
export type ActivityId = 'chase' | 'dig' | 'hide' | 'climb';

export interface Personality {
  mischief: number;
  curiosity: number;
  affection: number;
}

/** Counters for bond diminishing returns (docs/GAME_DESIGN.md §4.1). Reset when the local date changes. */
export interface DailyCounters {
  date: string;
  pet: number;
  feed: number;
  play: number;
}

export interface PetState {
  hunger: number;
  hydration: number;
  energy: number;
  happiness: number;
  bond: number;
  sleepState: SleepState;
  /** Behavior name (docs/PET_BEHAVIOR.md). Display and later summary only. */
  currentActivity: string;
  favoriteFood: FoodId;
  favoriteToy: ToyId;
  favoriteActivity: ActivityId;
  lastInteractionTime: number;
  /** Start of the current sleep, for PET_SLEPT_LONG. Null while awake. */
  sleepStartedAt: number | null;
  lastStoleAt: number | null;
  /** Owner-local "YYYY-MM-DD" of the last daily found item. */
  lastFoundDate: string | null;
  lastPlayRewardAt: number | null;
  /** Set by StartPlay, cleared by FinishPlay. FinishPlay only counts after a StartPlay. */
  playStartedAt: number | null;
  daily: DailyCounters;
}

export type EventActor = 'owner' | 'caretaker' | 'pet';

/** A memorable thing that happened (guide §7.7). Never a low-level stat change. */
export interface HistoryEvent {
  id: string;
  t: number;
  type: string;
  actor: EventActor;
  payload: Record<string, string | number>;
}

/** One pet as stored in the save (docs/SAVE_SCHEMA.md §2). Later-phase fields are present and unused. */
export interface PetRecord {
  pet: { id: string; name: string; species: 'ferret'; coat: Coat; born: number };
  personality: Personality;
  state: PetState;
  inventory: { shinies: number; items: string[] };
  home: { furniture: string[]; mess: number };
  ownership: {
    role: 'owner';
    ownerUid: string;
    epoch: number;
    deviceId: string;
    caretaker: null;
    status: 'active' | 'locked' | 'tombstone';
  };
  careDays: { count: number; dates: string[] };
  history: HistoryEvent[];
  sync: { outbox: unknown[]; lastAppliedSeq: Record<string, number>; lastPairRevision: string };
  timestamps: { lastSimulationTime: number; lastSaved: number };
  /** Owner's fixed UTC offset in minutes. Simulation never reads the device zone (guide §7.2). */
  tzOffsetMin: number;
}
