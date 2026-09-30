// The game scene: a static room canvas with the animated ferret canvas on top. The renderer
// owns per-frame animation: Preact never drives it (guide §4.4). Frames are scheduled on
// demand and paused while the page is hidden (see loop.ts).

import type { Coat } from '../core/types';
import { hashString } from '../core/rng';
import { createAnimator, type Animator } from './animator';
import { COAT_COLORS } from './coats';
import { drawFerret } from './ferretDraw';
import { browserLoopDeps, cappedPixelRatio, createRenderLoop } from './loop';
import { VIEW } from './palette';
import { ROOM, drawRoom } from './room';

/** The ferret is the product, so it is drawn large (about 240 of the 360 px width). */
export const PET_SCALE = 1.3;

export interface SceneOptions {
  coat: Coat;
  /** Seed for blink timing, for example the pet id. */
  seed: string;
  /** Called at the start of every frame, before drawing. The brain moves the pet here. */
  onFrame?: (nowMs: number, scene: Scene) => void;
  /** Draw extra things (props) under the ferret, on the same canvas, every frame. */
  onDraw?: (ctx: CanvasRenderingContext2D) => void;
  /** Pointer events in logical room coordinates (360 by 540), with real timestamps. */
  onPointer?: {
    down(x: number, y: number, realMs: number): void;
    move(x: number, y: number, realMs: number): void;
    up(realMs: number): void;
  };
  lowPower?: boolean;
}

export interface Scene {
  readonly animator: Animator;
  /** Position of the ferret's feet, in logical px. */
  x: number;
  y: number;
  facing: 1 | -1;
  setCoat(coat: Coat): void;
  /** Ask for a redraw, for example after a state change while everything was settled. */
  requestFrame(): void;
  destroy(): void;
}

function makeCanvas(ratio: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = VIEW.width * ratio;
  canvas.height = VIEW.height * ratio;
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.scale(ratio, ratio);
  return { canvas, ctx };
}

export function createScene(host: HTMLElement, options: SceneOptions): Scene {
  const ratio = cappedPixelRatio(window.devicePixelRatio);
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `position:relative;width:min(100%,100cqw,calc(100cqh * ${VIEW.width} / ${VIEW.height}),calc(100dvh * ${VIEW.width} / ${VIEW.height}));aspect-ratio:${VIEW.width}/${VIEW.height}`;
  const room = makeCanvas(ratio);
  const pet = makeCanvas(ratio);
  wrapper.append(room.canvas, pet.canvas);
  host.appendChild(wrapper);
  drawRoom(room.ctx);

  // Pointer events work for mouse and touch alike. Never hover (guide §9.3).
  const toLogical = (e: PointerEvent): { x: number; y: number } => {
    const rect = wrapper.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * VIEW.width, y: ((e.clientY - rect.top) / rect.height) * VIEW.height };
  };
  const pointer = options.onPointer;
  const listeners: Array<[string, (e: PointerEvent) => void]> = [];
  if (pointer) {
    wrapper.style.touchAction = 'none'; // dragging the toy must not scroll the page
    listeners.push(
      ['pointerdown', (e) => { wrapper.setPointerCapture(e.pointerId); const p = toLogical(e); pointer.down(p.x, p.y, e.timeStamp); }],
      ['pointermove', (e) => { const p = toLogical(e); pointer.move(p.x, p.y, e.timeStamp); }],
      ['pointerup', (e) => pointer.up(e.timeStamp)],
      ['pointercancel', (e) => pointer.up(e.timeStamp)],
    );
    for (const [type, fn] of listeners) wrapper.addEventListener(type, fn as EventListener);
  }

  let colors = COAT_COLORS[options.coat];
  const animator = createAnimator({ seed: hashString(options.seed) });

  const scene: Scene = {
    animator,
    x: (ROOM.minX + ROOM.maxX) / 2,
    y: ROOM.groundY,
    facing: 1,
    setCoat(coat) {
      colors = COAT_COLORS[coat];
      loop.request();
    },
    requestFrame: () => loop.request(),
    destroy() {
      for (const [type, fn] of listeners) wrapper.removeEventListener(type, fn as EventListener);
      loop.destroy();
      wrapper.remove();
    },
  };

  const draw = (nowMs: number): boolean => {
    options.onFrame?.(nowMs, scene);
    const pose = animator.update(nowMs);
    pet.ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    options.onDraw?.(pet.ctx);
    drawFerret(pet.ctx, pose, colors, { x: scene.x, y: scene.y, facing: scene.facing, scale: PET_SCALE });
    return true; // the ferret is always at least breathing
  };

  const loop = createRenderLoop(draw, browserLoopDeps(), {
    minFrameMs: () => (options.lowPower ? Math.max(33, animator.frameIntervalMs()) : animator.frameIntervalMs()),
  });
  loop.request();
  return scene;
}
