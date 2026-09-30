import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, canonicalJson, checksum, createEmptySave, parseBackup, type SaveFile } from '../core/save';
import { T0, makePet } from '../core/testkit';
import { ImportError, createSaveStore, type KeyValueBackend } from './saveStore';

/** In-memory backend that copies values like IndexedDB does, with hooks to inject failures. */
function memoryBackend() {
  const data = new Map<string, unknown>();
  const hooks = { failNextSet: false, dropNextSet: false };
  const backend: KeyValueBackend = {
    get: async (key) => (data.has(key) ? structuredClone(data.get(key)) : undefined),
    set: async (key, value) => {
      if (hooks.failNextSet) {
        hooks.failNextSet = false;
        throw new Error('disk full');
      }
      if (hooks.dropNextSet) {
        hooks.dropNextSet = false; // pretends to succeed but stores nothing
        return;
      }
      data.set(key, structuredClone(value));
    },
  };
  return { backend, data, hooks };
}

function makeStore(now = { ms: T0 }) {
  const mem = memoryBackend();
  let idCounter = 0;
  const store = createSaveStore(mem.backend, { randomId: () => `install-${++idCounter}`, nowMs: () => now.ms });
  return { ...mem, store, now };
}

function saveWithPet(installId: string, petId = 'pet-a', extra: Partial<SaveFile> = {}): SaveFile {
  const save = createEmptySave(installId, T0);
  save.pets = [makePet({ id: petId })];
  save.activePetId = petId;
  return { ...save, ...extra };
}

describe('installId', () => {
  it('is created once and then stable', async () => {
    const { store } = makeStore();
    const first = await store.getInstallId();
    expect(first).toBe('install-1');
    expect(await store.getInstallId()).toBe(first);
  });

  it('is generated again when missing', async () => {
    const { store, data } = makeStore();
    await store.getInstallId();
    data.delete('installId');
    expect(await store.getInstallId()).toBe('install-2');
  });
});

describe('load and save', () => {
  it('reports empty on first run', async () => {
    const { store } = makeStore();
    expect(await store.loadWithInfo()).toEqual({ file: null, status: 'empty', problems: [] });
    expect(await store.load()).toBeNull();
  });

  it('round-trips a save and stamps lastSaved', async () => {
    const { store, now } = makeStore();
    const installId = await store.getInstallId();
    const save = saveWithPet(installId);
    now.ms = T0 + 5000;
    await store.save(save);
    const result = await store.loadWithInfo();
    expect(result.status).toBe('ok');
    expect(result.file?.pets[0]?.timestamps.lastSaved).toBe(T0 + 5000);
    expect(result.file?.pets[0]?.pet).toEqual(save.pets[0]?.pet);
    expect(result.file?.installId).toBe(installId);
  });

  it('alternates slots and always loads the newest', async () => {
    const { store, data } = makeStore();
    const installId = await store.getInstallId();
    for (let i = 1; i <= 5; i++) {
      const s = saveWithPet(installId);
      (s.pets[0] as { state: { bond: number } }).state.bond = i * 100;
      await store.save(s);
      expect((await store.load())?.pets[0]?.state.bond).toBe(i * 100);
    }
    const a = data.get('save.a') as { seq: number };
    const b = data.get('save.b') as { seq: number };
    expect(new Set([a.seq, b.seq])).toEqual(new Set([4, 5]));
  });

  it('refuses to write an invalid save and leaves the good one alone', async () => {
    const { store } = makeStore();
    const installId = await store.getInstallId();
    await store.save(saveWithPet(installId));
    const bad = saveWithPet(installId);
    (bad.pets[0] as { state: { hunger: number } }).state.hunger = 99999;
    await expect(store.save(bad)).rejects.toThrow(/invalid save/);
    expect((await store.load())?.pets[0]?.state.hunger).toBe(7500);
  });
});

describe('atomic write and recovery', () => {
  it('a failed write leaves the previous save intact', async () => {
    const { store, hooks } = makeStore();
    const installId = await store.getInstallId();
    const first = saveWithPet(installId);
    (first.pets[0] as { state: { bond: number } }).state.bond = 111;
    await store.save(first);
    const second = saveWithPet(installId);
    (second.pets[0] as { state: { bond: number } }).state.bond = 222;
    hooks.failNextSet = true;
    await expect(store.save(second)).rejects.toThrow('disk full');
    expect((await store.load())?.pets[0]?.state.bond).toBe(111);
  });

  it('a write that silently stores nothing is caught by read-back verification', async () => {
    const { store, hooks } = makeStore();
    const installId = await store.getInstallId();
    hooks.dropNextSet = true;
    await expect(store.save(saveWithPet(installId))).rejects.toThrow(/verification failed/);
  });

  it('falls back to the older slot when the newest is corrupt, and says so', async () => {
    const { store, data } = makeStore();
    const installId = await store.getInstallId();
    for (const bond of [100, 200]) {
      const s = saveWithPet(installId);
      (s.pets[0] as { state: { bond: number } }).state.bond = bond;
      await store.save(s);
    }
    // seq 2 is in slot "b". Damage it: change the json but keep the old checksum.
    const b = data.get('save.b') as { seq: number; checksum: string; json: string };
    expect(b.seq).toBe(2);
    data.set('save.b', { ...b, json: b.json.replace('"bond":200', '"bond":999') });
    const result = await store.loadWithInfo();
    expect(result.status).toBe('recovered');
    expect(result.file?.pets[0]?.state.bond).toBe(100);
    expect(result.problems[0]).toMatch(/slot b: checksum mismatch/);
  });

  it('after a recovery, the next save goes to the damaged slot, not over the good one', async () => {
    const { store, data } = makeStore();
    const installId = await store.getInstallId();
    for (const bond of [100, 200]) {
      const s = saveWithPet(installId);
      (s.pets[0] as { state: { bond: number } }).state.bond = bond;
      await store.save(s);
    }
    data.set('save.b', { seq: 2, checksum: 'deadbeef', json: 'garbage' });
    const s = saveWithPet(installId);
    (s.pets[0] as { state: { bond: number } }).state.bond = 300;
    await store.save(s);
    expect((data.get('save.a') as { seq: number }).seq).toBe(1); // good slot untouched
    expect((data.get('save.b') as { seq: number }).seq).toBe(3);
    const result = await store.loadWithInfo();
    expect(result.status).toBe('ok');
    expect(result.file?.pets[0]?.state.bond).toBe(300);
  });

  it('reports corrupt when nothing is usable, and never invents a save', async () => {
    const { store, data } = makeStore();
    data.set('save.a', { seq: 1, checksum: 'x', json: '{' });
    data.set('save.b', 'nonsense');
    const result = await store.loadWithInfo();
    expect(result.status).toBe('corrupt');
    expect(result.file).toBeNull();
    expect(result.problems).toHaveLength(2);
  });

  it('a slot that parses but fails validation is treated as damaged', async () => {
    const { store, data } = makeStore();
    const installId = await store.getInstallId();
    const s = saveWithPet(installId);
    (s.pets[0] as { state: { energy: number } }).state.energy = -4;
    const json = canonicalJson(s);
    data.set('save.a', { seq: 1, checksum: checksum(json), json });
    const result = await store.loadWithInfo();
    expect(result.status).toBe('corrupt');
    expect(result.problems[0]).toMatch(/energy/);
  });

  it('a save from a newer app is never overwritten', async () => {
    const { store, data } = makeStore();
    const installId = await store.getInstallId();
    const json = JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION + 1, whatever: true });
    data.set('save.a', { seq: 7, checksum: checksum(json), json });
    const result = await store.loadWithInfo();
    expect(result.status).toBe('too_new');
    expect(result.file).toBeNull();
    await expect(store.save(saveWithPet(installId))).rejects.toThrow(/newer version/);
    expect((data.get('save.a') as { seq: number }).seq).toBe(7);
  });

  it('installId comes from its own key, so a restored slot never brings an old one back', async () => {
    const { store } = makeStore();
    const installId = await store.getInstallId();
    await store.save(saveWithPet('some-old-install-id'));
    expect((await store.load())?.installId).toBe(installId);
  });
});

describe('export and import', () => {
  it('exports a backup without installId and imports it into another install', async () => {
    const source = makeStore();
    const sourceId = await source.store.getInstallId();
    const pet = saveWithPet(sourceId, 'travelling-pet');
    (pet.pets[0] as { state: { bond: number } }).state.bond = 4242;
    await source.store.save(pet);

    const blob = await source.store.export();
    const text = await blob.text();
    expect(blob.type).toBe('application/json');
    expect(text).not.toContain(sourceId);
    expect(parseBackup(text).ok).toBe(true);

    const target = makeStore();
    const targetId = await target.store.getInstallId();
    expect(targetId).toBe(sourceId); // both fake installs start at install-1: ids are just labels here
    const imported = await target.store.import(new Blob([text]));
    const loaded = await target.store.load();
    expect(loaded?.pets[0]?.pet.id).toBe('travelling-pet');
    expect(loaded?.pets[0]?.state.bond).toBe(4242);
    expect(loaded?.installId).toBe(targetId);
    expect(imported.installId).toBe(targetId);
  });

  it('keeps the previous save as the other slot after an import', async () => {
    const { store, data } = makeStore();
    const installId = await store.getInstallId();
    await store.save(saveWithPet(installId, 'old-pet'));
    const donor = makeStore();
    await donor.store.save(saveWithPet(await donor.store.getInstallId(), 'new-pet'));
    await store.import(await donor.store.export());
    expect((await store.load())?.pets[0]?.pet.id).toBe('new-pet');
    const other = data.get('save.a') as { json: string };
    expect(other.json).toContain('old-pet'); // still there as the fallback
  });

  it('rejects a damaged or foreign file and changes nothing', async () => {
    const { store } = makeStore();
    const installId = await store.getInstallId();
    await store.save(saveWithPet(installId, 'keep-me'));
    const good = await (await store.export()).text();

    const cases: Array<[string, string]> = [
      ['not_json', 'hello'],
      ['wrong_format', '{"a":1}'],
      ['bad_checksum', good.replace('keep-me', 'changed!')],
    ];
    for (const [reason, text] of cases) {
      const error = await store.import(new Blob([text])).catch((e: unknown) => e);
      expect(error, reason).toBeInstanceOf(ImportError);
      expect((error as ImportError).reason).toBe(reason);
    }
    expect((await store.load())?.pets[0]?.pet.id).toBe('keep-me');
  });

  it('cannot export before anything is saved', async () => {
    const { store } = makeStore();
    await expect(store.export()).rejects.toThrow(/Nothing to export/);
  });

  it('names the export file by date', () => {
    const { store } = makeStore({ ms: Date.UTC(2026, 9, 1, 12) });
    expect(store.exportFileName()).toBe('ferret-backup-20261001.json');
  });
});
