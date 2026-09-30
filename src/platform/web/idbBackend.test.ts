import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createEmptySave } from '../../core/save';
import { T0, makePet } from '../../core/testkit';
import { createSaveStore } from '../saveStore';
import { createIdbBackend } from './idbBackend';

describe('createIdbBackend (fake-indexeddb)', () => {
  it('stores and reads back values, and returns undefined for missing keys', async () => {
    const backend = createIdbBackend('t1', new IDBFactory());
    expect(await backend.get('nope')).toBeUndefined();
    await backend.set('k', { a: 1, b: [1, 2, 3] });
    expect(await backend.get('k')).toEqual({ a: 1, b: [1, 2, 3] });
    await backend.set('k', 'replaced');
    expect(await backend.get('k')).toBe('replaced');
  });

  it('keeps data when the database is opened again (a new backend, the same factory)', async () => {
    const factory = new IDBFactory();
    await createIdbBackend('t2', factory).set('k', 42);
    expect(await createIdbBackend('t2', factory).get('k')).toBe(42);
  });

  it('separate database names do not share data', async () => {
    const factory = new IDBFactory();
    await createIdbBackend('one', factory).set('k', 1);
    expect(await createIdbBackend('two', factory).get('k')).toBeUndefined();
  });

  it('runs the full save store on top of it, including a reopen', async () => {
    const factory = new IDBFactory();
    let id = 0;
    const deps = { randomId: () => `install-${++id}`, nowMs: () => T0 };
    const first = createSaveStore(createIdbBackend('t3', factory), deps);
    const save = createEmptySave(await first.getInstallId(), T0);
    save.pets = [makePet({ id: 'idb-pet' })];
    save.activePetId = 'idb-pet';
    await first.save(save);
    await first.save(save);

    // A new store on a new connection sees the same data, as after a page reload.
    const second = createSaveStore(createIdbBackend('t3', factory), deps);
    const result = await second.loadWithInfo();
    expect(result.status).toBe('ok');
    expect(result.file?.pets[0]?.pet.id).toBe('idb-pet');
    expect(await second.getInstallId()).toBe('install-1');
  });
});
