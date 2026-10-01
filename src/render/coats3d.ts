// Coat colours for the 3D ferret. The model has one 64 by 64 texture (the sable coat). Until the
// developer paints the other three (animation/README.md step 8: coat_cinnamon.png, coat_albino.png,
// coat_panda.png, same layout), a coat is a colour multiplied over that texture: a stand-in that
// keeps the four coats distinguishable. Values above 1 brighten, in linear colour.

import type { Coat } from '../core/types';

export const COAT_TINT: Readonly<Record<Coat, readonly [number, number, number]>> = {
  sable: [1, 1, 1],
  cinnamon: [1.45, 1.05, 0.65],
  albino: [2.1, 1.95, 1.8],
  panda: [1.5, 1.5, 1.55],
};
