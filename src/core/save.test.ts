import { describe, expect, it } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  MIGRATIONS,
  backupFileName,
  buildBackup,
  canonicalJson,
  checksum,
  createEmptySave,
  migrate,
  parseBackup,
  toBody,
  validateSave,
  type Migration,
  type SaveFile,
} from './save';
import { T0, makePet } from './testkit';

function makeSave(petIds: string[] = ['pet-a']): SaveFile {
  const save = createEmptySave('install-1', T0);
  save.pets = petIds.map((id) => makePet({ id }));
  save.activePetId = petIds[0] ?? '';
  return save;
}

/** Deep copy so a test can break one field without touching the shared save. */
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('canonicalJson and checksum', () => {
  it('does not depend on key order', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it('keeps array order', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });

  it('gives 8 hex chars, and changes when the data changes', () => {
    const a = checksum(canonicalJson({ x: 1 }));
    expect(a).toMatch(/^[0-9a-f]{8}$/);
    expect(checksum(canonicalJson({ x: 2 }))).not.toBe(a);
  });
});

describe('validateSave', () => {
  it('accepts an empty save and a save with two pets', () => {
    expect(validateSave(createEmptySave('i', T0))).toBeNull();
    expect(validateSave(makeSave(['a', 'b']))).toBeNull();
  });

  it('rejects things that are not saves', () => {
    expect(validateSave(null)).toMatch(/expected an object/);
    expect(validateSave([])).toMatch(/expected an object/);
    expect(validateSave('x')).toMatch(/expected an object/);
    expect(validateSave({})).toMatch(/schemaVersion/);
  });

  it('rejects a wrong schema version', () => {
    expect(validateSave({ ...makeSave(), schemaVersion: 2 })).toMatch(/schemaVersion/);
    expect(validateSave({ ...makeSave(), schemaVersion: 4 })).toMatch(/schemaVersion/);
  });

  it('rejects out-of-range and non-integer needs', () => {
    for (const bad of [-1, 10001, 5.5, NaN, '5000', null]) {
      const s = clone(makeSave());
      (s.pets[0] as unknown as { state: Record<string, unknown> }).state['hunger'] = bad;
      expect(validateSave(s), `hunger=${String(bad)}`).toMatch(/hunger/);
    }
  });

  it('rejects bad enums, traits, and names', () => {
    const s = clone(makeSave());
    const pet = s.pets[0] as unknown as { pet: Record<string, unknown>; personality: Record<string, unknown>; state: Record<string, unknown> };
    pet.pet['coat'] = 'purple';
    expect(validateSave(s)).toMatch(/coat/);
    pet.pet['coat'] = 'sable';
    pet.personality['mischief'] = 101;
    expect(validateSave(s)).toMatch(/mischief/);
    pet.personality['mischief'] = 50;
    pet.state['sleepState'] = 'dead';
    expect(validateSave(s)).toMatch(/sleepState/);
    pet.state['sleepState'] = 'awake';
    pet.pet['name'] = ' padded ';
    expect(validateSave(s)).toMatch(/name/);
  });

  it('rejects more than 2 pets, duplicate ids, and a bad activePetId', () => {
    expect(validateSave(makeSave(['a', 'b', 'c']))).toMatch(/too many/);
    const dup = makeSave(['a', 'b']);
    (dup.pets[1] as { pet: { id: string } }).pet.id = 'a';
    expect(validateSave(dup)).toMatch(/duplicate/);
    const wrongActive = makeSave(['a']);
    wrongActive.activePetId = 'zzz';
    expect(validateSave(wrongActive)).toMatch(/activePetId/);
    const emptyButActive = createEmptySave('i', T0);
    emptyButActive.activePetId = 'a';
    expect(validateSave(emptyButActive)).toMatch(/activePetId/);
  });

  it('rejects history over 500 events and missing sections', () => {
    const s = clone(makeSave());
    const event = { id: 'e', t: 1, type: 'X', actor: 'pet', payload: {} };
    (s.pets[0] as { history: unknown[] }).history = Array.from({ length: 501 }, () => event);
    expect(validateSave(s)).toMatch(/history/);
    const missing = clone(makeSave()) as unknown as Record<string, unknown>;
    delete missing['settings'];
    expect(validateSave(missing)).toMatch(/settings/);
  });

  it('rejects bad settings', () => {
    const s = clone(makeSave());
    (s.settings as unknown as Record<string, unknown>)['textScale'] = 5;
    expect(validateSave(s)).toMatch(/textScale/);
  });
});

describe('migrate', () => {
  const v1 = { schemaVersion: 1, pets: [], marker: 'one' };
  const chain: Record<number, Migration> = {
    1: (s) => ({ ...s, addedInV2: true }),
    2: (s) => ({ ...s, addedInV3: 'yes' }),
  };

  it('is a no-op at the current version', () => {
    const save = makeSave();
    const result = migrate(save);
    expect(result).toEqual({ ok: true, save: JSON.parse(JSON.stringify(save)) });
  });

  it('runs the chain in order and stamps each version', () => {
    const result = migrate(v1, chain, 3);
    expect(result).toEqual({
      ok: true,
      save: { schemaVersion: 3, pets: [], marker: 'one', addedInV2: true, addedInV3: 'yes' },
    });
  });

  it('never mutates its input', () => {
    const input = { ...v1 };
    migrate(input, chain, 3);
    expect(input).toEqual(v1);
  });

  it('refuses a save from a newer app', () => {
    const result = migrate({ ...v1, schemaVersion: 9 }, chain, 3);
    expect(result).toMatchObject({ ok: false, reason: 'too_new' });
  });

  it('reports a missing step and a throwing step, leaving the input alone', () => {
    expect(migrate(v1, { 2: chain[2] as Migration }, 3)).toMatchObject({ ok: false, reason: 'failed' });
    const input = { ...v1 };
    const boom = migrate(input, { 1: () => { throw new Error('boom'); } }, 2);
    expect(boom).toMatchObject({ ok: false, reason: 'failed' });
    expect(input).toEqual(v1);
  });

  it('rejects junk', () => {
    expect(migrate(null)).toMatchObject({ ok: false, reason: 'invalid' });
    expect(migrate({})).toMatchObject({ ok: false, reason: 'invalid' });
    expect(migrate({ schemaVersion: 0 })).toMatchObject({ ok: false, reason: 'invalid' });
    expect(migrate({ schemaVersion: 1.5 })).toMatchObject({ ok: false, reason: 'invalid' });
  });
});

describe('backup files', () => {
  it('never contains installId, and round-trips exactly', () => {
    const save = makeSave(['a', 'b']);
    const text = buildBackup(save, T0);
    expect(text).not.toContain('install-1');
    expect(text).not.toContain('installId');
    const parsed = parseBackup(text);
    expect(parsed).toEqual({ ok: true, body: toBody(save) });
  });

  it('round-trips an empty save', () => {
    const save = createEmptySave('i', T0);
    expect(parseBackup(buildBackup(save, T0))).toEqual({ ok: true, body: toBody(save) });
  });

  it('detects an edited file by checksum', () => {
    const text = buildBackup(makeSave(), T0);
    const edited = text.replace('"hunger": 7500', '"hunger": 9999');
    expect(edited).not.toBe(text);
    expect(parseBackup(edited)).toMatchObject({ ok: false, reason: 'bad_checksum' });
  });

  it('rejects text that is not JSON, not a backup, or missing the checksum', () => {
    expect(parseBackup('hello')).toMatchObject({ ok: false, reason: 'not_json' });
    expect(parseBackup('{"a":1}')).toMatchObject({ ok: false, reason: 'wrong_format' });
    expect(parseBackup('[]')).toMatchObject({ ok: false, reason: 'wrong_format' });
    expect(parseBackup('{"format":"ferret-backup","schemaVersion":1,"save":{}}')).toMatchObject({
      ok: false,
      reason: 'bad_checksum',
    });
  });

  it('rejects a backup from a newer app without touching anything', () => {
    const file = JSON.parse(buildBackup(makeSave(), T0)) as Record<string, unknown>;
    file['schemaVersion'] = CURRENT_SCHEMA_VERSION + 1;
    expect(parseBackup(JSON.stringify(file))).toMatchObject({ ok: false, reason: 'too_new' });
  });

  it('rejects a file with a good checksum but an invalid structure', () => {
    const save = clone(makeSave());
    (save.pets[0] as { state: { hunger: number } }).state.hunger = -5;
    // Build a checksum-valid file around invalid data, like a hand-edited file with the sum recomputed.
    const body = toBody(save);
    const file = { format: 'ferret-backup', schemaVersion: 1, exportedAt: T0, checksum: checksum(canonicalJson(body)), save: body };
    expect(parseBackup(JSON.stringify(file))).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('names the file by UTC date', () => {
    expect(backupFileName(Date.UTC(2026, 9, 1, 23, 59, 59))).toBe('ferret-backup-20261001.json');
  });
});

describe('the v1 to v2 migration (Part 1L.4: the collection)', () => {
  /** A save as the first preview wrote it: no `collection`, gifts only in the history. */
  function v1Save(): Record<string, unknown> {
    const save = clone(makeSave(['old-a', 'old-b'])) as unknown as Record<string, unknown>;
    const pets = save['pets'] as Array<Record<string, unknown>>;
    for (const p of pets) {
      delete p['collection'];
      delete (p['state'] as { daily: Record<string, unknown> }).daily['shinies'];
      delete (p['inventory'] as Record<string, unknown>)['equipped'];
      (p['inventory'] as Record<string, unknown>)['shinies'] = 0;
    }
    const found = (id: string, t: number, item: string) => ({ id, t, type: 'PET_FOUND_ITEM', actor: 'pet', payload: { itemId: item } });
    (pets[0] as Record<string, unknown>)['history'] = [
      found('f1', T0 + 3, 'button'),
      { id: 'x', t: T0 + 4, type: 'PET_STOLE_ITEM', actor: 'pet', payload: { itemId: 'sock' } },
      found('f2', T0 + 1, 'feather'),
      found('f3', T0 + 9, 'button'),
    ];
    save['schemaVersion'] = 1;
    return save;
  }

  it('gives each pet an album built from the gifts in its history', () => {
    const result = migrate(v1Save(), MIGRATIONS, 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.save['schemaVersion']).toBe(2);
    const pets = result.save['pets'] as Array<{ collection: Record<string, { first: number; count: number }> }>;
    expect(pets[0]?.collection).toEqual({ button: { first: T0 + 3, count: 2 }, feather: { first: T0 + 1, count: 1 } });
    expect(pets[1]?.collection).toEqual({});
  });

  it('the whole chain brings a v1 save to a valid current save', () => {
    const result = migrate(v1Save());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.save['schemaVersion']).toBe(CURRENT_SCHEMA_VERSION);
    expect(validateSave(result.save)).toBeNull();
  });

  it('does not change the old save it was given', () => {
    const input = v1Save();
    const before = JSON.stringify(input);
    migrate(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('a v1 backup file imports and ends up as a valid v2 save', () => {
    const v1 = v1Save();
    const body = { ...v1 };
    delete body['installId'];
    delete body['schemaVersion'];
    const file = buildBackup(makeSave(), T0);
    const parsed = JSON.parse(file) as Record<string, unknown>;
    parsed['schemaVersion'] = 1;
    parsed['save'] = body;
    // The checksum covers the body: recompute it the way buildBackup does.
    parsed['checksum'] = checksum(canonicalJson(body));
    const result = parseBackup(JSON.stringify(parsed));
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });

  it('rejects a collection entry with a bad count', () => {
    const s = clone(makeSave());
    (s.pets[0] as unknown as { collection: Record<string, unknown> }).collection = { button: { first: T0, count: 0 } };
    expect(validateSave(s)).toMatch(/count/);
  });
});
