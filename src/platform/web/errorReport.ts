// Error reporting for the web build (guide §25.3): Crashlytics is native-only, so the preview keeps
// the last few errors in memory and offers "copy error details" to the tester. Nothing is sent
// anywhere. Pure parts (formatting, the ring buffer) are tested; the browser hook is small.

export interface ErrorEntry {
  /** Epoch ms when it happened. */
  at: number;
  message: string;
  stack?: string;
  /** Where it came from: an uncaught error, a rejected promise, or a render problem. */
  kind: 'error' | 'promise';
}

export interface ErrorEnv {
  version: string;
  userAgent: string;
  url: string;
  nowIso: string;
}

export interface ErrorLog {
  add(entry: ErrorEntry): void;
  list(): readonly ErrorEntry[];
  count(): number;
  clear(): void;
}

/** Keeps the newest `max` errors, so a loop of failures cannot grow memory. */
export function createErrorLog(max = 5): ErrorLog {
  let entries: ErrorEntry[] = [];
  let total = 0;
  return {
    add(entry) {
      total++;
      entries = [...entries, entry].slice(-max);
    },
    list: () => entries,
    count: () => total,
    clear() {
      entries = [];
      total = 0;
    },
  };
}

/** Errors that are noise, not bugs: browsers raise these when layout changes while observing. */
export function isIgnorable(message: string): boolean {
  return /ResizeObserver loop/.test(message);
}

export function describeReason(reason: unknown): { message: string; stack?: string } {
  if (reason instanceof Error) return { message: `${reason.name}: ${reason.message}`, ...(reason.stack ? { stack: reason.stack } : {}) };
  if (typeof reason === 'string') return { message: reason };
  try {
    return { message: JSON.stringify(reason) ?? String(reason) };
  } catch {
    return { message: String(reason) };
  }
}

/** The text a tester copies and pastes to the developer. No save contents, no pet id. */
export function formatErrorReport(entries: readonly ErrorEntry[], env: ErrorEnv): string {
  const lines = ['Ferret error details', `Version: ${env.version}`, `Page: ${env.url}`, `Browser: ${env.userAgent}`, `Copied: ${env.nowIso}`, ''];
  entries.forEach((e, i) => {
    lines.push(`#${i + 1} ${new Date(e.at).toISOString()} (${e.kind})`, e.message);
    if (e.stack) lines.push(e.stack.split('\n').slice(0, 8).join('\n'));
    lines.push('');
  });
  if (entries.length === 0) lines.push('(no errors recorded)');
  return lines.join('\n').trimEnd();
}

interface ErrorTarget {
  addEventListener(type: 'error', listener: (e: ErrorEvent) => void): void;
  addEventListener(type: 'unhandledrejection', listener: (e: PromiseRejectionEvent) => void): void;
  removeEventListener(type: 'error', listener: (e: ErrorEvent) => void): void;
  removeEventListener(type: 'unhandledrejection', listener: (e: PromiseRejectionEvent) => void): void;
}

/** Listen for uncaught errors and rejected promises. Returns a function that stops listening. */
export function installErrorHandler(target: ErrorTarget, log: ErrorLog, nowMs: () => number, onNew?: () => void): () => void {
  const record = (kind: ErrorEntry['kind'], reason: unknown): void => {
    const described = describeReason(reason);
    if (isIgnorable(described.message)) return;
    log.add({ at: nowMs(), kind, ...described });
    onNew?.();
  };
  const onError = (e: ErrorEvent): void => record('error', e.error ?? e.message);
  const onRejection = (e: PromiseRejectionEvent): void => record('promise', e.reason);
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}
