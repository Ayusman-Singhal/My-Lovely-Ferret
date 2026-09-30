// Pet and player name rules (docs/GAME_DESIGN.md §9, guide §7.8, §25.9): 1 to 16 grapheme
// clusters, no leading or trailing whitespace, no control characters. Clusters, not bytes,
// so Devanagari and emoji count as the player sees them.

export const NAME_MAX_CLUSTERS = 16;

export type NameProblem = 'empty' | 'too_long' | 'edge_space' | 'control_chars';
export type NameCheck = { ok: true } | { ok: false; reason: NameProblem };

export function countClusters(text: string): number {
  if (typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)).length;
  }
  // Older engines: code points is the best available approximation.
  return Array.from(text).length;
}

export function validateName(name: string): NameCheck {
  if (name.length === 0) return { ok: false, reason: 'empty' };
  if (name !== name.trim()) return { ok: false, reason: 'edge_space' };
  if (/\p{Cc}/u.test(name)) return { ok: false, reason: 'control_chars' };
  if (countClusters(name) > NAME_MAX_CLUSTERS) return { ok: false, reason: 'too_long' };
  return { ok: true };
}
