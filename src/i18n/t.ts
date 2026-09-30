// A tiny translation helper (guide §3): keys, `{name}` parameters, no library. English now,
// Hindi joins in Phase 2 by adding hi.json and a language setting. No text lives in the
// canvas or in images, so every visible word goes through t() (guide §9.1, §17).

import en from './en.json';

export type TextKey = keyof typeof en;
export type Params = Record<string, string | number>;

const dictionaries: Record<string, Record<string, string>> = { en };
let current = 'en';

export function setLanguage(language: string): void {
  if (dictionaries[language]) current = language;
}

/** Replace `{param}` in a template. A missing parameter is left visible so the bug is easy to spot. */
export function format(template: string, params: Params = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

export function t(key: TextKey, params?: Params): string {
  const template = dictionaries[current]?.[key] ?? dictionaries['en']?.[key];
  return template === undefined ? key : format(template, params);
}

/** For keys built at run time, such as `food.${id}`. Falls back to the raw key, never throws. */
export function tDynamic(key: string, params?: Params): string {
  return t(key as TextKey, params);
}
