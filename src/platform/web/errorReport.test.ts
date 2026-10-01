import { describe, expect, it, vi } from 'vitest';
import { createErrorLog, describeReason, formatErrorReport, installErrorHandler, isIgnorable } from './errorReport';

const env = { version: 'abc1234', userAgent: 'TestBrowser/1', url: 'https://example.test/', nowIso: '2026-10-02T09:00:00.000Z' };

describe('createErrorLog', () => {
  it('keeps only the newest entries but counts them all', () => {
    const log = createErrorLog(3);
    for (let i = 1; i <= 5; i++) log.add({ at: i, kind: 'error', message: `m${i}` });
    expect(log.list().map((e) => e.message)).toEqual(['m3', 'm4', 'm5']);
    expect(log.count()).toBe(5);
    log.clear();
    expect(log.list()).toEqual([]);
    expect(log.count()).toBe(0);
  });
});

describe('describeReason', () => {
  it('reads errors, strings, objects, and things that cannot be turned into JSON', () => {
    expect(describeReason(new TypeError('boom')).message).toBe('TypeError: boom');
    expect(describeReason(new Error('x')).stack).toBeTruthy();
    expect(describeReason('plain')).toEqual({ message: 'plain' });
    expect(describeReason({ a: 1 }).message).toBe('{"a":1}');
    const loop: Record<string, unknown> = {};
    loop['self'] = loop;
    expect(describeReason(loop).message).toBe('[object Object]');
    expect(describeReason(undefined).message).toBe('undefined');
  });
});

describe('formatErrorReport', () => {
  it('lists the version, the browser, and each error with a short stack', () => {
    const stack = Array.from({ length: 12 }, (_, i) => `at line${i}`).join('\n');
    const text = formatErrorReport([{ at: Date.UTC(2026, 9, 2), kind: 'promise', message: 'Error: nope', stack }], env);
    expect(text).toContain('Version: abc1234');
    expect(text).toContain('Browser: TestBrowser/1');
    expect(text).toContain('#1 2026-10-02T00:00:00.000Z (promise)');
    expect(text).toContain('at line7');
    expect(text).not.toContain('at line8');
  });

  it('says so when nothing was recorded', () => {
    expect(formatErrorReport([], env)).toContain('(no errors recorded)');
  });
});

describe('installErrorHandler', () => {
  function fakeTarget() {
    const listeners = new Map<string, (e: unknown) => void>();
    return {
      addEventListener: (type: string, fn: (e: unknown) => void) => void listeners.set(type, fn),
      removeEventListener: (type: string) => void listeners.delete(type),
      fire: (type: string, e: unknown) => listeners.get(type)?.(e),
      has: (type: string) => listeners.has(type),
    };
  }

  it('records uncaught errors and rejected promises, ignores layout noise, and can be removed', () => {
    const target = fakeTarget();
    const log = createErrorLog();
    const onNew = vi.fn();
    const stop = installErrorHandler(target as never, log, () => 42, onNew);

    target.fire('error', { error: new Error('bad'), message: 'bad' });
    target.fire('unhandledrejection', { reason: 'rejected' });
    target.fire('error', { error: undefined, message: 'ResizeObserver loop completed with undelivered notifications.' });

    expect(log.list().map((e) => e.kind)).toEqual(['error', 'promise']);
    expect(log.list()[0]?.at).toBe(42);
    expect(onNew).toHaveBeenCalledTimes(2);

    stop();
    expect(target.has('error')).toBe(false);
    expect(target.has('unhandledrejection')).toBe(false);
  });
});

describe('isIgnorable', () => {
  it('only ignores the ResizeObserver loop message', () => {
    expect(isIgnorable('ResizeObserver loop limit exceeded')).toBe(true);
    expect(isIgnorable('TypeError: x is undefined')).toBe(false);
  });
});
