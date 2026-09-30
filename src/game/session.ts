// Starting the app: read the save, catch the pet up on the time away, build the welcome-back
// summary, and create a new pet on first run. Pure logic over the SaveStore interface, so it is
// tested without a browser.

import { createPet } from '../core/pet';
import { recordSession, type SaveFile } from '../core/save';
import { simulate } from '../core/simulate';
import { validateName, type NameProblem } from '../core/name';
import type { PetRecord } from '../core/types';
import { createFirstRunSave, type SaveStore, type SaveStoreDeps } from '../platform/saveStore';
import { buildWelcomeBack, type WelcomeSummary } from './summary';

export type BootResult =
  | { kind: 'first-run'; save: SaveFile }
  | { kind: 'ready'; save: SaveFile; pet: PetRecord; welcome: WelcomeSummary | null; recovered: boolean }
  | { kind: 'corrupt'; problems: string[] }
  | { kind: 'too_new' };

export async function bootSession(store: SaveStore, deps: SaveStoreDeps): Promise<BootResult> {
  const loaded = await store.loadWithInfo();
  if (loaded.status === 'too_new') return { kind: 'too_new' };
  if (loaded.status === 'corrupt') return { kind: 'corrupt', problems: loaded.problems };
  if (loaded.status === 'empty' || !loaded.file) return { kind: 'first-run', save: await createFirstRunSave(store, deps) };

  const now = deps.nowMs();
  let save = recordSession(loaded.file, now);
  const record = save.pets.find((p) => p.pet.id === save.activePetId) ?? save.pets[0];
  if (!record) return { kind: 'first-run', save };

  // Catch the pet up on the time away. A gap of 30 minutes or more also gets a summary.
  const awayMs = Math.max(0, now - record.timestamps.lastSimulationTime);
  const sim = simulate(record, now);
  const welcome = buildWelcomeBack({ pet: sim.pet, events: sim.events, asleepSteps: sim.asleepSteps, awayMs });
  save = { ...save, pets: save.pets.map((p) => (p.pet.id === sim.pet.pet.id ? sim.pet : p)) };
  return { kind: 'ready', save, pet: sim.pet, welcome, recovered: loaded.status === 'recovered' };
}

export interface AdoptParams {
  id: string;
  name: string;
  nowMs: number;
  tzOffsetMin: number;
}

export type AdoptResult = { ok: true; save: SaveFile; pet: PetRecord } | { ok: false; reason: NameProblem };

/** Create the first pet: validate the name, draw traits from the id, and add it to the save. */
export function adoptPet(save: SaveFile, params: AdoptParams): AdoptResult {
  const check = validateName(params.name);
  if (!check.ok) return { ok: false, reason: check.reason };
  const pet = createPet({ ...params, deviceId: save.installId });
  return { ok: true, pet, save: { ...save, pets: [...save.pets, pet], activePetId: pet.pet.id } };
}
