// In-memory key-value backend. Values are copied like IndexedDB copies them. For tests and for
// an environment without IndexedDB. Never used to hold a player's real save.

import type { KeyValueBackend } from './saveStore';

export function createMemoryBackend(): KeyValueBackend & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async (key) => (data.has(key) ? structuredClone(data.get(key)) : undefined),
    set: async (key, value) => {
      data.set(key, structuredClone(value));
    },
  };
}
