import { useEffect } from 'preact/hooks';
import { TRICKS } from '../../core/tricks';
import type { PetRecord } from '../../core/types';
import { t, tDynamic } from '../../i18n/t';
import { Dialog } from './Dialog';

interface TricksDialogProps {
  pet: PetRecord;
  onAsk(id: string): void;
  /** Open: the pet comes to the middle and faces the player, as in the shop. */
  onPreview(on: boolean): void;
  onClose(): void;
}

/** The tricks (Part 1L.7): the ones learned have an Ask button, the others say how much bond they need. */
export function TricksDialog({ pet, onAsk, onPreview, onClose }: TricksDialogProps) {
  useEffect(() => {
    onPreview(true);
    return () => onPreview(false);
  }, []);
  const name = pet.pet.name;
  const bond = pet.state.bond;
  return (
    <Dialog title={t('tricks.title', { name })} placement="bottom" compact onClose={onClose}>
      <p class="muted">{t('tricks.intro', { name })}</p>
      <ul class="shop-list">
        {TRICKS.map((trick) => {
          const label = tDynamic(`tricks.${trick.id}`);
          const learned = bond >= trick.bond;
          return (
            <li key={trick.id} class="shop-row">
              <span class="shop-name">
                <strong>{label}</strong>
                {!learned && <span class="muted">{t('tricks.locked', { have: Math.floor(bond / 100), need: trick.bond / 100 })}</span>}
              </span>
              {learned && (
                <button type="button" aria-label={t('tricks.askLabel', { name, trick: label })} onClick={() => onAsk(trick.id)}>
                  {t('tricks.ask')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" class="primary" onClick={onClose}>
        {t('menu.close')}
      </button>
    </Dialog>
  );
}
