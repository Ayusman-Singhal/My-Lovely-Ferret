// Fixed-point helpers (guide §7.1). Needs and bond are integers in hundredths, 0 to 10000.

export const NEED_MAX = 10000;

/** Integer division that truncates toward zero. Exact for the small integers used here. */
export function idiv(a: number, b: number): number {
  return Math.trunc(a / b);
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function sign(value: number): -1 | 0 | 1 {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

/** Hundredths to the 0 to 100 number shown to the player, rounded down. */
export function toDisplay(hundredths: number): number {
  return Math.floor(hundredths / 100);
}
