import { describe, expect, it } from 'vitest';
import { ANIMATIONS, ANIMATION_NAMES } from './animations';
import { COAT_COLORS, shade } from './coats';
import { drawFerret, type Ctx } from './ferretDraw';

/** A fake 2D context that records calls and checks save/restore balance. */
function recordingContext() {
  const calls: string[] = [];
  const depth = { current: 0, max: 0, negative: false };
  const props: Record<string, unknown> = {};
  const ctx = new Proxy(props, {
    get(target, key: string) {
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        calls.push(key);
        if (key === 'save') depth.max = Math.max(depth.max, ++depth.current);
        if (key === 'restore' && --depth.current < 0) depth.negative = true;
        for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) throw new Error(`non-finite argument to ${key}`);
        return undefined;
      };
    },
    set(target, key: string, value: unknown) {
      target[key] = value;
      return true;
    },
  }) as unknown as Ctx;
  return { ctx, calls, depth };
}

describe('drawFerret', () => {
  for (const name of ANIMATION_NAMES) {
    it(`draws ${name} without errors, with balanced save and restore and finite numbers`, () => {
      const def = ANIMATIONS[name];
      for (const t of [0, def.durationMs * 0.3, def.durationMs * 0.9]) {
        const { ctx, calls, depth } = recordingContext();
        drawFerret(ctx, def.sample(t), COAT_COLORS.sable, { x: 100, y: 500, facing: 1, scale: 1.3 });
        expect(depth.current).toBe(0);
        expect(depth.negative).toBe(false);
        expect(calls.filter((c) => c === 'fill').length).toBeGreaterThan(10);
      }
    });
  }

  it('flips for facing left', () => {
    const scales: number[][] = [];
    for (const facing of [1, -1] as const) {
      const props: Record<string, unknown> = {};
      const ctx = new Proxy(props, {
        get: (t, key: string) => (key in t ? t[key] : key === 'scale' ? (x: number, y: number) => scales.push([x, y]) : () => undefined),
        set: (t, key: string, v: unknown) => ((t[key] = v), true),
      }) as unknown as Ctx;
      drawFerret(ctx, ANIMATIONS.idle.sample(0), COAT_COLORS.panda, { x: 0, y: 0, facing, scale: 2 });
    }
    expect(scales[0]).toEqual([2, 2]);
    expect(scales[scales.length > 2 ? scales.findIndex((s) => s[0] === -2) : 1]).toEqual([-2, 2]);
  });

  it('draws every coat', () => {
    for (const coat of Object.values(COAT_COLORS)) {
      const { ctx, depth } = recordingContext();
      drawFerret(ctx, ANIMATIONS.sleep.sample(500), coat, { x: 10, y: 10, facing: -1, scale: 1 });
      expect(depth.current).toBe(0);
    }
  });
});

describe('coats', () => {
  it('has the four coats from the design, with albino having no mask', () => {
    expect(Object.keys(COAT_COLORS).sort()).toEqual(['albino', 'cinnamon', 'panda', 'sable']);
    expect(COAT_COLORS.albino.mask).toBe(false);
    expect(COAT_COLORS.sable.mask && COAT_COLORS.cinnamon.mask && COAT_COLORS.panda.mask).toBe(true);
  });

  it('shade darkens each channel and keeps black and factor 1 stable', () => {
    expect(shade(0x000000, 0.5)).toBe(0x000000);
    expect(shade(0xf0a060, 1)).toBe(0xf0a060);
    expect(shade(0xf0a060, 0.5)).toBe(0x785030);
  });
});
