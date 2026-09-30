// Autosave (guide §8): save on meaningful change, debounced, and when the page becomes hidden.
// Never every frame. Writes are serialized, so two saves never overlap, and a failed save stays
// "dirty" so the next chance retries it. Timers are injected, so this is tested without a browser.

export interface AutosaveDeps {
  setTimer(callback: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
}

export interface Autosave {
  /** Something worth saving changed. Schedules a save soon. */
  markDirty(): void;
  /** Save now if anything is unsaved, and wait for it (for example when the page is hidden). */
  flush(): Promise<void>;
  isDirty(): boolean;
  lastError(): unknown;
}

export function createAutosave(save: () => Promise<void>, deps: AutosaveDeps, debounceMs = 2000): Autosave {
  let dirty = false;
  let timer: unknown = null;
  let running: Promise<void> | null = null;
  let error: unknown = null;

  const run = (): Promise<void> => {
    // Wait for a write in flight, then write again if more changes arrived meanwhile.
    const previous = running ?? Promise.resolve();
    const next = previous
      .then(async () => {
        if (!dirty) return;
        dirty = false; // changes made during the write set it again
        try {
          await save();
          error = null;
        } catch (e) {
          dirty = true;
          error = e;
        }
      })
      .finally(() => {
        if (running === next) running = null;
      });
    running = next;
    return next;
  };

  return {
    markDirty() {
      dirty = true;
      if (timer !== null) return;
      timer = deps.setTimer(() => {
        timer = null;
        void run();
      }, debounceMs);
    },

    flush() {
      if (timer !== null) {
        deps.clearTimer(timer);
        timer = null;
      }
      return run();
    },

    isDirty: () => dirty,
    lastError: () => error,
  };
}
