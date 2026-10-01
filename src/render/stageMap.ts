// Maps the logical room (360 by 540 px, y grows downward, see layout.ts) onto the 3D floor and
// back. Pure numbers, tested without three.js. The room is 1.152 m wide; the walking pet stays
// on the line z = 0, and a pet lifted into the hammock (y smaller than the ground line) also
// moves a little back, so the climb reads as going up and into the hammock.

import { ROOM } from './layout';
import { VIEW } from './palette';

/** Metres per logical pixel. The ferret is about 0.62 m, so about 194 px, nose to tail. */
export const M_PER_PX = 0.0032;
const CENTER_X = VIEW.width / 2;
/** Metres up and back per logical pixel of lift above the ground line. */
const RISE_PER_PX = 0.003;
const BACK_PER_PX = 0.006;

export interface World {
  x: number;
  y: number;
  z: number;
}

/** The feet position (x, y) in logical px, as a point in the 3D room in metres. */
export function logicalToWorld(x: number, y: number): World {
  const lift = ROOM.groundY - y;
  return { x: (x - CENTER_X) * M_PER_PX, y: lift * RISE_PER_PX, z: -lift * BACK_PER_PX };
}

/**
 * A point on the vertical plane through the pet (world x and height, metres), as the logical
 * position a touch there means. Touch tests in the controller measure against the feet position
 * and a box above it, so height above the floor becomes a smaller logical y.
 */
export function planeToLogical(worldX: number, worldY: number): { x: number; y: number } {
  return { x: worldX / M_PER_PX + CENTER_X, y: ROOM.groundY - worldY / M_PER_PX };
}
