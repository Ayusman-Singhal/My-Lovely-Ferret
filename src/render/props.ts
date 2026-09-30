// Small movable props drawn each frame under the ferret (the room itself is a static canvas).

import { PALETTE, css } from './palette';

function fillWith(ctx: CanvasRenderingContext2D, color: number): void {
  ctx.fillStyle = css(color);
  ctx.fill();
}

/** A sock lying on the floor, feet at (x, y). While the pet carries it, the rig draws it instead. */
export function drawSock(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y - 8);
  ctx.beginPath();
  ctx.roundRect(-14, 0, 28, 11, 5);
  fillWith(ctx, PALETTE.bowlRed);
  ctx.beginPath();
  ctx.roundRect(4, 0, 10, 11, 5);
  fillWith(ctx, PALETTE.cream);
  ctx.restore();
}

/** The toy being dragged in the mini-game, resting on the floor at (x, y). */
export function drawToy(ctx: CanvasRenderingContext2D, toyId: string, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  if (toyId === 'feather') {
    ctx.beginPath();
    ctx.ellipse(0, -16, 6, 20, 0.4, 0, Math.PI * 2);
    fillWith(ctx, PALETTE.waterBlue);
    ctx.beginPath();
    ctx.roundRect(-1.5, -6, 3, 16, 1.5);
    fillWith(ctx, PALETTE.ink);
  } else if (toyId === 'ring') {
    ctx.beginPath();
    ctx.arc(0, -12, 11, 0, Math.PI * 2);
    ctx.lineWidth = 5;
    ctx.strokeStyle = css(PALETTE.bowlRed);
    ctx.stroke();
  } else if (toyId === 'sock') {
    ctx.beginPath();
    ctx.roundRect(-14, -12, 28, 11, 5);
    fillWith(ctx, PALETTE.bowlRed);
    ctx.beginPath();
    ctx.roundRect(4, -12, 10, 11, 5);
    fillWith(ctx, PALETTE.cream);
  } else {
    ctx.beginPath();
    ctx.arc(0, -13, 13, 0, Math.PI * 2);
    fillWith(ctx, PALETTE.gold);
    ctx.beginPath();
    ctx.arc(-4, -17, 3.5, 0, Math.PI * 2);
    fillWith(ctx, PALETTE.cream);
  }
  ctx.restore();
}

/** A thin bar along the top of the room showing how much of the mini-game is left. Shapes only, no text. */
export function drawTimerBar(ctx: CanvasRenderingContext2D, fractionLeft: number, width: number): void {
  ctx.beginPath();
  ctx.roundRect(16, 10, width - 32, 8, 4);
  fillWith(ctx, PALETTE.wallShade);
  ctx.beginPath();
  ctx.roundRect(16, 10, Math.max(8, (width - 32) * fractionLeft), 8, 4);
  fillWith(ctx, PALETTE.gold);
}
