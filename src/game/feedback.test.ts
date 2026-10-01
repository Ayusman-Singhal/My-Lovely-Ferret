import { describe, expect, it } from 'vitest';
import { DAY, T0, makePet } from '../core/testkit';
import { buildAboutPet } from './aboutPet';
import { buildFeedbackText, mailtoUrl } from './feedback';

const about = buildAboutPet(makePet(), { sessions: 3, firstOpenDate: T0, lastOpenDate: T0 + DAY, interactionCounts: { feed: 2 } }, T0 + DAY);
const env = { version: 'abc1234', userAgent: 'TestBrowser/1', language: 'en-GB', nowIso: '2026-10-02T09:00:00.000Z' };

describe('buildFeedbackText', () => {
  it('puts the tester words first, then the counters and the version', () => {
    const text = buildFeedbackText('  It is so cute!  ', about, env);
    expect(text.startsWith('It is so cute!\n')).toBe(true);
    expect(text).toContain('Sessions: 3, first opened 2026-10-01, last opened 2026-10-02');
    expect(text).toContain('Things done: feed 2, water 0, play 0, sleep 0, pet 0');
    expect(text).toContain('Version: abc1234');
    expect(text).toContain('day 2');
  });

  it('says so when the tester wrote nothing', () => {
    expect(buildFeedbackText('   ', about, env).startsWith('(no message)')).toBe(true);
  });

  it('carries no install id, no save contents, and no pet id', () => {
    const text = buildFeedbackText('hi', about, env);
    expect(text).not.toContain('install');
    expect(text).not.toContain('pet-test-1');
  });
});

describe('mailtoUrl', () => {
  it('encodes the subject and body', () => {
    const url = mailtoUrl('a@b.test', 'Ferret feedback', 'line 1\nline 2 & more');
    expect(url.startsWith('mailto:a@b.test?subject=Ferret%20feedback&body=')).toBe(true);
    expect(url).toContain('line%201%0Aline%202%20%26%20more');
  });

  it('cuts a very long body', () => {
    const url = mailtoUrl('a@b.test', 's', 'x'.repeat(5000));
    expect(decodeURIComponent(url).length).toBeLessThan(2000);
    expect(decodeURIComponent(url)).toContain('(cut)');
  });
});
