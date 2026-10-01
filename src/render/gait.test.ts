import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AnimationMixer, Vector3, type Mesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CLIPS, CLIP_FPS, type AnimationName } from './clipSpec';

// Foot-slide check on the real exported model. A walk, sneak, or run clip is made "in place": the
// root stays put and a planted paw moves backward at exactly the ground speed written in
// animation/clips.json. If it does not, the paws slide on the floor (or skate) whenever the game
// plays the clip at the pace the pet moves (clipSpec.ts playbackRate). The textures are stripped
// from the file here, because node cannot decode images and the check needs only the skeleton.

function loadWithoutTextures(path: string): Promise<{ scene: Object3D; animations: Array<import('three').AnimationClip> }> {
  const bytes = readFileSync(path);
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  const binStart = 20 + jsonLength;
  const bin = bytes.subarray(binStart + 8, binStart + 8 + bytes.readUInt32LE(binStart));
  delete json.images;
  delete json.textures;
  delete json.samplers;
  for (const m of json.materials ?? []) delete m.pbrMetallicRoughness?.baseColorTexture;
  let text = JSON.stringify(json);
  while (Buffer.byteLength(text) % 4 !== 0) text += ' ';
  const jsonBuf = Buffer.from(text);
  const out = Buffer.alloc(12 + 8 + jsonBuf.length + 8 + bin.length);
  out.write('glTF', 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(jsonBuf.length, 12);
  out.write('JSON', 16);
  jsonBuf.copy(out, 20);
  out.writeUInt32LE(bin.length, 20 + jsonBuf.length);
  out.write('BIN\0', 24 + jsonBuf.length, 'binary');
  bin.copy(out, 28 + jsonBuf.length);
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(out.buffer.slice(out.byteOffset, out.byteOffset + out.length), '', (gltf) => resolve(gltf), reject);
  });
}

const gltf = await loadWithoutTextures('animation/export/ferret.glb');

/**
 * The centre of the bottom face of a paw box (found in the rest pose, in the box's own space), at
 * each frame of a clip, as {height above the floor, distance forward}. This is the point the paw
 * stands on, and it follows the box as it tilts. (The lowest corner jumps between heel and toe, and
 * the box centre moves differently from where it touches, so neither says whether a foot skates.)
 */
function footPoint(clipName: AnimationName, side: 'FL' | 'FR' | 'BL' | 'BR'): Array<{ y: number; z: number }> {
  const clip = gltf.animations.find((a) => a.name === clipName);
  if (!clip) throw new Error(`no clip ${clipName}`);
  const paw = gltf.scene.getObjectByName(`m_paw${side}`) as Mesh;
  const position = paw.geometry.getAttribute('position');
  // Rest pose: no animation applied yet.
  gltf.scene.updateMatrixWorld(true);
  const points: Vector3[] = [];
  for (let i = 0; i < position.count; i++) points.push(new Vector3().fromBufferAttribute(position, i));
  const lowestY = Math.min(...points.map((p) => p.clone().applyMatrix4(paw.matrixWorld).y));
  const bottom = points.filter((p) => p.clone().applyMatrix4(paw.matrixWorld).y < lowestY + 0.004);
  const local = bottom.reduce((sum, p) => sum.add(p), new Vector3()).multiplyScalar(1 / bottom.length);

  const mixer = new AnimationMixer(gltf.scene);
  mixer.clipAction(clip).play();
  const frames = CLIPS[clipName].frames;
  const out: Array<{ y: number; z: number }> = [];
  for (let f = 0; f <= frames; f++) {
    mixer.setTime(f / CLIP_FPS);
    gltf.scene.updateMatrixWorld(true);
    const world = local.clone().applyMatrix4(paw.matrixWorld);
    out.push({ y: world.y, z: world.z });
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(gltf.scene);
  return out;
}

describe.each(['walk', 'sneak', 'run'] as const)('%s clip foot planting', (name) => {
  const spec = CLIPS[name];
  const ground = spec.ground_speed_mps as number;

  it.each(['FL', 'FR', 'BL', 'BR'] as const)('the %s paw, while it touches the floor, moves back at the ground speed', (side) => {
    const samples = footPoint(name, side);
    // Frame pairs where the paw is down at both ends (within the 5 mm that the clips allow to sink).
    const speeds: number[] = [];
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i] as { y: number; z: number };
      const b = samples[i + 1] as { y: number; z: number };
      if (a.y < 0.012 && b.y < 0.012) speeds.push(-(b.z - a.z) * CLIP_FPS);
    }
    // A gallop has long flights; a paw may touch for only a frame or two, which says nothing about sliding.
    if (name === 'run' && speeds.length < 2) return;
    expect(speeds.length, `${name} ${side} has frames on the floor`).toBeGreaterThan(1);
    const mean = speeds.reduce((s, v) => s + v, 0) / speeds.length;
    // Within 25 percent of the ground speed: the paws are blocky and the clips are hand-tuned.
    expect(mean / ground, `${name} ${side}: paw speed ${mean.toFixed(3)} against ground ${ground}`).toBeGreaterThan(0.75);
    expect(mean / ground).toBeLessThan(1.25);
  });
});
