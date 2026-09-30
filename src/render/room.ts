// The one room (docs/PET_BEHAVIOR.md §5), drawn once onto its own canvas because it never
// changes between frames. Placeholder shapes in the art palette.

import { PALETTE, VIEW, css } from './palette';

/** Where things are, so the pet can walk to them. x positions on the floor, in logical px. */
export const ROOM = {
  foodBowlX: 58,
  waterBowlX: 302,
  toyX: 262,
  hammockX: 200,
  /** Ground line the pet stands on. */
  groundY: VIEW.floorY + 100,
  /** Feet position of a pet asleep in the hammock. */
  hammockRestY: VIEW.floorY + 60,
  /** How far left and right the pet may walk. */
  minX: 150,
  maxX: 215,
} as const;

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: number, radius = 0): void {
  ctx.beginPath();
  if (radius > 0) ctx.roundRect(x, y, w, h, radius);
  else ctx.rect(x, y, w, h);
  ctx.fillStyle = css(color);
  ctx.fill();
}

function ellipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: number): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = css(color);
  ctx.fill();
}

export function drawRoom(ctx: CanvasRenderingContext2D): void {
  const { width, height, floorY } = VIEW;
  rect(ctx, 0, 0, width, floorY, PALETTE.wall);
  rect(ctx, 0, floorY - 40, width, 40, PALETTE.wallShade);
  rect(ctx, 0, floorY, width, height - floorY, PALETTE.floor);
  for (let y = floorY + 30; y < height; y += 30) rect(ctx, 0, y, width, 2, PALETTE.floorShade);

  // Window.
  rect(ctx, 34, 110, 100, 130, PALETTE.floorShade, 12);
  rect(ctx, 42, 118, 84, 114, PALETTE.waterBlue, 8);
  rect(ctx, 82, 118, 4, 114, PALETTE.floorShade);
  rect(ctx, 42, 172, 84, 4, PALETTE.floorShade);

  // Hammock: two posts and a sagging sling.
  const hx = ROOM.hammockX;
  rect(ctx, hx - 84, floorY + 10, 7, 110, PALETTE.floorShade, 3);
  rect(ctx, hx + 77, floorY + 10, 7, 110, PALETTE.floorShade, 3);
  ctx.beginPath();
  ctx.moveTo(hx - 80, floorY + 30);
  ctx.quadraticCurveTo(hx, floorY + 90, hx + 80, floorY + 30);
  ctx.lineTo(hx + 80, floorY + 42);
  ctx.quadraticCurveTo(hx, floorY + 104, hx - 80, floorY + 42);
  ctx.closePath();
  ctx.fillStyle = css(PALETTE.belly);
  ctx.fill();

  const y = ROOM.groundY;
  // Food bowl and water bowl.
  ellipse(ctx, ROOM.foodBowlX, y + 2, 34, 8, PALETTE.ink);
  rect(ctx, ROOM.foodBowlX - 31, y - 17, 62, 19, PALETTE.bowlRed, 9);
  ellipse(ctx, ROOM.foodBowlX, y - 17, 31, 6, PALETTE.wallShade);
  ellipse(ctx, ROOM.waterBowlX, y + 2, 34, 8, PALETTE.ink);
  rect(ctx, ROOM.waterBowlX - 31, y - 17, 62, 19, PALETTE.waterBlue, 9);
  ellipse(ctx, ROOM.waterBowlX, y - 17, 31, 6, PALETTE.cream);

  // A ball toy.
  ellipse(ctx, ROOM.toyX, y - 12, 13, 13, PALETTE.gold);
  ellipse(ctx, ROOM.toyX - 4, y - 16, 3.5, 3.5, PALETTE.cream);
}
