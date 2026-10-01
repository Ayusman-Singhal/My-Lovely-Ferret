// Where things are in the one room, in logical pixels (docs/ART_STYLE.md §2: the room is 360 by
// 540). PetAI, the brain, the plan, and the mini-game all think in these numbers. The 3D scene
// maps them onto the floor with stageMap.ts, so none of that code knows about 3D.

import { VIEW } from './palette';

export const ROOM = {
  foodBowlX: 58,
  waterBowlX: 302,
  toyX: 262,
  hammockX: 200,
  /** Ground line the pet stands on. */
  groundY: VIEW.floorY + 100,
  /** Feet position of a pet asleep in the hammock. */
  hammockRestY: VIEW.floorY + 60,
  /** How far left and right the pet may walk. */
  minX: 150,
  maxX: 215,
} as const;
