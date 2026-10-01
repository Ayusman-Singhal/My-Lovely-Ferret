// The one-tap feedback (guide §25.3): a short text with the tester's own words and their local
// counters, sent only if they choose, by email or copied. No account, no tracking. Pure, so the
// text and the mailto link are tested.

import type { AboutPet } from './aboutPet';

export interface FeedbackEnv {
  /** Build id, so the developer knows which version the feedback is about. */
  version: string;
  userAgent: string;
  language: string;
  /** Current time as an ISO string, passed in so the text is reproducible in tests. */
  nowIso: string;
}

const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export function buildFeedbackText(message: string, about: AboutPet, env: FeedbackEnv): string {
  const counts = about.counts.map((c) => `${c.key} ${c.count}`).join(', ');
  return [
    message.trim() || '(no message)',
    '',
    '---',
    `Pet: ${about.name}, coat ${about.coat}, day ${about.dayNumber}, bond ${about.bond}`,
    `Sessions: ${about.sessions}, first opened ${iso(about.firstOpen)}, last opened ${iso(about.lastOpen)}`,
    `Things done: ${counts}`,
    `Version: ${env.version}`,
    `Browser: ${env.userAgent}`,
    `Language: ${env.language}`,
    `Sent: ${env.nowIso}`,
  ].join('\n');
}

/** A mailto link. Very long bodies are cut so mail apps do not refuse the link. */
export function mailtoUrl(address: string, subject: string, body: string): string {
  const max = 1800;
  const cut = body.length > max ? `${body.slice(0, max)}\n(cut)` : body;
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(cut)}`;
}
