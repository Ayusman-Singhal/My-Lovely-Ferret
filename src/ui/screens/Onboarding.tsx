import { useMemo, useState } from 'preact/hooks';
import { createPet } from '../../core/pet';
import type { SaveFile } from '../../core/save';
import type { Clock } from '../../core/time';
import type { PetRecord } from '../../core/types';
import { adoptPet } from '../../game/session';
import { t, tDynamic } from '../../i18n/t';
import { Stage } from '../Stage';

interface OnboardingProps {
  save: SaveFile;
  clock: Clock;
  onAdopted(save: SaveFile, pet: PetRecord): void;
}

const level = (value: number): 'high' | 'mid' | 'low' => (value >= 66 ? 'high' : value <= 33 ? 'low' : 'mid');

/**
 * First launch (docs/GAME_DESIGN.md §9): the pet is in the room behind two clear buttons. "Adopt a
 * pet" leads to naming and a short introduction. "Care for a friend's pet" waits for Phase 3.
 */
export function Onboarding({ save, clock, onAdopted }: OnboardingProps) {
  const [step, setStep] = useState<'adopt' | 'name' | 'intro'>('adopt');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [adopted, setAdopted] = useState<{ save: SaveFile; pet: PetRecord } | null>(null);

  // A throwaway pet walks around behind the buttons until the real one exists.
  const preview = useMemo(
    () => createPet({ id: 'preview-pet', name: 'Preview', nowMs: clock.nowMs(), tzOffsetMin: 0, deviceId: save.installId }),
    [],
  );
  const shown = adopted?.pet ?? preview;

  const submitName = (e: Event): void => {
    e.preventDefault();
    const result = adoptPet(save, {
      id: crypto.randomUUID(),
      name: name.trim(),
      nowMs: clock.nowMs(),
      tzOffsetMin: -new Date().getTimezoneOffset(),
    });
    if (!result.ok) {
      setError(tDynamic(`name.error.${result.reason}`));
      return;
    }
    setAdopted({ save: result.save, pet: result.pet });
    setStep('intro');
  };

  const p = adopted?.pet;
  return (
    <div class="app onboarding">
      <div class="stage-wrap">
        <Stage key={shown.pet.id} pet={shown} clock={clock} />
      </div>

      <div class="sheet">
        {step === 'adopt' && (
          <>
            <h1 class="title">{t('app.title')}</h1>
            <p class="muted">{t('app.tagline')}</p>
            <div class="stack">
              <button type="button" class="primary" onClick={() => setStep('name')}>
                {t('adopt.button')}
              </button>
              <button type="button" disabled aria-describedby="friend-soon">
                {t('adopt.friend')}
              </button>
              <p class="muted" id="friend-soon">
                {t('adopt.friendSoon')}
              </p>
            </div>
          </>
        )}

        {step === 'name' && (
          <form onSubmit={submitName} class="stack" noValidate>
            <h1 class="title">{t('name.title')}</h1>
            <label for="pet-name">{t('name.label')}</label>
            <input
              id="pet-name"
              type="text"
              value={name}
              autocomplete="off"
              enterkeyhint="done"
              aria-describedby="name-hint name-error"
              aria-invalid={error ? 'true' : undefined}
              onInput={(e) => {
                setName((e.currentTarget as HTMLInputElement).value);
                setError('');
              }}
              autofocus
            />
            <p class="muted" id="name-hint">
              {t('name.hint')}
            </p>
            <p class="error" id="name-error" role="alert">
              {error}
            </p>
            <div class="row">
              <button type="button" onClick={() => setStep('adopt')}>
                {t('name.back')}
              </button>
              <button type="submit" class="primary">
                {t('name.continue')}
              </button>
            </div>
          </form>
        )}

        {step === 'intro' && adopted && p && (
          <div class="stack">
            <h1 class="title">{t('intro.title', { name: p.pet.name })}</h1>
            <ul class="summary">
              <li>{tDynamic(`intro.mischief.${level(p.personality.mischief)}`, { name: p.pet.name })}</li>
              <li>{tDynamic(`intro.curiosity.${level(p.personality.curiosity)}`, { name: p.pet.name })}</li>
              <li>{tDynamic(`intro.affection.${level(p.personality.affection)}`, { name: p.pet.name })}</li>
              <li>
                {t('intro.loves', {
                  name: p.pet.name,
                  food: tDynamic(`food.${p.state.favoriteFood}`),
                  toy: tDynamic(`toy.${p.state.favoriteToy}`),
                })}
              </li>
            </ul>
            <button type="button" class="primary" onClick={() => onAdopted(adopted.save, adopted.pet)}>
              {t('intro.start')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
