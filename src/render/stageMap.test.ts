import { describe, expect, it } from 'vitest';
import { ROOM } from './layout';
import { M_PER_PX, PET_SCALE, logicalToWorld, planeToLogical } from './stageMap';

describe('stageMap', () => {
  it('puts the middle of the room at x = 0 and feet on the floor', () => {
    const w = logicalToWorld(180, ROOM.groundY);
    expect(w.x).toBeCloseTo(0, 9);
    expect(w.y).toBe(0);
    expect(w.z).toBeCloseTo(0, 9);
  });

  it('maps the room width to about 1.15 m, left to right', () => {
    const left = logicalToWorld(0, ROOM.groundY).x;
    const right = logicalToWorld(360, ROOM.groundY).x;
    expect(right - left).toBeCloseTo(360 * M_PER_PX, 9);
    expect(right - left).toBeGreaterThan(1.6);
    expect(right - left).toBeLessThan(1.9);
    expect(left).toBeLessThan(0);
  });

  it('lifts the pet and moves it back when it rests in the hammock', () => {
    const w = logicalToWorld(ROOM.hammockX, ROOM.hammockRestY, ROOM.hammockZ);
    expect(w.y).toBeGreaterThan(0.08);
    expect(w.y).toBeLessThan(0.2);
    expect(w.z).toBeLessThan(-0.4); // against the back wall, behind the roaming area
  });

  it('turns a touch on the pet back into the logical position the touch tests expect', () => {
    // A touch at the feet is on the ground line; a touch 0.1 m up is above it (smaller y).
    expect(planeToLogical(0, 0)).toEqual({ x: 180, y: ROOM.groundY });
    expect(planeToLogical(0, 0.1).y).toBeLessThan(ROOM.groundY);
    const round = planeToLogical(logicalToWorld(250, ROOM.groundY).x, 0);
    expect(round.x).toBeCloseTo(250, 6);
  });

  it('puts depth on the z axis and keeps the roaming area inside the room', () => {
    expect(logicalToWorld(180, ROOM.groundY, 100).z).toBeCloseTo(100 * M_PER_PX, 9);
    expect(logicalToWorld(ROOM.minX, ROOM.groundY, ROOM.minZ).x).toBeGreaterThan(-0.88);
    expect(logicalToWorld(ROOM.maxX, ROOM.groundY, ROOM.maxZ).z).toBeLessThan(0.78);
  });

  it('the plan nose reach (71 px) is about the model nose position at the shown size (0.34 m x PET_SCALE)', () => {
    const noseM = 0.342 * PET_SCALE;
    expect(Math.abs(71 * M_PER_PX - noseM)).toBeLessThan(0.02);
  });
});
