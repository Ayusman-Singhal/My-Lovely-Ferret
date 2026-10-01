// Save storage with two slots (docs/SAVE_SCHEMA.md §3, guide §8). Storage-agnostic: the
// browser passes an IndexedDB backend, tests pass memory. All game logic stays in src/core.
//
// Atomic write: each save goes to the slot that is NOT the newest valid one, so the last good
// copy is never touched. It is read back and verified before save() returns.

import {
  CURRENT_SCHEMA_VERSION,
  backupFileName,
  buildBackup,
  canonicalJson,
  checksum,
  createEmptySave,
  defaultSettings,
  migrate,
  parseBackup,
  validateSave,
  type ParseBackupResult,
  type SaveFile,
} from '../core/save';

/** The tiny storage surface the store needs. Values are structured-cloneable. */
export interface KeyValueBackend {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export type LoadStatus =
  | 'empty' // nothing stored yet: first run
  | 'ok'
  | 'recovered' // one slot was damaged, the other one was used
  | 'corrupt' // slots exist but none is usable: offer "Import backup", overwrite nothing
  | 'too_new'; // a slot was written by a newer app: read-only, never overwrite

export interface LoadResult {
  file: SaveFile | null;
  status: LoadStatus;
  /** Why each unusable slot was rejected. For the debug panel. */
  problems: string[];
}

export class ImportError extends Error {
  readonly reason: Extract<ParseBackupResult, { ok: false }>['reason'];
  constructor(reason: ImportError['reason'], detail: string) {
    super(detail);
    this.name = 'ImportError';
    this.reason = reason;
  }
}

export interface SaveStore {
  load(): Promise<SaveFile | null>;
  loadWithInfo(): Promise<LoadResult>;
  /** Validates, writes to the older slot, and verifies. Throws rather than write a bad save. */
  save(file: SaveFile): Promise<void>;
  /** Backup file of the current save (never contains installId). */
  export(): Promise<Blob>;
  exportFileName(): string;
  /** Validates checksum and schema, then replaces the save. Keeps this install's installId. */
  import(blob: Blob): Promise<SaveFile>;
  getInstallId(): Promise<string>;
  /**
   * Dev panel only (guide §25.7): damage the newest slot, or both, so a reload exercises the
   * fallback and the recovery screen. Never called by normal play.
   */
  debugCorrupt(which: 'newest' | 'both'): Promise<void>;
}

export interface SaveStoreDeps {
  /** New random id, for example crypto.randomUUID. */
  randomId(): string;
  nowMs(): number;
  prefersReducedMotion?: boolean;
}

interface SlotRecord {
  seq: number;
  checksum: string;
  json: string;
}

type SlotKey = 'a' | 'b';
const SLOT_KEYS: readonly SlotKey[] = ['a', 'b'];
const slotStorageKey = (k: SlotKey) => `save.${k}`;
const otherSlot = (k: SlotKey): SlotKey => (k === 'a' ? 'b' : 'a');

type SlotRead =
  | { kind: 'missing' }
  | { kind: 'bad'; why: string; seq: number }
  | { kind: 'too_new'; seq: number }
  | { kind: 'ok'; seq: number; file: SaveFile };

function isSlotRecord(v: unknown): v is SlotRecord {
  if (v === null || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return typeof r['seq'] === 'number' && typeof r['checksum'] === 'string' && typeof r['json'] === 'string';
}

function readSlotRecord(raw: unknown): SlotRead {
  if (raw === undefined || raw === null) return { kind: 'missing' };
  if (!isSlotRecord(raw)) return { kind: 'bad', why: 'not a slot record', seq: 0 };
  const seq = raw.seq;
  if (checksum(raw.json) !== raw.checksum) return { kind: 'bad', why: 'checksum mismatch', seq };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.json);
  } catch {
    return { kind: 'bad', why: 'not JSON', seq };
  }
  const migrated = migrate(parsed);
  if (!migrated.ok) {
    return migrated.reason === 'too_new' ? { kind: 'too_new', seq } : { kind: 'bad', why: migrated.detail, seq };
  }
  const problem = validateSave(migrated.save);
  if (problem) return { kind: 'bad', why: problem, seq };
  return { kind: 'ok', seq, file: migrated.save as unknown as SaveFile };
}

export function createSaveStore(backend: KeyValueBackend, deps: SaveStoreDeps): SaveStore {
  const getInstallId = async (): Promise<string> => {
    const existing = await backend.get('installId');
    if (typeof existing === 'string' && existing.length > 0) return existing;
    const fresh = deps.randomId();
    await backend.set('installId', fresh);
    return fresh;
  };

  const readSlots = async (): Promise<Record<SlotKey, SlotRead>> => {
    const [a, b] = await Promise.all(SLOT_KEYS.map(async (k) => readSlotRecord(await backend.get(slotStorageKey(k)))));
    return { a: a as SlotRead, b: b as SlotRead };
  };

  const bestOf = (slots: Record<SlotKey, SlotRead>): { key: SlotKey; seq: number; file: SaveFile } | null => {
    let best: { key: SlotKey; seq: number; file: SaveFile } | null = null;
    for (const key of SLOT_KEYS) {
      const s = slots[key];
      if (s.kind === 'ok' && (best === null || s.seq > best.seq)) best = { key, seq: s.seq, file: s.file };
    }
    return best;
  };

  const loadWithInfo = async (): Promise<LoadResult> => {
    const installId = await getInstallId();
    const slots = await readSlots();
    const problems: string[] = [];
    for (const key of SLOT_KEYS) {
      const s = slots[key];
      if (s.kind === 'bad') problems.push(`slot ${key}: ${s.why}`);
      if (s.kind === 'too_new') problems.push(`slot ${key}: written by a newer version`);
    }
    if (SLOT_KEYS.some((k) => slots[k].kind === 'too_new')) return { file: null, status: 'too_new', problems };
    const best = bestOf(slots);
    if (best) {
      // installId is authoritative in its own key, so a restored slot never brings an old one back.
      return { file: { ...best.file, installId }, status: problems.length > 0 ? 'recovered' : 'ok', problems };
    }
    const anyPresent = SLOT_KEYS.some((k) => slots[k].kind !== 'missing');
    return { file: null, status: anyPresent ? 'corrupt' : 'empty', problems };
  };

  const debugCorrupt = async (which: 'newest' | 'both'): Promise<void> => {
    const slots = await readSlots();
    const best = bestOf(slots);
    const targets: SlotKey[] = which === 'both' || !best ? [...SLOT_KEYS] : [best.key];
    for (const key of targets) {
      const record: SlotRecord = { seq: 1_000_000, checksum: 'damaged-on-purpose', json: '{"damaged":' };
      await backend.set(slotStorageKey(key), record);
    }
  };

  const save = async (file: SaveFile): Promise<void> => {
    const slots = await readSlots();
    if (SLOT_KEYS.some((k) => slots[k].kind === 'too_new')) {
      throw new Error('The stored save is from a newer version of the app, refusing to overwrite it');
    }
    const now = deps.nowMs();
    const stamped: SaveFile = {
      ...file,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      pets: file.pets.map((p) => ({ ...p, timestamps: { ...p.timestamps, lastSaved: now } })),
    };
    const problem = validateSave(stamped);
    if (problem) throw new Error(`Refusing to write an invalid save: ${problem}`);

    const best = bestOf(slots);
    // Never overwrite the best valid slot. With no valid slot, reuse slot "a" and a higher seq.
    const target: SlotKey = best ? otherSlot(best.key) : 'a';
    const highestSeq = Math.max(0, ...SLOT_KEYS.map((k) => (slots[k].kind === 'missing' ? 0 : slots[k].seq)));
    const json = canonicalJson(stamped);
    const record: SlotRecord = { seq: highestSeq + 1, checksum: checksum(json), json };

    await backend.set(slotStorageKey(target), record);

    const back = await backend.get(slotStorageKey(target));
    if (!isSlotRecord(back) || back.seq !== record.seq || back.checksum !== record.checksum || checksum(back.json) !== record.checksum) {
      throw new Error('Save verification failed: what was read back does not match what was written');
    }
  };

  const load = async (): Promise<SaveFile | null> => (await loadWithInfo()).file;

  return {
    load,
    loadWithInfo,
    save,
    getInstallId,
    debugCorrupt,
    exportFileName: () => backupFileName(deps.nowMs()),

    async export() {
      const file = await load();
      if (!file) throw new Error('Nothing to export yet');
      return new Blob([buildBackup(file, deps.nowMs())], { type: 'application/json' });
    },

    async import(blob) {
      const parsed = parseBackup(await blob.text());
      if (!parsed.ok) throw new ImportError(parsed.reason, parsed.detail);
      const installId = await getInstallId();
      const file: SaveFile = { schemaVersion: CURRENT_SCHEMA_VERSION, installId, ...parsed.body };
      await save(file);
      return file;
    },
  };
}

/** A first-run save for this install. The caller adds a pet and saves. */
export async function createFirstRunSave(store: SaveStore, deps: SaveStoreDeps): Promise<SaveFile> {
  return createEmptySave(await store.getInstallId(), deps.nowMs(), defaultSettings(deps.prefersReducedMotion ?? false));
}
