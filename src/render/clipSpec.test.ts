import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ANIMATION_NAMES, BONES, CLIPS, CLIP_FPS, frameIntervalMs, playbackRate } from './clipSpec';

/** Reads the JSON chunk of a .glb file: the model the game really loads. */
function readGlb(path: string): { nodes: Array<{ name?: string }>; animations: Array<{ name: string; samplers: Array<{ input: number }> }>; accessors: Array<{ max?: number[]; min?: number[]; count: number }>; images?: unknown[]; materials?: unknown[]; meshes: Array<{ primitives: Array<{ indices?: number }> }> } {
  const bytes = readFileSync(path);
  const jsonLength = bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
}

const glb = readGlb('animation/export/ferret.glb');

describe('the ferret model against animation/clips.json', () => {
  it('has every clip the game can ask for, and nothing the game does not know', () => {
    expect(glb.animations.map((a) => a.name).sort()).toEqual([...ANIMATION_NAMES].sort());
  });

  it('has every bone the game looks up by name', () => {
    const names = new Set(glb.nodes.map((n) => n.name));
    for (const bone of BONES) expect(names.has(bone), `bone ${bone}`).toBe(true);
  });

  it('has clips as long as clips.json says, at the agreed frame rate', () => {
    for (const clip of glb.animations) {
      const end = Math.max(...clip.samplers.map((s) => glb.accessors[s.input]?.max?.[0] ?? 0));
      const expected = CLIPS[clip.name as keyof typeof CLIPS].frames / CLIP_FPS;
      expect(end, clip.name).toBeCloseTo(expected, 2);
    }
  });

  it('stays within the model limits of animation/RIG_SPEC.md: one material, one texture, few triangles', () => {
    const triangles = glb.meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce((s, p) => s + (glb.accessors[p.indices ?? -1]?.count ?? 0) / 3, 0), 0);
    expect(triangles).toBeGreaterThan(100);
    expect(triangles).toBeLessThanOrEqual(5000);
    expect(glb.materials?.length).toBe(1);
    expect(glb.images?.length).toBe(1);
  });
});

describe('playbackRate', () => {
  it('plays clips without a ground speed at normal speed', () => {
    expect(playbackRate('idle', 0.4)).toBe(1);
    expect(playbackRate('eat', 0)).toBe(1);
    expect(playbackRate('happy', 1)).toBe(1);
  });

  it('matches the paws to the ground speed for walk, sneak, and run', () => {
    expect(playbackRate('walk', 0.1875)).toBeCloseTo(1, 5);
    expect(playbackRate('walk', 0.1875 * 1.5)).toBeCloseTo(1.5, 5);
    expect(playbackRate('run', 0.3)).toBeCloseTo(0.5, 5);
    expect(playbackRate('sneak', 0.105)).toBeCloseTo(1, 5);
  });

  it('never freezes or blurs the legs', () => {
    expect(playbackRate('walk', 0)).toBe(1);
    expect(playbackRate('walk', 0.001)).toBe(1);
    expect(playbackRate('walk', 0.02)).toBe(0.5);
    expect(playbackRate('walk', 5)).toBe(2.2);
  });

  it('agrees with the game speeds: game walk, run, and sneak (px/s) stay near their clips', () => {
    const MPS = 0.0032; // metres per logical px (stageMap.ts)
    expect(playbackRate('walk', 55 * MPS)).toBeGreaterThan(0.85);
    expect(playbackRate('walk', 55 * MPS)).toBeLessThan(1.1);
    expect(playbackRate('run', 170 * MPS)).toBeGreaterThan(0.8);
    expect(playbackRate('sneak', 45 * MPS)).toBeLessThan(1.5);
  });
});

describe('frameIntervalMs', () => {
  it('draws a sleeping pet less often and everything else every frame', () => {
    expect(frameIntervalMs('sleep')).toBe(100);
    expect(frameIntervalMs('walk')).toBe(0);
  });
});
