// Ask the browser not to evict our storage (guide §8). Best effort: it can still be evicted,
// so the browser build stays a preview and Export backup stays available.

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
