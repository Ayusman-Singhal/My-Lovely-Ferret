// Coats are palette swaps of the same rig (docs/ART_STYLE.md §5, guide §7.8): three colors
// and a flag, so a coat costs no extra art bytes.

import type { Coat } from '../core/types';
import { PALETTE } from './palette';

export interface CoatColors {
  body: number;
  /** Mask, feet, tail tip, ears (albino: pink). */
  dark: number;
  belly: number;
  eyes: number;
  nose: number;
  /** Draw the dark face mask. Albino has none. */
  mask: boolean;
}

export const COAT_COLORS: Readonly<Record<Coat, CoatColors>> = {
  sable: { body: PALETTE.sable, dark: PALETTE.sableDark, belly: PALETTE.belly, eyes: PALETTE.ink, nose: PALETTE.nosePink, mask: true },
  cinnamon: { body: PALETTE.cinnamon, dark: PALETTE.sable, belly: PALETTE.belly, eyes: PALETTE.ink, nose: PALETTE.nosePink, mask: true },
  albino: { body: PALETTE.albino, dark: PALETTE.nosePink, belly: PALETTE.cream, eyes: PALETTE.nosePink, nose: PALETTE.nosePink, mask: false },
  panda: { body: PALETTE.albino, dark: PALETTE.pandaDark, belly: PALETTE.cream, eyes: PALETTE.ink, nose: PALETTE.nosePink, mask: true },
};

/** Darken a 0xRRGGBB color, for parts on the far side of the body. */
export function shade(color: number, factor: number): number {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}
