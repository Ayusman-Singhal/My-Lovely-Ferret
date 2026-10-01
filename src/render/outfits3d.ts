// What each outfit looks like on the ferret (Part 1L.5): a few coloured boxes in the same blocky
// style as the model, fastened to the head bone. Positions are in the model's own rest pose, in
// metres: x to the pet's left, y up, z forward. The head box spans y 0.083 to 0.189 and z 0.168 to
// 0.331, the neck box (also part of the head bone) y 0.055 to 0.182 and z 0.086 to 0.228, and the
// ears stand at z 0.28 and x 0.06 on either side (measured on animation/export/ferret.glb).
// No code here touches three.js, so a test can check the list against the shop catalog.

import { PALETTE } from './palette';

export interface OutfitPart {
  size: readonly [number, number, number];
  at: readonly [number, number, number];
  color: number;
  /** Turn about the up axis and the forward axis, in radians. */
  rotY?: number;
  rotZ?: number;
}

const PINK = 0xe8869a;
const NECK_Y = 0.118;
const NECK_Z = 0.157;

export const OUTFIT_PARTS: Readonly<Record<string, readonly OutfitPart[]>> = {
  bow: [
    { size: [0.024, 0.024, 0.02], at: [0, 0.2, 0.2], color: PINK },
    { size: [0.044, 0.034, 0.016], at: [0.032, 0.204, 0.2], color: PINK, rotZ: 0.35 },
    { size: [0.044, 0.034, 0.016], at: [-0.032, 0.204, 0.2], color: PINK, rotZ: -0.35 },
  ],
  flower: [
    { size: [0.022, 0.016, 0.022], at: [0.052, 0.198, 0.235], color: PALETTE.gold },
    { size: [0.026, 0.012, 0.026], at: [0.052, 0.195, 0.262], color: PINK },
    { size: [0.026, 0.012, 0.026], at: [0.052, 0.195, 0.208], color: PINK },
    { size: [0.026, 0.012, 0.026], at: [0.08, 0.195, 0.235], color: PINK },
    { size: [0.026, 0.012, 0.026], at: [0.024, 0.195, 0.235], color: PINK },
  ],
  party_hat: [
    { size: [0.09, 0.035, 0.09], at: [0, 0.2065, 0.215], color: PALETTE.gold },
    { size: [0.066, 0.035, 0.066], at: [0, 0.2415, 0.215], color: PALETTE.waterBlue },
    { size: [0.042, 0.035, 0.042], at: [0, 0.2765, 0.215], color: PALETTE.gold },
    { size: [0.022, 0.022, 0.022], at: [0, 0.305, 0.215], color: PALETTE.bowlRed },
  ],
  bell_collar: [
    { size: [0.174, 0.03, 0.154], at: [0, NECK_Y, NECK_Z], color: PALETTE.waterBlue },
    { size: [0.028, 0.028, 0.02], at: [0, NECK_Y - 0.026, 0.236], color: PALETTE.gold },
  ],
  bandana: [
    { size: [0.174, 0.032, 0.154], at: [0, NECK_Y + 0.004, NECK_Z], color: PALETTE.bowlRed },
    { size: [0.12, 0.028, 0.018], at: [0, NECK_Y - 0.022, 0.237], color: PALETTE.bowlRed },
    { size: [0.07, 0.028, 0.018], at: [0, NECK_Y - 0.048, 0.237], color: PALETTE.bowlRed },
    { size: [0.026, 0.028, 0.018], at: [0, NECK_Y - 0.074, 0.237], color: PALETTE.bowlRed },
  ],
  scarf: [
    { size: [0.18, 0.052, 0.16], at: [0, NECK_Y + 0.004, NECK_Z], color: PALETTE.cream },
    { size: [0.182, 0.014, 0.162], at: [0, NECK_Y + 0.012, NECK_Z], color: PALETTE.bowlRed },
    { size: [0.182, 0.014, 0.162], at: [0, NECK_Y - 0.008, NECK_Z], color: PALETTE.bowlRed },
    { size: [0.032, 0.1, 0.03], at: [0.088, 0.05, 0.19], color: PALETTE.cream },
    { size: [0.034, 0.014, 0.032], at: [0.088, 0.058, 0.19], color: PALETTE.bowlRed },
  ],
};
