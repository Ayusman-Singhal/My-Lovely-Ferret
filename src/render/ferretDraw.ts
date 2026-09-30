// Draws the placeholder ferret rig for one pose (docs/ART_STYLE.md §4). Flat shapes only:
// no gradients, blur, or shadows. Local units are logical pixels. The origin is on the
// ground under the middle of the body, the rig faces right, y points down.
// When final art arrives, only the shape drawing inside this file changes: the pose,
// part names, and pivots stay the same.

import type { CoatColors } from './coats';
import { shade } from './coats';
import { PALETTE, css } from './palette';
import type { Pose } from './pose';

export interface DrawOptions {
  x: number;
  y: number;
  /** 1 = facing right, -1 = facing left. */
  facing: 1 | -1;
  scale: number;
}

const HIP = { x: -34, y: -24 };
const SHOULDER = { x: 30, y: -24 };
const LEG_LEN = 24;

/** The parts of the 2D context the drawer uses, so tests can pass a recording fake. */
export type Ctx = CanvasRenderingContext2D;

function fill(ctx: Ctx, color: number, alpha = 1): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = css(color);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: number, alpha = 1): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  fill(ctx, color, alpha);
}

function capsule(ctx: Ctx, x: number, y: number, w: number, h: number, color: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(w, h) / 2);
  fill(ctx, color);
}

function drawLeg(ctx: Ctx, hip: { x: number; y: number }, angle: number, tuck: number, body: number, dark: number): void {
  const len = LEG_LEN * (1 - 0.65 * tuck);
  ctx.save();
  ctx.translate(hip.x, hip.y);
  ctx.rotate(angle + 1.2 * tuck);
  capsule(ctx, -4.5, 0, 9, len, body);
  capsule(ctx, -5, len - 7, 10, 7, dark);
  ctx.restore();
}

function drawTail(ctx: Ctx, pose: Pose, colors: CoatColors): void {
  ctx.save();
  ctx.translate(-48, -36);
  ctx.rotate(Math.PI + pose.tailRot);
  capsule(ctx, 0, -6.5, 34, 13, colors.body);
  ctx.translate(30, 0);
  ctx.rotate(pose.tailRot2);
  capsule(ctx, 0, -5, 24, 10, colors.dark);
  ctx.restore();
}

function drawEye(ctx: Ctx, pose: Pose, colors: CoatColors): void {
  const cx = 23;
  const cy = -4;
  if (pose.eyes === 0) {
    const r = 2.9 * (1 + 0.35 * pose.eyeWide);
    ellipse(ctx, cx, cy, r, r, colors.eyes);
    ellipse(ctx, cx - 0.9, cy - 1, 0.9, 0.9, PALETTE.cream);
    return;
  }
  ctx.strokeStyle = css(colors.eyes);
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (pose.eyes === 1) {
    ctx.moveTo(cx - 3, cy);
    ctx.lineTo(cx + 3, cy);
    ctx.stroke();
    ellipse(ctx, cx, cy + 0.6, 2.4, 1.2, colors.eyes);
  } else if (pose.eyes === 2) {
    ctx.arc(cx, cy - 1, 3, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else {
    ctx.arc(cx, cy + 2, 3.2, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
  }
}

function drawMouth(ctx: Ctx, pose: Pose): void {
  ctx.strokeStyle = css(PALETTE.ink);
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  if (pose.mouth === 1) {
    ellipse(ctx, 35.5, 8, 4.2, 3.2, PALETTE.ink, 0.85);
    ellipse(ctx, 35.5, 9.2, 2.4, 1.4, PALETTE.nosePink);
    return;
  }
  ctx.beginPath();
  if (pose.mouth === 2) {
    ctx.arc(35, 3.5, 5, 0.2 * Math.PI, 0.8 * Math.PI);
  } else {
    ctx.moveTo(38, 6.5);
    ctx.quadraticCurveTo(34, 8.5, 30, 7);
  }
  ctx.stroke();
}

function drawHead(ctx: Ctx, pose: Pose, colors: CoatColors): void {
  ctx.save();
  ctx.translate(46, -38);
  ctx.rotate(pose.headRot);
  ctx.translate(pose.headDX, pose.headDY);

  // Far ear behind the skull, near ear in front of it. 0 = up, positive = back (flattened).
  const ear = (x: number, y: number, angle: number, color: number): void => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-angle);
    ellipse(ctx, 0, -6, 5.5, 7.5, color);
    ellipse(ctx, 0, -5.5, 2.6, 4.4, colors.dark === PALETTE.nosePink ? PALETTE.nosePink : colors.belly, 0.9);
    ctx.restore();
  };
  ear(-1, -11, pose.earFar, shade(colors.body, 0.85));

  ellipse(ctx, 14, -2, 18, 14.5, colors.body); // skull
  ellipse(ctx, 31, 3, 11, 8.2, colors.belly); // muzzle
  if (colors.mask) ellipse(ctx, 17, -3, 12, 6.5, colors.dark); // face mask
  ear(6, -12, pose.earNear, colors.body);

  drawEye(ctx, pose, colors);
  ellipse(ctx, 41.5 + pose.noseTwitch, 0.5, 3.3, 2.7, colors.nose);
  drawMouth(ctx, pose);

  if (pose.carry > 0) {
    // A sock hanging from the mouth.
    ctx.save();
    ctx.translate(34, 9);
    ctx.rotate(0.35);
    ctx.beginPath();
    ctx.roundRect(-2, 0, 24, 10, 4);
    fill(ctx, PALETTE.bowlRed);
    ctx.beginPath();
    ctx.roundRect(14, 0, 8, 10, 4);
    fill(ctx, PALETTE.cream);
    ctx.restore();
  }
  ctx.restore();
}

/** Draw one frame of the ferret. Every save() is matched by a restore(). */
export function drawFerret(ctx: Ctx, pose: Pose, colors: CoatColors, opts: DrawOptions): void {
  ctx.save();
  ctx.translate(opts.x, opts.y);
  ctx.scale(opts.facing * opts.scale, opts.scale);

  // Ground shadow, shrinking as the body lifts.
  const lift = Math.max(0, pose.bodyLift);
  ellipse(ctx, 0, 0, 56 * (1 - lift / 60), 6 * (1 - lift / 60), PALETTE.ink, 0.14);

  ctx.translate(0, -pose.bodyLift);

  // Back legs stay planted at the hips, front legs ride on the body.
  const farColor = shade(colors.body, 0.82);
  const farDark = shade(colors.dark, 0.82);
  drawLeg(ctx, HIP, pose.legBF, pose.legTuck, farColor, farDark);

  ctx.save();
  ctx.translate(HIP.x, HIP.y);
  ctx.rotate(pose.bodyRot);
  ctx.translate(-HIP.x, -HIP.y);

  // A tail wrapped around the body (sleeping) lies in front of it, otherwise it is behind.
  const tailInFront = pose.tailRot < -1.2;
  if (!tailInFront) drawTail(ctx, pose, colors);
  drawLeg(ctx, SHOULDER, pose.legFF, pose.legTuck, farColor, farDark);

  // Body: a long capsule with a lighter belly, scaled about its center for breathing and stretch.
  ctx.save();
  ctx.translate(0, -34);
  ctx.scale(pose.bodyScaleX, pose.bodyScaleY);
  capsule(ctx, -52, -17, 104, 34, colors.body);
  ellipse(ctx, 2, 10, 38, 6.5, colors.belly, 0.75);
  ctx.restore();

  drawLeg(ctx, SHOULDER, pose.legFN, pose.legTuck, colors.body, colors.dark);
  if (tailInFront) drawTail(ctx, pose, colors);
  drawHead(ctx, pose, colors);
  ctx.restore();

  drawLeg(ctx, HIP, pose.legBN, pose.legTuck, colors.body, colors.dark);
  ctx.restore();
}
