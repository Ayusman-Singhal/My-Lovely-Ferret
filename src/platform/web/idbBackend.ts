// IndexedDB key-value backend for the save store. Async, so it never blocks rendering.
// localStorage is not used for the save: it is synchronous and small (guide §8).

import type { KeyValueBackend } from '../saveStore';

const STORE = 'kv';

export function createIdbBackend(dbName = 'ferret', factory: IDBFactory = indexedDB): KeyValueBackend {
  let opening: Promise<IDBDatabase> | null = null;

  const open = (): Promise<IDBDatabase> => {
    opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(dbName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => {
        const db = request.result;
        // If another tab upgrades the database, close so it is not blocked, and reopen on next use.
        db.onversionchange = () => {
          db.close();
          opening = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
      request.onblocked = () => reject(new Error('IndexedDB open blocked by another tab'));
    }).catch((error: unknown) => {
      opening = null; // allow a retry
      throw error;
    });
    return opening;
  };

  return {
    async get(key) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
        request.onsuccess = () => resolve(request.result as unknown);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'));
      });
    },

    async set(key, value) {
      const db = await open();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        // Resolve on transaction complete, not on request success: the write is durable then.
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted'));
      });
    },
  };
}
