// How the room decorations look (Part 1L.6): wall, floor, and rug colours, and the two pieces of
// furniture for the back right corner. Like outfits3d.ts it holds only numbers, so a test can check
// it against the shop catalog. Furniture boxes are in metres, relative to the foot of the piece.

import type { OutfitPart } from './outfits3d';

export const WALL_SKINS: Readonly<Record<string, number>> = {
  wall_sage: 0xcbd6b4,
  wall_sky: 0xc5d9e3,
  wall_blush: 0xeccdc4,
};

export const FLOOR_SKINS: Readonly<Record<string, number>> = {
  floor_pale: 0xdcc399,
  floor_dark: 0x8d6a4b,
  floor_slate: 0x969da3,
};

/** Border colour, then the inside colour. */
export const RUG_SKINS: Readonly<Record<string, readonly [number, number]>> = {
  rug_blue: [0x4f7fa0, 0xcfe0ea],
  rug_green: [0x6b9a58, 0xdfe9cf],
  rug_red: [0xb2473a, 0xf1d9cf],
};

/** Where the corner furniture stands: on the right, between the hammock and the water bowl, where the camera sees it. */
export const CORNER_AT = { x: 0.52, z: -0.3 } as const;

export const CORNER_PARTS: Readonly<Record<string, readonly OutfitPart[]>> = {
  plant: [
    { size: [0.15, 0.12, 0.15], at: [0, 0.06, 0], color: 0xb5694a },
    { size: [0.13, 0.012, 0.13], at: [0, 0.126, 0], color: 0x4a3626 },
    { size: [0.03, 0.18, 0.03], at: [0, 0.21, 0], color: 0x5f8f4e },
    { size: [0.03, 0.16, 0.03], at: [0.05, 0.2, 0.02], color: 0x5f8f4e, rotZ: -0.4 },
    { size: [0.03, 0.16, 0.03], at: [-0.05, 0.2, -0.02], color: 0x5f8f4e, rotZ: 0.4 },
    { size: [0.09, 0.05, 0.09], at: [0, 0.32, 0], color: 0x79ad62 },
    { size: [0.08, 0.05, 0.08], at: [0.1, 0.285, 0.03], color: 0x79ad62 },
    { size: [0.08, 0.05, 0.08], at: [-0.1, 0.285, -0.03], color: 0x79ad62 },
  ],
  lamp: [
    { size: [0.13, 0.02, 0.13], at: [0, 0.01, 0], color: 0x4a3626 },
    { size: [0.022, 0.56, 0.022], at: [0, 0.3, 0], color: 0x4a3626 },
    { size: [0.16, 0.1, 0.16], at: [0, 0.62, 0], color: 0xf2e1b0 },
    { size: [0.08, 0.02, 0.08], at: [0, 0.565, 0], color: 0xf9eaa0 },
  ],
};

/** The same colour a little darker, for the shaded parts that go with a skin (base bands, planks). */
export function darker(color: number, factor = 0.86): number {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}
