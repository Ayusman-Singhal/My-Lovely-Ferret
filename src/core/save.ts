// Save file shape, validation, migrations, checksum, and backup format (docs/SAVE_SCHEMA.md).
// Pure: no storage here. The IndexedDB slot store lives in src/platform.

import { NAME_MAX_CLUSTERS, validateName } from './name';
import { ACTIVITIES, COATS, FOODS, TOYS } from './pet';
import { hashString } from './rng';
import { localDate } from './time';
import { TUNING } from './tuning';
import type { PetRecord } from './types';

export const CURRENT_SCHEMA_VERSION = 2;
export const MAX_PETS = 2; // guide Open Decision 11

export interface Settings {
  language: 'en' | 'hi';
  soundVolume: number; // 0..100
  musicVolume: number; // 0..100
  reducedMotion: boolean;
  highContrast: boolean;
  textScale: number; // percent, 100 default
  lowPowerMode: boolean; // 30 fps render
}

/** Local-only tester counters (guide §25.3). Shown on "About my pet", sent only if the tester chooses. */
export interface TesterCounters {
  sessions: number;
  firstOpenDate: number;
  lastOpenDate: number;
  interactionCounts: Record<string, number>;
}

export interface SaveFile {
  schemaVersion: number;
  /** Random id of this install. Never written to backup files (guide §8, §13.6). */
  installId: string;
  pets: PetRecord[];
  activePetId: string;
  settings: Settings;
  tester: TesterCounters;
}

/** The part of a save that travels in a backup file: everything except installId and the version. */
export type SaveBody = Omit<SaveFile, 'schemaVersion' | 'installId'>;

export function defaultSettings(prefersReducedMotion = false): Settings {
  return {
    language: 'en',
    soundVolume: 70,
    musicVolume: 50,
    reducedMotion: prefersReducedMotion,
    highContrast: false,
    textScale: 100,
    lowPowerMode: false,
  };
}

export function createEmptySave(installId: string, nowMs: number, settings: Settings = defaultSettings()): SaveFile {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    installId,
    pets: [],
    activePetId: '',
    settings,
    tester: { sessions: 0, firstOpenDate: nowMs, lastOpenDate: nowMs, interactionCounts: {} },
  };
}

// ------------------------------------------------------- tester counters

/** Count one interaction (docs/SAVE_SCHEMA.md §2). Kept on the save, shown on "About my pet". */
export function bumpInteraction(save: SaveFile, key: string): SaveFile {
  const counts = save.tester.interactionCounts;
  return { ...save, tester: { ...save.tester, interactionCounts: { ...counts, [key]: (counts[key] ?? 0) + 1 } } };
}

/** A new session started at `nowMs`. */
export function recordSession(save: SaveFile, nowMs: number): SaveFile {
  return { ...save, tester: { ...save.tester, sessions: save.tester.sessions + 1, lastOpenDate: nowMs } };
}

// ---------------------------------------------------------------- checksum

/** JSON with object keys sorted, so the same data always gives the same text and checksum. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(v).sort()) sorted[k] = (v as Record<string, unknown>)[k];
      return sorted;
    }
    return v;
  });
}

/** FNV-1a 32-bit as 8 hex chars. Detects corruption, not tampering (deviation D3). */
export function checksum(text: string): string {
  return hashString(text).toString(16).padStart(8, '0');
}

// -------------------------------------------------------------- validation

class Invalid extends Error {}

const fail = (path: string, what: string): never => {
  throw new Invalid(`${path}: ${what}`);
};

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function obj(v: unknown, path: string): Record<string, unknown> {
  return isObj(v) ? v : fail(path, 'expected an object');
}
function arr(v: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(v)) return fail(path, 'expected an array');
  return v.length > max ? fail(path, `too many items (max ${max})`) : v;
}
function str(v: unknown, path: string, allowEmpty = false): string {
  if (typeof v !== 'string') return fail(path, 'expected a string');
  return !allowEmpty && v.length === 0 ? fail(path, 'must not be empty') : v;
}
function int(v: unknown, path: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v)) return fail(path, 'expected an integer');
  return v < min || v > max ? fail(path, `out of range ${min}..${max}`) : v;
}
function bool(v: unknown, path: string): boolean {
  return typeof v === 'boolean' ? v : fail(path, 'expected true or false');
}
function oneOf<T extends string>(v: unknown, path: string, allowed: readonly T[]): T {
  return allowed.includes(v as T) ? (v as T) : fail(path, `expected one of ${allowed.join(', ')}`);
}

const TIME_MAX = 8_640_000_000_000_000; // largest valid JS date, in ms
const need = (v: unknown, p: string) => int(v, p, 0, 10000);
const time = (v: unknown, p: string) => int(v, p, 0, TIME_MAX);
const timeOrNull = (v: unknown, p: string) => (v === null ? null : time(v, p));

function checkPet(raw: unknown, p: string): void {
  const r = obj(raw, p);
  const pet = obj(r['pet'], `${p}.pet`);
  str(pet['id'], `${p}.pet.id`);
  const name = str(pet['name'], `${p}.pet.name`);
  const nameCheck = validateName(name);
  if (!nameCheck.ok) fail(`${p}.pet.name`, `invalid name (${nameCheck.reason}, max ${NAME_MAX_CLUSTERS} characters)`);
  oneOf(pet['species'], `${p}.pet.species`, ['ferret']);
  oneOf(pet['coat'], `${p}.pet.coat`, COATS);
  time(pet['born'], `${p}.pet.born`);

  const per = obj(r['personality'], `${p}.personality`);
  for (const k of ['mischief', 'curiosity', 'affection']) int(per[k], `${p}.personality.${k}`, 0, 100);

  const s = obj(r['state'], `${p}.state`);
  for (const k of ['hunger', 'hydration', 'energy', 'happiness', 'bond']) need(s[k], `${p}.state.${k}`);
  oneOf(s['sleepState'], `${p}.state.sleepState`, ['awake', 'asleep']);
  str(s['currentActivity'], `${p}.state.currentActivity`);
  oneOf(s['favoriteFood'], `${p}.state.favoriteFood`, FOODS);
  oneOf(s['favoriteToy'], `${p}.state.favoriteToy`, TOYS);
  oneOf(s['favoriteActivity'], `${p}.state.favoriteActivity`, ACTIVITIES);
  time(s['lastInteractionTime'], `${p}.state.lastInteractionTime`);
  timeOrNull(s['sleepStartedAt'], `${p}.state.sleepStartedAt`);
  timeOrNull(s['lastStoleAt'], `${p}.state.lastStoleAt`);
  timeOrNull(s['lastPlayRewardAt'], `${p}.state.lastPlayRewardAt`);
  timeOrNull(s['playStartedAt'], `${p}.state.playStartedAt`);
  if (s['lastFoundDate'] !== null) str(s['lastFoundDate'], `${p}.state.lastFoundDate`);
  const daily = obj(s['daily'], `${p}.state.daily`);
  str(daily['date'], `${p}.state.daily.date`);
  for (const k of ['pet', 'feed', 'play']) int(daily[k], `${p}.state.daily.${k}`, 0, 1_000_000);

  const inv = obj(r['inventory'], `${p}.inventory`);
  int(inv['shinies'], `${p}.inventory.shinies`, 0, 1_000_000_000);
  arr(inv['items'], `${p}.inventory.items`, 10_000);
  const collection = obj(r['collection'], `${p}.collection`);
  for (const [id, entry] of Object.entries(collection)) {
    const e = obj(entry, `${p}.collection.${id}`);
    time(e['first'], `${p}.collection.${id}.first`);
    int(e['count'], `${p}.collection.${id}.count`, 1, 1_000_000);
  }
  const home = obj(r['home'], `${p}.home`);
  arr(home['furniture'], `${p}.home.furniture`, 1000);
  int(home['mess'], `${p}.home.mess`, 0, 100);

  const own = obj(r['ownership'], `${p}.ownership`);
  oneOf(own['role'], `${p}.ownership.role`, ['owner']);
  str(own['ownerUid'], `${p}.ownership.ownerUid`, true);
  int(own['epoch'], `${p}.ownership.epoch`, 1, 1_000_000);
  str(own['deviceId'], `${p}.ownership.deviceId`, true);
  oneOf(own['status'], `${p}.ownership.status`, ['active', 'locked', 'tombstone']);

  const care = obj(r['careDays'], `${p}.careDays`);
  int(care['count'], `${p}.careDays.count`, 0, 1_000_000);
  arr(care['dates'], `${p}.careDays.dates`, 100_000);

  const history = arr(r['history'], `${p}.history`, TUNING.history.maxEvents);
  history.forEach((raw, i) => {
    const e = obj(raw, `${p}.history[${i}]`);
    str(e['id'], `${p}.history[${i}].id`);
    time(e['t'], `${p}.history[${i}].t`);
    str(e['type'], `${p}.history[${i}].type`);
    oneOf(e['actor'], `${p}.history[${i}].actor`, ['owner', 'caretaker', 'pet']);
    obj(e['payload'], `${p}.history[${i}].payload`);
  });

  const sync = obj(r['sync'], `${p}.sync`);
  arr(sync['outbox'], `${p}.sync.outbox`, 100_000);
  obj(sync['lastAppliedSeq'], `${p}.sync.lastAppliedSeq`);
  str(sync['lastPairRevision'], `${p}.sync.lastPairRevision`, true);

  const ts = obj(r['timestamps'], `${p}.timestamps`);
  time(ts['lastSimulationTime'], `${p}.timestamps.lastSimulationTime`);
  time(ts['lastSaved'], `${p}.timestamps.lastSaved`);
  int(r['tzOffsetMin'], `${p}.tzOffsetMin`, -720, 840);
}

function checkSettings(raw: unknown, p: string): void {
  const s = obj(raw, p);
  oneOf(s['language'], `${p}.language`, ['en', 'hi']);
  int(s['soundVolume'], `${p}.soundVolume`, 0, 100);
  int(s['musicVolume'], `${p}.musicVolume`, 0, 100);
  bool(s['reducedMotion'], `${p}.reducedMotion`);
  bool(s['highContrast'], `${p}.highContrast`);
  int(s['textScale'], `${p}.textScale`, 50, 300);
  bool(s['lowPowerMode'], `${p}.lowPowerMode`);
}

function checkBody(body: Record<string, unknown>, p: string): void {
  const pets = arr(body['pets'], `${p}.pets`, MAX_PETS);
  pets.forEach((pet, i) => checkPet(pet, `${p}.pets[${i}]`));
  const active = str(body['activePetId'], `${p}.activePetId`, true);
  const ids = pets.map((pet) => ((pet as PetRecord).pet.id));
  if (new Set(ids).size !== ids.length) fail(`${p}.pets`, 'duplicate pet ids');
  if (pets.length === 0 ? active !== '' : !ids.includes(active)) fail(`${p}.activePetId`, 'does not match a pet');
  checkSettings(body['settings'], `${p}.settings`);
  const t = obj(body['tester'], `${p}.tester`);
  int(t['sessions'], `${p}.tester.sessions`, 0, 100_000_000);
  time(t['firstOpenDate'], `${p}.tester.firstOpenDate`);
  time(t['lastOpenDate'], `${p}.tester.lastOpenDate`);
  const counts = obj(t['interactionCounts'], `${p}.tester.interactionCounts`);
  for (const [k, v] of Object.entries(counts)) int(v, `${p}.tester.interactionCounts.${k}`, 0, 100_000_000);
}

/** Structural validation of a save at the current schema version. Returns an error message, or null when valid. */
export function validateSave(value: unknown): string | null {
  try {
    const save = obj(value, 'save');
    if (save['schemaVersion'] !== CURRENT_SCHEMA_VERSION) fail('save.schemaVersion', `expected ${CURRENT_SCHEMA_VERSION}`);
    str(save['installId'], 'save.installId');
    checkBody(save, 'save');
    return null;
  } catch (e) {
    if (e instanceof Invalid) return e.message;
    throw e;
  }
}

// -------------------------------------------------------------- migrations

/** migrations[n] turns a version-n save into a version-(n+1) save. */
export type Migration = (save: Record<string, unknown>) => Record<string, unknown>;

/**
 * v1 to v2 (Part 1L.4): each pet gets a `collection`, the gifts it has brought. A v1 pet's earlier
 * gifts are in its history, so the album starts with them (the history keeps the last 500 events, so
 * a very old gift may be missing; nothing is invented).
 */
export const migrateV1toV2: Migration = (save) => {
  const pets = Array.isArray(save['pets']) ? (save['pets'] as Array<Record<string, unknown>>) : [];
  return {
    ...save,
    pets: pets.map((pet) => {
      const collection: Record<string, { first: number; count: number }> = {};
      const history = Array.isArray(pet['history']) ? (pet['history'] as Array<Record<string, unknown>>) : [];
      for (const e of history) {
        const payload = isObj(e['payload']) ? e['payload'] : {};
        const id = payload['itemId'];
        if (e['type'] !== 'PET_FOUND_ITEM' || typeof id !== 'string' || typeof e['t'] !== 'number') continue;
        const had = collection[id];
        collection[id] = { first: had ? Math.min(had.first, e['t']) : e['t'], count: (had?.count ?? 0) + 1 };
      }
      return { ...pet, collection };
    }),
  };
};

export const MIGRATIONS: Readonly<Record<number, Migration>> = { 1: migrateV1toV2 };

export type MigrateResult =
  | { ok: true; save: Record<string, unknown> }
  | { ok: false; reason: 'too_new' | 'failed' | 'invalid'; detail: string };

/**
 * Bring a parsed save up to `target`. A save from a newer app is refused, never guessed at.
 * A migration that throws is reported and the input is left untouched (guide §25.8).
 */
export function migrate(
  raw: unknown,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  target: number = CURRENT_SCHEMA_VERSION,
): MigrateResult {
  if (!isObj(raw) || typeof raw['schemaVersion'] !== 'number' || !Number.isInteger(raw['schemaVersion'])) {
    return { ok: false, reason: 'invalid', detail: 'missing or bad schemaVersion' };
  }
  let version = raw['schemaVersion'];
  if (version > target) return { ok: false, reason: 'too_new', detail: `save is version ${version}, app knows ${target}` };
  if (version < 1) return { ok: false, reason: 'invalid', detail: `unknown version ${version}` };
  let current = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
  while (version < target) {
    const step = migrations[version];
    if (!step) return { ok: false, reason: 'failed', detail: `no migration from version ${version}` };
    try {
      current = { ...step(current), schemaVersion: version + 1 };
    } catch (e) {
      return { ok: false, reason: 'failed', detail: `migration ${version} to ${version + 1}: ${String(e)}` };
    }
    version++;
  }
  return { ok: true, save: current };
}

// ------------------------------------------------------------ backup files

export interface BackupFile {
  format: 'ferret-backup';
  schemaVersion: number;
  exportedAt: number;
  checksum: string;
  save: SaveBody;
}

/** Everything except installId and schemaVersion. */
export function toBody(save: SaveFile): SaveBody {
  return { pets: save.pets, activePetId: save.activePetId, settings: save.settings, tester: save.tester };
}

/** Backup file text. Never contains installId (guide §8). */
export function buildBackup(save: SaveFile, exportedAtMs: number): string {
  const body = toBody(save);
  const file: BackupFile = {
    format: 'ferret-backup',
    schemaVersion: save.schemaVersion,
    exportedAt: exportedAtMs,
    checksum: checksum(canonicalJson(body)),
    save: body,
  };
  return JSON.stringify(file, null, 2);
}

export function backupFileName(exportedAtMs: number): string {
  return `ferret-backup-${localDate(exportedAtMs, 0).replaceAll('-', '')}.json`;
}

export type ParseBackupResult =
  | { ok: true; body: SaveBody }
  | { ok: false; reason: 'not_json' | 'wrong_format' | 'bad_checksum' | 'too_new' | 'migration_failed' | 'invalid'; detail: string };

/**
 * Validate a backup in the order of docs/SAVE_SCHEMA.md §5: JSON, format, checksum, version,
 * migrations, then structure. Any failure changes nothing.
 */
export function parseBackup(text: string): ParseBackupResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not_json', detail: 'not a JSON file' };
  }
  if (!isObj(raw) || raw['format'] !== 'ferret-backup') {
    return { ok: false, reason: 'wrong_format', detail: 'not a Ferret backup file' };
  }
  if (typeof raw['checksum'] !== 'string' || raw['checksum'] !== checksum(canonicalJson(raw['save']))) {
    return { ok: false, reason: 'bad_checksum', detail: 'the file is damaged or was edited' };
  }
  if (!isObj(raw['save'])) return { ok: false, reason: 'invalid', detail: 'save: expected an object' };

  // Give the body a placeholder installId so it can travel through the same migrate and validate path.
  const asSave = { ...raw['save'], schemaVersion: raw['schemaVersion'], installId: 'imported' };
  const migrated = migrate(asSave);
  if (!migrated.ok) {
    return { ok: false, reason: migrated.reason === 'too_new' ? 'too_new' : migrated.reason === 'failed' ? 'migration_failed' : 'invalid', detail: migrated.detail };
  }
  const problem = validateSave(migrated.save);
  if (problem) return { ok: false, reason: 'invalid', detail: problem };
  const { pets, activePetId, settings, tester } = migrated.save;
  return { ok: true, body: { pets, activePetId, settings, tester } as SaveBody };
}
