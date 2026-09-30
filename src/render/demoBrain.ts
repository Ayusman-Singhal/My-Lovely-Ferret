// TEMPORARY (removed in Part 1E): a fixed, looping script that shows every animation so the
// preview page has a living ferret before PetAI exists. It is not the pet's real behavior.

import type { AnimationName } from './animations';
import { ROOM } from './room';
import type { Scene } from './scene';

type Step =
  | { kind: 'do'; anim: AnimationName; ms: number; react?: AnimationName; face?: 1 | -1; y?: number }
  | { kind: 'go'; anim: AnimationName; x: number; speed: number; face?: 1 | -1 };

// Feet positions are chosen so the nose reaches the bowl (the nose is about 105 px ahead of the feet
// with the head down) and so the whole pet, tail included, stays inside the 360 px room.
const SCRIPT: Step[] = [
  { kind: 'do', anim: 'idle', ms: 3000 },
  { kind: 'go', anim: 'walk', x: 180, speed: 55 },
  { kind: 'do', anim: 'sniff', ms: 2200 },
  { kind: 'do', anim: 'curious', ms: 2500 },
  { kind: 'go', anim: 'walk', x: ROOM.foodBowlX + 105, speed: 55, face: -1 },
  { kind: 'do', anim: 'eat', ms: 3500, react: 'happy', face: -1 },
  { kind: 'go', anim: 'walk', x: ROOM.waterBowlX - 105, speed: 55, face: 1 },
  { kind: 'do', anim: 'drink', ms: 3000, face: 1 },
  { kind: 'go', anim: 'run', x: 215, speed: 170 },
  { kind: 'go', anim: 'run', x: 145, speed: 170 },
  { kind: 'do', anim: 'idle', ms: 1200, react: 'surprise', face: 1 },
  { kind: 'go', anim: 'sneak', x: ROOM.hammockX, speed: 45 },
  { kind: 'do', anim: 'sleep', ms: 8000, y: ROOM.hammockRestY, face: 1 },
  { kind: 'do', anim: 'idle', ms: 1500, react: 'annoyed' },
];

export function createDemoBrain(): (nowMs: number, scene: Scene) => void {
  let index = -1;
  let stepStart = 0;
  let lastFrame = 0;

  const begin = (scene: Scene, nowMs: number): void => {
    index = (index + 1) % SCRIPT.length;
    stepStart = nowMs;
    const step = SCRIPT[index] as Step;
    scene.animator.setBase(step.anim, nowMs);
    scene.y = step.kind === 'do' && step.y !== undefined ? step.y : ROOM.groundY;
    if (step.kind === 'do' && step.react) scene.animator.react(step.react, nowMs);
    if (step.face) scene.facing = step.face;
    else if (step.kind === 'go') scene.facing = step.x >= scene.x ? 1 : -1;
  };

  return (nowMs, scene) => {
    const dt = lastFrame === 0 ? 0 : Math.min(100, nowMs - lastFrame);
    lastFrame = nowMs;
    if (index < 0) begin(scene, nowMs);
    const step = SCRIPT[index] as Step;
    if (step.kind === 'do') {
      if (nowMs - stepStart >= step.ms) begin(scene, nowMs);
    } else {
      const dir = step.x >= scene.x ? 1 : -1;
      scene.x += dir * step.speed * (dt / 1000);
      if ((dir === 1 && scene.x >= step.x) || (dir === -1 && scene.x <= step.x)) {
        scene.x = step.x;
        begin(scene, nowMs);
      }
    }
  };
}
