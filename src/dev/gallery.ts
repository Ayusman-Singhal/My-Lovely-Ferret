// Dev-only page: every animation as a still frame, and every coat. Open /dev/gallery.html
// with `npm run dev`. Not part of the production build (only index.html is built).
import { ANIMATIONS, ANIMATION_NAMES } from '../render/animations';
import { COAT_COLORS } from '../render/coats';
import { drawFerret } from '../render/ferretDraw';
import { PALETTE, css } from '../render/palette';
import type { Coat } from '../core/types';

const W = 230;
const H = 150;
const root = document.getElementById('root') as HTMLElement;

function cell(label: string, draw: (ctx: CanvasRenderingContext2D) => void): HTMLElement {
  const figure = document.createElement('figure');
  const canvas = document.createElement('canvas');
  canvas.width = W * 2;
  canvas.height = H * 2;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.scale(2, 2);
  ctx.fillStyle = css(PALETTE.floor);
  ctx.fillRect(0, H - 40, W, 40);
  draw(ctx);
  const caption = document.createElement('figcaption');
  caption.textContent = label;
  figure.append(canvas, caption);
  return figure;
}

function section(title: string, cells: HTMLElement[]): void {
  const h = document.createElement('h2');
  h.textContent = title;
  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.append(...cells);
  root.append(h, grid);
}

const colors = COAT_COLORS.sable;
section(
  'Animations (sable), one still frame each',
  ANIMATION_NAMES.map((name) => {
    const def = ANIMATIONS[name];
    const t = def.loop ? def.durationMs * 0.25 : def.durationMs * 0.35;
    return cell(`${name} @ ${Math.round(t)} ms`, (ctx) =>
      drawFerret(ctx, def.sample(t), colors, { x: W / 2, y: H - 22, facing: 1, scale: 1.05 }),
    );
  }),
);

const coats = Object.keys(COAT_COLORS) as Coat[];
section(
  'Coats (idle, and sleeping)',
  coats.flatMap((coat) => [
    cell(`${coat} idle`, (ctx) =>
      drawFerret(ctx, ANIMATIONS.idle.sample(800), COAT_COLORS[coat], { x: W / 2, y: H - 22, facing: 1, scale: 1.05 }),
    ),
    cell(`${coat} sleep`, (ctx) =>
      drawFerret(ctx, ANIMATIONS.sleep.sample(1000), COAT_COLORS[coat], { x: W / 2, y: H - 22, facing: -1, scale: 1.05 }),
    ),
  ]),
);
