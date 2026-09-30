import { describe, expect, it } from 'vitest';
import { cappedPixelRatio, createRenderLoop, type LoopDeps } from './loop';

/** Fake browser: a manual frame queue and a visibility switch. */
function fakeDeps() {
  const state = { hidden: false, nextId: 1, queue: new Map<number, (t: number) => void>(), listeners: new Set<() => void>(), requested: 0, cancelled: 0 };
  const deps: LoopDeps = {
    requestFrame: (cb) => {
      const id = state.nextId++;
      state.queue.set(id, cb);
      state.requested++;
      return id;
    },
    cancelFrame: (id) => {
      state.queue.delete(id);
      state.cancelled++;
    },
    isHidden: () => state.hidden,
    onVisibilityChange: (cb) => {
      state.listeners.add(cb);
      return () => state.listeners.delete(cb);
    },
  };
  /** Run the next scheduled frame at time t. Returns false when nothing was scheduled. */
  const step = (t: number): boolean => {
    const first = state.queue.entries().next();
    if (first.done) return false;
    const [id, cb] = first.value;
    state.queue.delete(id);
    cb(t);
    return true;
  };
  const setHidden = (hidden: boolean) => {
    state.hidden = hidden;
    state.listeners.forEach((l) => l());
  };
  return { state, deps, step, setHidden };
}

describe('createRenderLoop', () => {
  it('does nothing until a frame is requested', () => {
    const { state, deps } = fakeDeps();
    createRenderLoop(() => false, deps);
    expect(state.requested).toBe(0);
  });

  it('many requests schedule a single frame', () => {
    const { state, deps } = fakeDeps();
    const loop = createRenderLoop(() => false, deps);
    loop.request();
    loop.request();
    loop.request();
    expect(state.queue.size).toBe(1);
    expect(state.requested).toBe(1);
  });

  it('keeps going while draw returns true and stops when it returns false', () => {
    const { state, deps, step } = fakeDeps();
    let frames = 0;
    const loop = createRenderLoop(() => ++frames < 3, deps);
    loop.request();
    while (step(frames * 16)) {
      /* run until the loop settles */
    }
    expect(frames).toBe(3);
    expect(state.queue.size).toBe(0); // settled: no timer left running (guide §4.4)
    const requestedWhenSettled = state.requested;
    expect(step(1000)).toBe(false);
    expect(state.requested).toBe(requestedWhenSettled);
  });

  it('a settled loop wakes up again on request()', () => {
    const { state, deps, step } = fakeDeps();
    let drawn = 0;
    const loop = createRenderLoop(() => {
      drawn++;
      return false;
    }, deps);
    loop.request();
    step(0);
    expect(state.queue.size).toBe(0);
    loop.request();
    expect(state.queue.size).toBe(1);
    step(16);
    expect(drawn).toBe(2);
  });

  it('never schedules while the page is hidden, and resumes on visible if a frame was wanted', () => {
    const { state, deps, step, setHidden } = fakeDeps();
    let drawn = 0;
    const loop = createRenderLoop(() => {
      drawn++;
      return true;
    }, deps);
    setHidden(true);
    loop.request();
    expect(state.requested).toBe(0);
    setHidden(false);
    expect(state.queue.size).toBe(1);
    step(0);
    expect(drawn).toBe(1);
  });

  it('cancels the pending frame when the page becomes hidden, and pauses an animation', () => {
    const { state, deps, step, setHidden } = fakeDeps();
    let drawn = 0;
    const loop = createRenderLoop(() => {
      drawn++;
      return true;
    }, deps);
    loop.request();
    step(0);
    expect(state.queue.size).toBe(1);
    setHidden(true);
    expect(state.queue.size).toBe(0);
    expect(state.cancelled).toBe(1);
    expect(step(16)).toBe(false);
    setHidden(false);
    step(32);
    expect(drawn).toBe(2);
  });

  it('does not resume on visible when nothing was wanted', () => {
    const { state, deps, step, setHidden } = fakeDeps();
    const loop = createRenderLoop(() => false, deps);
    loop.request();
    step(0); // settled
    setHidden(true);
    setHidden(false);
    expect(state.queue.size).toBe(0);
  });

  it('honors a minimum frame time (30 fps low-power mode)', () => {
    const { deps, step } = fakeDeps();
    const times: number[] = [];
    const loop = createRenderLoop(
      (t) => {
        times.push(t);
        return true;
      },
      deps,
      { minFrameMs: 33 },
    );
    loop.request();
    for (const t of [0, 16, 33, 40, 66, 82, 99]) step(t);
    // Frames at 0, then the first display frame at least 33 ms later, and so on.
    expect(times).toEqual([0, 33, 66, 99]);
  });

  it('destroy cancels the pending frame and stops listening', () => {
    const { state, deps, step, setHidden } = fakeDeps();
    let drawn = 0;
    const loop = createRenderLoop(() => {
      drawn++;
      return true;
    }, deps);
    loop.request();
    loop.destroy();
    expect(state.queue.size).toBe(0);
    expect(state.listeners.size).toBe(0);
    setHidden(true);
    setHidden(false);
    loop.request();
    expect(step(0)).toBe(false);
    expect(drawn).toBe(0);
  });
});

describe('cappedPixelRatio', () => {
  it('caps at 2 and never goes below 1 (guide §4.4)', () => {
    expect(cappedPixelRatio(1)).toBe(1);
    expect(cappedPixelRatio(1.5)).toBe(1.5);
    expect(cappedPixelRatio(2)).toBe(2);
    expect(cappedPixelRatio(3.5)).toBe(2);
    expect(cappedPixelRatio(0)).toBe(1);
    expect(cappedPixelRatio(NaN)).toBe(1);
  });
});
