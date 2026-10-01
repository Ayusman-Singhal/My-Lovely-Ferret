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
} as const;
