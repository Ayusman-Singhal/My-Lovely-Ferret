// Maps the logical room (360 by 540 px, see layout.ts) onto the 3D floor and back. Pure numbers,
// tested without three.js. 1 logical px is 4.8 mm, so the room's 360 px width is 1.73 m. x runs left
// to right, z from the back wall (negative) toward the camera, and a pet lifted into the hammock
// (y smaller than the ground line) rises 3 mm per px.

import { ROOM } from './layout';
import { VIEW } from './palette';

/** Metres per logical pixel. The ferret model is 0.62 m, shown at PET_SCALE of that. */
export const M_PER_PX = 0.0048;
/** Size of the model in the room. 1 = the model as exported (0.62 m, about 130 px). */
export const PET_SCALE = 1;
const CENTER_X = VIEW.width / 2;
/** Metres of height per logical pixel of lift above the ground line. */
const RISE_PER_PX = 0.003;

export interface World {
  x: number;
  y: number;
  z: number;
}

/** The feet position (x, z on the floor, y the lift) in logical px, as a point in the 3D room in metres. */
export function logicalToWorld(x: number, y: number, z = 0): World {
  return { x: (x - CENTER_X) * M_PER_PX, y: (ROOM.groundY - y) * RISE_PER_PX, z: z * M_PER_PX };
}

/**
 * A point on the vertical plane through the pet (world x and height, metres), as the logical
 * position a touch there means. Touch tests in the controller measure against the feet position
 * and a box above it, so height above the floor becomes a smaller logical y.
 */
export function planeToLogical(worldX: number, worldY: number): { x: number; y: number } {
  return { x: worldX / M_PER_PX + CENTER_X, y: ROOM.groundY - worldY / M_PER_PX };
}
