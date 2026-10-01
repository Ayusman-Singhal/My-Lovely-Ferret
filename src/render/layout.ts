// Where things are in the one room, in logical pixels (docs/ART_STYLE.md §2). x runs left to right
// across the 360 px width, z runs from the back wall (negative) toward the camera (positive), and y
// is the old "feet line": lower than groundY means lifted off the floor (the hammock). PetAI, the
// brain, the plan, and the mini-game all think in these numbers. The 3D scene maps them onto the
// floor with stageMap.ts (1 px is 4.8 mm), so none of that code knows about 3D.
//
// The pet roams the whole floor rectangle (minX..maxX by minZ..maxZ). Furniture stands outside it,
// along the walls, so a straight walk between two points inside never crosses anything solid.

import { VIEW } from './palette';

export const ROOM = {
  /** Food bowl on the left wall side, water bowl on the right. The pet stands one nose length away. */
  foodBowlX: 38,
  foodBowlZ: 25,
  waterBowlX: 322,
  waterBowlZ: -25,
  /** The ball on the floor, which the pet goes to look at. */
  toyX: 288,
  toyZ: 58,
  /** The hammock against the back wall. The pet steps up into it from the approach point in front. */
  hammockX: 232,
  hammockZ: -125,
  hammockApproachZ: -72,
  /** The window on the back wall, as an x position. The pet goes to the wall below it to look out. */
  windowX: 92,
  /** Where a fetched ball is brought and dropped, in front of the player. */
  fetchDropX: 190,
  fetchDropZ: 70,
  /** The tunnel along the front edge: the pet runs in at one mouth and out of the other (Part 1L.3). */
  tunnelAX: 72,
  tunnelBX: 212,
  tunnelZ: 131,
  /** The line the toy-chase mini-game is played on. */
  chaseZ: 10,
  /** Ground line the pet stands on. */
  groundY: VIEW.floorY + 100,
  /** Feet position of a pet asleep in the hammock. */
  hammockRestY: VIEW.floorY + 60,
  /** How far the pet's feet may roam. */
  minX: 86,
  maxX: 274,
  minZ: -73,
  maxZ: 94,
  /** The most the brain lets a scripted walk go past that, for the tunnel and a wide turn. */
  reachMinX: 20,
  reachMaxX: 340,
  reachMinZ: -90,
  reachMaxZ: 150,
} as const;
