import { describe, expect, it } from 'vitest';
import { HOUR, T0, makePet } from '../core/testkit';
import { createManualClock } from '../core/time';
import { CHASE } from '../core/toyChase';
import type { PetRecord } from '../core/types';
import type { AnimationName } from '../render/clipSpec';
import type { BrainScene } from '../render/brain';
import { ROOM } from '../render/layout';
import { createGame, type GameOptions, type PlayResult, type RoomTouch } from './controller';

function setup(pet: PetRecord, extra: Partial<GameOptions> = {}) {
  const clock = createManualClock(pet.timestamps.lastSimulationTime);
  const reactions: AnimationName[] = [];
  const bases: AnimationName[] = [];
  const scene: BrainScene = {
    x: 180,
    y: ROOM.groundY,
    z: 0,
    facing: 1,
    heading: null,
    animator: { setBase: (n) => bases.push(n), react: (n) => reactions.push(n) },
  };
  const plays: PlayResult[] = [];
  let changes = 0;
  const game = createGame({ pet, clock, onChange: () => changes++, onPlayEnd: (r) => plays.push(r), ...extra });
  let frame = 0;
  /** Run display frames of 16 ms real time. Game time moves 16 ms per frame too. */
  const run = (frames: number, each?: () => void): void => {
    for (let i = 0; i < frames; i++) {
      frame++;
      clock.advance(16);
      game.tick(frame * 16, scene);
      each?.();
    }
  };
  return { game, scene, clock, reactions, bases, plays, run, changes: () => changes };
}

const hungry = () => makePet({ id: 'ctl', state: { hunger: 3000, hydration: 3000, energy: 8000, happiness: 5000, bond: 1000 } });

describe('feeding and watering', () => {
  it('feeding raises hunger, stocks the bowl, sends the pet to eat, and empties the bowl afterwards', () => {
    const t = setup(hungry());
    t.run(5);
    const r = t.game.dispatch({ type: 'FeedPet', foodId: 'egg' });
    expect(r.outcome.ok).toBe(true);
    expect(t.game.getPet().state.hunger).toBeGreaterThanOrEqual(5500);
    expect(t.game.world.foodInBowl).toBe(true);
    const seen = new Set<string>();
    t.run(2000, () => {
      const d = t.game.brain.current();
      if (d) seen.add(d.behavior);
    });
    expect(seen.has('eat')).toBe(true);
    expect(t.game.world.foodInBowl).toBe(false); // eaten
    expect(t.changes()).toBeGreaterThan(0);
  });

  it('watering works the same way with the water bowl', () => {
    const t = setup(hungry());
    t.run(5);
    t.game.dispatch({ type: 'GiveWater' });
    expect(t.game.world.waterInBowl).toBe(true);
    const seen = new Set<string>();
    t.run(2000, () => seen.add(t.game.brain.current()?.behavior ?? ''));
    expect(seen.has('drink')).toBe(true);
    expect(t.game.world.waterInBowl).toBe(false);
  });

  it('feeding and watering back to back both happen, one after the other', () => {
    const t = setup(hungry());
    t.run(5);
    t.game.dispatch({ type: 'GiveWater' });
    t.game.dispatch({ type: 'FeedPet', foodId: 'egg' });
    const seen: string[] = [];
    t.run(4000, () => {
      const b = t.game.brain.current()?.behavior ?? '';
      if (seen.at(-1) !== b) seen.push(b);
    });
    expect(seen).toContain('drink');
    expect(seen).toContain('eat');
    expect(t.game.world.foodInBowl).toBe(false);
    expect(t.game.world.waterInBowl).toBe(false);
  });

  it('a refused feed leaves the bowl empty and makes the pet look annoyed', () => {
    const t = setup(makePet({ id: 'full', state: { hunger: 9500 } }));
    t.run(5);
    const r = t.game.dispatch({ type: 'FeedPet', foodId: 'egg' });
    expect(r.outcome).toMatchObject({ ok: false, reason: 'not_hungry' });
    expect(t.game.world.foodInBowl).toBe(false);
    t.run(3);
    expect(t.reactions).toContain('annoyed');
  });

  it('a favorite food makes the pet happy', () => {
    const p = hungry();
    const t = setup(p);
    t.run(5);
    t.game.dispatch({ type: 'FeedPet', foodId: p.state.favoriteFood });
    t.run(3);
    expect(t.reactions).toContain('happy');
  });
});

describe('bed', () => {
  it('sends the pet to the hammock, and feeding wakes it and sends it to the bowl', () => {
    const t = setup(makePet({ id: 'bed', state: { hunger: 3000, energy: 4000 } }));
    t.run(5);
    t.game.dispatch({ type: 'PutToBed' });
    t.run(1500);
    expect(t.game.brain.current()?.behavior).toBe('sleep');
    expect(t.scene.y).toBe(ROOM.hammockRestY);
    const r = t.game.dispatch({ type: 'FeedPet', foodId: 'egg' });
    expect(r.outcome).toMatchObject({ ok: true, woke: true });
    const seen = new Set<string>();
    t.run(2500, () => seen.add(t.game.brain.current()?.behavior ?? ''));
    expect(seen.has('eat')).toBe(true);
    expect(t.scene.y).toBe(ROOM.groundY);
  });
});

describe('touching the pet', () => {
  it('a quick tap on the pet is a reaction only; a long press is a session that raises bond', () => {
    const t = setup(hungry());
    t.run(5);
    const bond = t.game.getPet().state.bond;
    t.game.pointerDown(t.scene.x, t.scene.y - 30, 1000);
    t.game.pointerUp(1100);
    expect(t.game.getPet().state.bond).toBe(bond);
    t.run(3);
    expect(t.reactions).toContain('happy');

    t.game.pointerDown(t.scene.x, t.scene.y - 30, 5000);
    t.game.pointerUp(5000 + 2100);
    expect(t.game.getPet().state.bond).toBe(bond + 100);
  });

  it('three quick taps make a session', () => {
    const t = setup(hungry());
    t.run(5);
    const bond = t.game.getPet().state.bond;
    for (const at of [1000, 2000, 3000]) {
      t.game.pointerDown(t.scene.x, t.scene.y - 30, at);
      t.game.pointerUp(at + 60);
    }
    expect(t.game.getPet().state.bond).toBe(bond + 100);
  });

  it('a touch away from the pet does nothing', () => {
    const t = setup(hungry());
    t.run(5);
    const before = t.game.getPet();
    t.game.pointerDown(t.scene.x + 200, t.scene.y - 30, 1000);
    t.game.pointerUp(3500);
    t.game.pointerDown(t.scene.x, 20, 4000); // far above
    t.game.pointerUp(6500);
    expect(t.game.getPet().state.bond).toBe(before.state.bond);
  });

  it('touching a sleeping pet wakes it', () => {
    const t = setup(makePet({ id: 'zzz', state: { energy: 4000 } }));
    t.run(5);
    t.game.dispatch({ type: 'PutToBed' });
    t.run(1500);
    t.game.pointerDown(t.scene.x, t.scene.y - 20, 9000);
    t.game.pointerUp(9080);
    expect(t.game.getPet().state.sleepState).toBe('awake');
  });
});

describe('the toy-chase mini-game', () => {
  it('starts, pauses the brain, ends after 20 seconds, and applies FinishPlay with a band', () => {
    const t = setup(makePet({ id: 'play', state: { energy: 9000, happiness: 5000, bond: 1000 } }));
    t.run(5);
    const start = t.game.startPlay('ball');
    expect(start.outcome.ok).toBe(true);
    expect(t.game.minigame()).toMatchObject({ toyId: 'ball', catches: 0 });
    expect(t.game.getPet().state.playStartedAt).not.toBeNull();

    // Drag the toy away and hold it, every 2 seconds, like a good player.
    let x = 200;
    let frames = 0;
    while (t.game.minigame() && frames < 2000) {
      const phase = Math.floor((frames * 16) / 2000) % 2;
      const target = phase === 0 ? 150 : 260;
      x += Math.max(-8, Math.min(8, target - x)); // slide up to 8 px per frame, then hold
      t.game.pointerMove(x, ROOM.groundY);
      t.run(1);
      frames++;
    }
    expect(t.game.minigame()).toBeNull();
    expect(frames * 16).toBeGreaterThanOrEqual(CHASE.durationMs);
    expect(t.plays).toHaveLength(1);
    const played = t.plays[0] as PlayResult;
    expect(played.catches).toBeGreaterThanOrEqual(5);
    expect(played.band).toBeGreaterThanOrEqual(2);
    const p = t.game.getPet();
    expect(p.state.playStartedAt).toBeNull();
    expect(p.state.energy).toBeLessThan(8000); // 1500 spent
    expect(p.state.happiness).toBeGreaterThan(5000);
    expect(p.state.bond).toBeGreaterThan(1000);
    expect(p.history.some((e) => e.type === 'PET_PLAYED')).toBe(true);
    expect(t.reactions).toContain('happy'); // pounces
  });

  it('a tired pet refuses to play, and no game starts', () => {
    const t = setup(makePet({ id: 'tired', state: { energy: 1500 } }));
    t.run(5);
    const r = t.game.startPlay('ball');
    expect(r.outcome).toMatchObject({ ok: false, reason: 'too_tired' });
    expect(t.game.minigame()).toBeNull();
    t.run(3);
    expect(t.reactions).toContain('annoyed');
  });

  it('the brain does not move the pet during the game, and resumes afterwards', () => {
    const t = setup(makePet({ id: 'pause', state: { energy: 9000 } }));
    t.run(5);
    t.game.startPlay('feather');
    t.run(1);
    for (let i = 0; i < 200; i++) {
      t.game.pointerMove(200, ROOM.groundY);
      t.run(1);
    }
    expect(t.game.brain.current()).not.toBeNull();
    while (t.game.minigame()) {
      t.game.pointerMove(200, ROOM.groundY);
      t.run(1);
    }
    t.run(30);
    expect(t.game.brain.current()?.behavior).toBeDefined();
    expect(t.scene.y).toBe(ROOM.groundY);
  });

  it('a second game right away is played but gives no reward, and the energy is still spent', () => {
    const t = setup(makePet({ id: 'twice', state: { energy: 10000 } }));
    t.run(5);
    const finish = (): void => {
      t.game.startPlay('ball');
      while (t.game.minigame()) {
        t.game.pointerMove(200, ROOM.groundY);
        t.run(1);
      }
    };
    finish();
    const energyAfterFirst = t.game.getPet().state.energy;
    finish();
    expect(t.plays).toHaveLength(2);
    expect((t.plays[1] as PlayResult).result.outcome).toMatchObject({ ok: true, rewarded: false });
    expect(t.game.getPet().state.energy).toBeLessThan(energyAfterFirst);
  });

  it('keeps needs and clock sane while playing for hours of game time', () => {
    const t = setup(makePet({ id: 'hours', state: { energy: 9000 } }));
    t.run(5);
    t.clock.advance(3 * HOUR);
    t.game.startPlay('ball');
    expect(t.game.getPet().timestamps.lastSimulationTime).toBeGreaterThan(T0);
  });
});

describe('touching the room', () => {
  const awake = () => makePet({ id: 'room', state: { hunger: 8000, hydration: 8000, energy: 9000, happiness: 6000, bond: 1000 } });
  const FAR = 0; // a y far above the pet, so the touch is not on the pet
  const floorHit = (x: number, z: number) => ({ floor: { x, z }, target: null });

  it('a tap on the floor calls the pet there, shows a marker, and counts as a call', () => {
    const touches: RoomTouch[] = [];
    const t = setup(awake(), { onRoomTouch: (k) => touches.push(k) });
    t.run(5);
    t.game.pointerDown(100, FAR, 1000, floorHit(250, 60));
    t.game.pointerUp(1050, floorHit(250, 60));
    expect(touches).toEqual(['call']);
    t.run(2);
    expect(t.game.props().marker).not.toBeNull();
    let closest = Infinity;
    t.run(400, () => {
      closest = Math.min(closest, Math.hypot(t.scene.x - 250, t.scene.z - 60));
    });
    expect(closest).toBeLessThan(3); // it arrived, then went on with its day
    expect(t.game.props().marker).toBeNull(); // faded
  });

  it('a tap that lands outside the roaming area is brought inside it', () => {
    const t = setup(awake());
    t.run(5);
    t.game.pointerDown(100, FAR, 1000, floorHit(5, 500));
    t.game.pointerUp(1050, floorHit(5, 500));
    t.run(600);
    expect(t.scene.x).toBeGreaterThanOrEqual(ROOM.minX - 1);
    expect(t.scene.z).toBeLessThanOrEqual(ROOM.maxZ + 1);
  });

  it('a tap on the ball throws it, and the pet fetches it and brings it to the player', () => {
    const touches: RoomTouch[] = [];
    const t = setup(awake(), { onRoomTouch: (k) => touches.push(k) });
    t.run(5);
    const start = { x: t.game.brain.ball.x, z: t.game.brain.ball.z };
    t.game.pointerDown(start.x, FAR, 1000, { floor: start, target: 'ball' });
    t.game.pointerUp(1040, { floor: start, target: 'ball' });
    expect(touches).toEqual(['fetch']);
    expect(t.game.props().ball.flight).not.toBeNull();
    expect(Math.hypot(t.game.brain.ball.x - start.x, t.game.brain.ball.z - start.z)).toBeGreaterThan(5);
    let carried = false;
    t.run(900, () => {
      if (t.game.brain.ball.carried) carried = true;
    });
    expect(carried).toBe(true);
    expect(t.game.brain.ball.carried).toBe(false);
    expect(Math.hypot(t.game.brain.ball.x - ROOM.fetchDropX, t.game.brain.ball.z - ROOM.fetchDropZ)).toBeLessThan(4);
  });

  it('dragging the ball moves it and does not throw it', () => {
    const touches: RoomTouch[] = [];
    const t = setup(awake(), { onRoomTouch: (k) => touches.push(k) });
    t.run(5);
    const start = { x: t.game.brain.ball.x, z: t.game.brain.ball.z };
    t.game.pointerDown(start.x, FAR, 1000, { floor: start, target: 'ball' });
    t.game.pointerMove(150, FAR, { floor: { x: 150, z: -20 }, target: null });
    t.game.pointerUp(1300, { floor: { x: 150, z: -20 }, target: null });
    expect(t.game.brain.ball.x).toBe(150);
    expect(t.game.brain.ball.z).toBe(-20);
    expect(touches).toEqual([]);
  });

  it('a tap on a bowl or the hammock is passed on as a button press', () => {
    const targets: string[] = [];
    const t = setup(awake(), { onTarget: (x) => targets.push(x) });
    t.run(5);
    for (const target of ['foodBowl', 'waterBowl', 'hammock'] as const) {
      t.game.pointerDown(100, FAR, 1000, { floor: null, target });
      t.game.pointerUp(1040, { floor: null, target });
    }
    expect(targets).toEqual(['foodBowl', 'waterBowl', 'hammock']);
  });

  it('a tap on the window sends the pet to look out of it', () => {
    const t = setup(awake());
    t.run(5);
    t.game.pointerDown(100, FAR, 1000, { floor: null, target: 'window' });
    t.game.pointerUp(1040, { floor: null, target: 'window' });
    let closest = Infinity;
    let lookedOut = false;
    t.run(600, () => {
      closest = Math.min(closest, Math.abs(t.scene.x - ROOM.windowX));
      if (t.bases[t.bases.length - 1] === 'curious' && closest < 3) lookedOut = true;
    });
    expect(closest).toBeLessThan(3);
    expect(lookedOut).toBe(true);
  });

  it('a sleeping pet is not called', () => {
    const touches: RoomTouch[] = [];
    const t = setup(makePet({ id: 'zzz2', state: { energy: 4000 } }), { onRoomTouch: (k) => touches.push(k) });
    t.run(5);
    t.game.dispatch({ type: 'PutToBed' });
    t.run(1500);
    t.game.pointerDown(100, FAR, 9000, floorHit(250, 60));
    t.game.pointerUp(9040, floorHit(250, 60));
    expect(touches).toEqual([]);
    expect(t.game.getPet().state.sleepState).toBe('asleep');
  });

  it('touches in the room are ignored during the mini-game', () => {
    const touches: RoomTouch[] = [];
    const t = setup(awake(), { onRoomTouch: (k) => touches.push(k) });
    t.run(5);
    expect(t.game.startPlay('ball').outcome.ok).toBe(true);
    t.game.pointerDown(100, FAR, 1000, floorHit(250, 60));
    t.game.pointerUp(1040, floorHit(250, 60));
    expect(touches).toEqual([]);
  });
});
