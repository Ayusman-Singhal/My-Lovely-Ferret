// Small movable props drawn each frame under the ferret (the room itself is a static canvas).

import { PALETTE, css } from './palette';

/** A sock lying on the floor, feet at (x, y). While the pet carries it, the rig draws it instead. */
export function drawSock(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y - 8);
  ctx.beginPath();
  ctx.roundRect(-14, 0, 28, 11, 5);
  ctx.fillStyle = css(PALETTE.bowlRed);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(4, 0, 10, 11, 5);
  ctx.fillStyle = css(PALETTE.cream);
  ctx.fill();
  ctx.restore();
}
