import type { PetRecord } from '../../core/types';
import { albumProgress, albumRows } from '../../game/collection';
import { t, tDynamic } from '../../i18n/t';
import { Dialog } from './Dialog';

interface CollectionDialogProps {
  pet: PetRecord;
  onClose(): void;
}

/** The album of gifts (Part 1L.4). What is still out there is a question mark, with how rare it is. */
export function CollectionDialog({ pet, onClose }: CollectionDialogProps) {
  const name = pet.pet.name;
  const { found, total } = albumProgress(pet);
  return (
    <Dialog title={t('collection.title', { name })} onClose={onClose}>
      <p>{t('collection.progress', { found, total })}</p>
      <ul class="summary album">
        {albumRows(pet).map((row) => (
          <li key={row.id} class={row.found ? 'found' : 'unknown'}>
            {row.found ? (
              <>
                <strong>{tDynamic(`item.${row.id}`)}</strong> {t('collection.first', { date: row.firstDate ?? '' })}
                {row.count > 1 ? ` ${t('collection.count', { count: row.count })}` : ''}
              </>
            ) : (
              <>
                <span aria-hidden="true">?</span> {t('collection.unknown', { kind: tDynamic(`collection.tier.${row.tier}`) })}
              </>
            )}
          </li>
        ))}
      </ul>
      <p class="muted">{t('collection.hint', { name })}</p>
      <button type="button" class="primary" onClick={onClose}>
        {t('menu.close')}
      </button>
    </Dialog>
  );
}
