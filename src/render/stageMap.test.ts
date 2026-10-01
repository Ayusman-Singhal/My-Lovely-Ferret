import { describe, expect, it } from 'vitest';
import { ROOM } from './layout';
import { M_PER_PX, logicalToWorld, planeToLogical } from './stageMap';

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
    expect(right - left).toBeGreaterThan(1.1);
    expect(right - left).toBeLessThan(1.2);
    expect(left).toBeLessThan(0);
  });

  it('lifts the pet and moves it back when it rests in the hammock', () => {
    const w = logicalToWorld(ROOM.hammockX, ROOM.hammockRestY);
    expect(w.y).toBeGreaterThan(0.08);
    expect(w.y).toBeLessThan(0.2);
    expect(w.z).toBeLessThan(0);
  });

  it('turns a touch on the pet back into the logical position the touch tests expect', () => {
    // A touch at the feet is on the ground line; a touch 0.1 m up is above it (smaller y).
    expect(planeToLogical(0, 0)).toEqual({ x: 180, y: ROOM.groundY });
    expect(planeToLogical(0, 0.1).y).toBeLessThan(ROOM.groundY);
    const round = planeToLogical(logicalToWorld(250, ROOM.groundY).x, 0);
    expect(round.x).toBeCloseTo(250, 6);
  });

  it('the ferret nose reach in the plan (105 px) is about the model nose position (0.34 m)', () => {
    expect(105 * M_PER_PX).toBeGreaterThan(0.3);
    expect(105 * M_PER_PX).toBeLessThan(0.4);
  });
});
