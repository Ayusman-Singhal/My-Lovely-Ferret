// The 16-color palette from docs/ART_STYLE.md §3, as numbers (0xRRGGBB).
export const PALETTE = {
  cream: 0xf6ecdc,
  wall: 0xebd3b5,
  wallShade: 0xddbf9c,
  floor: 0xc9a07a,
  floorShade: 0xa9805c,
  ink: 0x3b2f26,
  sable: 0x8a6244,
  sableDark: 0x4a3626,
  cinnamon: 0xb9743c,
  albino: 0xf4ebdc,
  pandaDark: 0x3e3a3f,
  belly: 0xe8d2b0,
  nosePink: 0xe59aa0,
  waterBlue: 0x6fa8c8,
  bowlRed: 0xd9604c,
  gold: 0xf2c75c,
} as const;

/** Logical viewport (docs/ART_STYLE.md §2). */
export const VIEW = { width: 360, height: 640, floorY: 470 } as const;

export const css = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
