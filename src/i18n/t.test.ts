import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from './en.json';
import { format, setLanguage, t, tDynamic } from './t';

const keys = Object.keys(en);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

const files = [...sourceFiles('src/ui'), ...sourceFiles('src/game')];
const source = files.map((f) => readFileSync(f, 'utf8')).join('\n');
const namespaces = new Set(keys.map((k) => k.split('.')[0]));

describe('format and t', () => {
  it('fills {params}, leaves unknown ones visible, and handles repeats', () => {
    expect(format('Hi {name}, {name}!', { name: 'Mochi' })).toBe('Hi Mochi, Mochi!');
    expect(format('{a} and {b}', { a: 1 })).toBe('1 and {b}');
    expect(format('no params')).toBe('no params');
  });

  it('translates keys, falls back to the key for unknown ones, and keeps English when a language is missing', () => {
    expect(t('action.feed')).toBe('Feed');
    expect(t('welcome.stole', { name: 'Mochi', item: 'sock' })).toBe('Mochi stole a sock.');
    expect(tDynamic('no.such.key')).toBe('no.such.key');
    setLanguage('xx'); // unknown: ignored
    expect(t('action.feed')).toBe('Feed');
  });
});

describe('en.json', () => {
  it('has no empty strings, and every {param} is a simple word', () => {
    for (const [k, v] of Object.entries(en)) {
      expect(v.length, k).toBeGreaterThan(0);
      for (const m of v.matchAll(/\{([^}]*)\}/g)) expect(m[1], k).toMatch(/^\w+$/);
    }
  });

  it('is used: every static key mentioned in the UI and game code exists', () => {
    const literal = /['"`]((?:[a-z]+)\.[A-Za-z0-9_.]+)['"`]/g;
    const missing: string[] = [];
    for (const m of source.matchAll(literal)) {
      const key = m[1] as string;
      if (!namespaces.has(key.split('.')[0])) continue; // not a text key (an import path, a property, ...)
      if (!(key in en)) missing.push(key);
    }
    expect(missing).toEqual([]);
  });

  it('every dynamic key prefix has at least one matching key', () => {
    const dynamic = /`((?:[a-z]+)\.[A-Za-z0-9_.]*)\$\{/g;
    for (const m of source.matchAll(dynamic)) {
      const prefix = m[1] as string;
      if (!namespaces.has(prefix.split('.')[0])) continue;
      expect(keys.some((k) => k.startsWith(prefix)), prefix).toBe(true);
    }
  });

  it('has a name for every food, toy, item, mood, and refusal the game can produce', () => {
    for (const food of ['chicken', 'egg', 'salmon', 'kibble']) expect(en).toHaveProperty(`food.${food}`);
    for (const toy of ['ball', 'sock', 'feather', 'ring']) expect(en).toHaveProperty(`toy.${toy}`);
    for (const item of ['sock', 'ball', 'feather', 'ring', 'button', 'bottle_cap', 'hair_tie', 'paper_scrap', 'foil_ball', 'single_earring']) {
      expect(en).toHaveProperty(`item.${item}`);
    }
    for (const mood of ['needy', 'sleepy', 'playful', 'happy', 'content']) expect(en).toHaveProperty(`welcome.mood.${mood}`);
    for (const r of ['invalid', 'not_hungry', 'not_thirsty', 'too_tired', 'not_sleepy', 'no_play_started']) expect(en).toHaveProperty(`refuse.${r}`);
    for (const r of ['not_json', 'wrong_format', 'bad_checksum', 'too_new', 'migration_failed', 'invalid']) expect(en).toHaveProperty(`import.error.${r}`);
    for (const r of ['empty', 'too_long', 'edge_space', 'control_chars']) expect(en).toHaveProperty(`name.error.${r}`);
    for (const l of ['low', 'ok', 'good']) expect(en).toHaveProperty(`hud.level.${l}`);
    for (const b of [0, 1, 2, 3]) expect(en).toHaveProperty(`play.band.${b}`);
    for (const h of ['feed', 'water', 'play', 'sleep', 'pet']) expect(en).toHaveProperty(`hint.${h}`);
    for (const l of ['asleep', 'awake', 'hungry', 'thirsty']) expect(en).toHaveProperty(`live.${l}`);
  });
});
