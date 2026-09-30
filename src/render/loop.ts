// Render-on-demand loop (guide §4.4). Nothing runs while nothing animates: a sleeping pet
// costs near-zero CPU. The loop also pauses while the page is hidden. `draw` returns true
// while it still needs more frames, false when the scene is settled.

export interface LoopDeps {
  requestFrame(callback: (timeMs: number) => void): number;
  cancelFrame(id: number): void;
  isHidden(): boolean;
  /** Subscribe to visibility changes. Returns an unsubscribe function. */
  onVisibilityChange(callback: () => void): () => void;
}

export interface RenderLoop {
  /** Ask for a frame. Cheap and safe to call many times. */
  request(): void;
  destroy(): void;
}

export interface LoopOptions {
  /**
   * Minimum time between drawn frames. 0 = every display frame, 33 = 30 fps low-power mode.
   * A function is read before every frame, so it can follow the current animation.
   */
  minFrameMs?: number | (() => number);
}

export function createRenderLoop(
  draw: (timeMs: number) => boolean,
  deps: LoopDeps,
  options: LoopOptions = {},
): RenderLoop {
  const minFrame = options.minFrameMs ?? 0;
  const minFrameMs = (): number => (typeof minFrame === 'function' ? minFrame() : minFrame);
  let frameId: number | null = null;
  let wanted = false;
  let lastDrawn = -Infinity;
  let destroyed = false;

  const schedule = (): void => {
    if (destroyed || frameId !== null || deps.isHidden()) return;
    frameId = deps.requestFrame(onFrame);
  };

  const onFrame = (timeMs: number): void => {
    frameId = null;
    if (destroyed || deps.isHidden()) return; // resumes from the visibility handler
    if (timeMs - lastDrawn < minFrameMs()) {
      schedule(); // too early for the frame cap: wait for the next display frame
      return;
    }
    lastDrawn = timeMs;
    wanted = draw(timeMs);
    if (wanted) schedule();
  };

  const stopListening = deps.onVisibilityChange(() => {
    if (deps.isHidden()) {
      if (frameId !== null) {
        deps.cancelFrame(frameId);
        frameId = null;
      }
    } else if (wanted) {
      schedule();
    }
  });

  return {
    request() {
      wanted = true;
      schedule();
    },
    destroy() {
      destroyed = true;
      stopListening();
      if (frameId !== null) deps.cancelFrame(frameId);
      frameId = null;
    },
  };
}

/** Real browser dependencies. Kept apart so the loop itself is testable without a DOM. */
export function browserLoopDeps(): LoopDeps {
  return {
    requestFrame: (cb) => requestAnimationFrame(cb),
    cancelFrame: (id) => cancelAnimationFrame(id),
    isHidden: () => document.visibilityState === 'hidden',
    onVisibilityChange: (cb) => {
      document.addEventListener('visibilitychange', cb);
      return () => document.removeEventListener('visibilitychange', cb);
    },
  };
}

/** Device pixel ratio, capped at 2 (guide §4.4). */
export function cappedPixelRatio(devicePixelRatio: number): number {
  return Math.min(Math.max(devicePixelRatio || 1, 1), 2);
}
