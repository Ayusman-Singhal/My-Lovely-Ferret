// The "welcome back" summary (docs/PET_BEHAVIOR.md §8): what the pet did while the player was
// away. Warm, never guilt: it says what the pet did, never how long the player was gone.
// Pure: returns text keys and parameters, the UI translates them (guide §17).

import { deriveMood } from '../core/mood';
import type { HistoryEvent, Mood, PetRecord } from '../core/types';

/** Time away that earns a summary. */
export const AWAY_SUMMARY_MS = 30 * 60_000;
export const MAX_EVENT_LINES = 3;
const STEPS_PER_HOUR = 6;

export interface SummaryLine {
  key: string;
  params: Record<string, string | number>;
}

export interface WelcomeSummary {
  lines: SummaryLine[];
  mood: Mood;
}

export interface SummaryInput {
  /** The pet after the catch-up simulation. */
  pet: PetRecord;
  /** Events the catch-up simulation produced, oldest first. */
  events: HistoryEvent[];
  asleepSteps: number;
  awayMs: number;
}

export function buildWelcomeBack(input: SummaryInput): WelcomeSummary | null {
  if (input.awayMs < AWAY_SUMMARY_MS) return null;
  const name = input.pet.pet.name;
  const lines: SummaryLine[] = [];

  const hours = Math.round(input.asleepSteps / STEPS_PER_HOUR);
  if (hours >= 1) lines.push({ key: hours === 1 ? 'welcome.slept1' : 'welcome.slept', params: { name, hours } });

  // Newest first. A long sleep is already covered by the sleep line above.
  const notable = input.events.filter((e) => e.type === 'PET_STOLE_ITEM' || e.type === 'PET_FOUND_ITEM').reverse();
  for (const e of notable.slice(0, MAX_EVENT_LINES)) {
    const itemId = String(e.payload['itemId'] ?? 'button');
    lines.push({ key: e.type === 'PET_STOLE_ITEM' ? 'welcome.stole' : 'welcome.found', params: { name, itemId } });
  }

  const mood = deriveMood(input.pet.state, input.pet.personality);
  lines.push({ key: `welcome.mood.${mood}`, params: { name } });
  return { lines, mood };
}
