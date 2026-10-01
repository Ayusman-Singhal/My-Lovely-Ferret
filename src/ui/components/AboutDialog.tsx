import type { SaveFile } from '../../core/save';
import type { PetRecord } from '../../core/types';
import { buildAboutPet } from '../../game/aboutPet';
import { t, tDynamic } from '../../i18n/t';
import { Dialog } from './Dialog';

interface AboutDialogProps {
  pet: PetRecord;
  tester: SaveFile['tester'];
  nowMs: number;
  onClose(): void;
}

const formatDate = (ms: number): string => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** "About my pet" (guide §25.3): the pet's story so far and the tester's own counters, all kept on the device. */
export function AboutDialog({ pet, tester, nowMs, onClose }: AboutDialogProps) {
  const about = buildAboutPet(pet, tester, nowMs);
  const name = about.name;
  return (
    <Dialog title={t('about.title', { name })} onClose={onClose}>
      <ul class="summary">
        <li>{t('about.day', { day: about.dayNumber })}</li>
        <li>{t('about.bond', { bond: about.bond })}</li>
        <li>{t('about.coat', { coat: tDynamic(`coat.${about.coat}`) })}</li>
        <li>{tDynamic(`intro.mischief.${about.traits.mischief}`, { name })}</li>
        <li>{tDynamic(`intro.curiosity.${about.traits.curiosity}`, { name })}</li>
        <li>{tDynamic(`intro.affection.${about.traits.affection}`, { name })}</li>
        <li>{t('intro.loves', { name, food: tDynamic(`food.${about.favoriteFood}`), toy: tDynamic(`toy.${about.favoriteToy}`) })}</li>
      </ul>
      <h3 class="card-subtitle">{t('about.counts', { name })}</h3>
      <ul class="summary">
        {about.counts.map((c) => (
          <li key={c.key}>{t('about.count', { label: tDynamic(`interaction.${c.key}`), count: c.count })}</li>
        ))}
      </ul>
      <p class="muted">{t('about.sessions', { count: about.sessions })}</p>
      <p class="muted">{t('about.first', { date: formatDate(about.firstOpen) })}</p>
      <p class="muted">{t('about.last', { date: formatDate(about.lastOpen) })}</p>
      <p class="muted">{t('about.note')}</p>
      <button type="button" class="primary" onClick={onClose}>
        {t('about.close')}
      </button>
    </Dialog>
  );
}
