// Canvas 2D version of the spike scene: a room and one moving placeholder shape.
// Canvas 2D renderer, chosen over PixiJS on measured startup cost (docs/PERFORMANCE.md §3).
// This spike scene (a room and one moving shape) becomes the real scene in Part 1D.

import { browserLoopDeps, cappedPixelRatio, createRenderLoop } from './loop';
import { PALETTE, VIEW, css } from './palette';
import type { SceneHandle } from './scene';

export function createCanvasScene(host: HTMLElement): SceneHandle {
  const canvas = document.createElement('canvas');
  const ratio = cappedPixelRatio(window.devicePixelRatio);
  canvas.width = VIEW.width * ratio;
  canvas.height = VIEW.height * ratio;
  canvas.style.width = `${VIEW.width}px`;
  canvas.style.height = `${VIEW.height}px`;
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.scale(ratio, ratio);

  const draw = (timeMs: number): boolean => {
    ctx.fillStyle = css(PALETTE.wall);
    ctx.fillRect(0, 0, VIEW.width, VIEW.floorY);
    ctx.fillStyle = css(PALETTE.wallShade);
    ctx.fillRect(0, VIEW.floorY - 40, VIEW.width, 40);
    ctx.fillStyle = css(PALETTE.floor);
    ctx.fillRect(0, VIEW.floorY, VIEW.width, VIEW.height - VIEW.floorY);
    ctx.fillStyle = css(PALETTE.floorShade);
    for (let y = VIEW.floorY + 30; y < VIEW.height; y += 30) ctx.fillRect(0, y, VIEW.width, 2);
    ctx.fillStyle = css(PALETTE.cream);
    ctx.beginPath();
    ctx.roundRect(230, 110, 90, 110, 12);
    ctx.fill();

    // Placeholder "ferret": a rounded capsule walking back and forth.
    const x = 80 + 100 * (1 + Math.sin(timeMs / 900));
    ctx.fillStyle = css(PALETTE.sable);
    ctx.beginPath();
    ctx.roundRect(x, VIEW.floorY + 20, 90, 34, 17);
    ctx.fill();
    return true;
  };

  const loop = createRenderLoop(draw, browserLoopDeps());
  loop.request();
  return {
    destroy() {
      loop.destroy();
      canvas.remove();
    },
  };
}
