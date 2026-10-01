import { useEffect } from 'preact/hooks';
import type { Command, CommandResult } from '../../core/commands';
import type { PetRecord } from '../../core/types';
import { shopRows } from '../../game/shop';
import { t, tDynamic } from '../../i18n/t';
import { Dialog } from './Dialog';
import { ShinyIcon } from './Icons';

interface ShopDialogProps {
  pet: PetRecord;
  /** The last thing that happened here (bought, or why not), as a sentence. */
  message: string;
  onCommand(command: Command): CommandResult | void;
  /** The shop is open, so the camera comes close to show what the pet wears. */
  onPreview(on: boolean): void;
  onClose(): void;
}

/**
 * The shop (Part 1L.5). A sheet along the bottom, so the pet stays in view and the player sees an
 * outfit on it at once. Shinies come from caring and are never bought, so this is the only place
 * they are spent (guide §14).
 */
export function ShopDialog({ pet, message, onCommand, onPreview, onClose }: ShopDialogProps) {
  useEffect(() => {
    onPreview(true);
    return () => onPreview(false);
  }, []);
  const name = pet.pet.name;
  const rows = shopRows(pet);
  return (
    <Dialog title={t('shop.title')} placement="bottom" onClose={onClose}>
      <p class="shop-balance">
        <ShinyIcon /> {t('shop.balance', { count: pet.inventory.shinies })}
      </p>
      <ul class="shop-list">
        {rows.map((row) => {
          const label = tDynamic(`item.${row.id}`);
          return (
            <li key={row.id} class="shop-row">
              <span class="shop-name">
                <strong>{label}</strong>
                <span class="muted">
                  {tDynamic(`slot.${row.slot}`)} {row.owned ? (row.worn ? `· ${t('shop.wearing', { name })}` : `· ${t('shop.owned')}`) : `· ${t('shop.price', { count: row.price })}`}
                </span>
              </span>
              {!row.owned && (
                <button
                  type="button"
                  disabled={row.missing > 0}
                  aria-label={row.missing > 0 ? t('shop.needMore', { count: row.missing, item: label }) : t('shop.buyLabel', { item: label, count: row.price })}
                  onClick={() => onCommand({ type: 'BuyItem', itemId: row.id })}
                >
                  {row.missing > 0 ? t('shop.needMore', { count: row.missing, item: label }) : t('shop.buy')}
                </button>
              )}
              {row.owned && !row.worn && (
                <button type="button" aria-label={t('shop.wearLabel', { item: label })} onClick={() => onCommand({ type: 'EquipItem', itemId: row.id })}>
                  {t('shop.wear')}
                </button>
              )}
              {row.owned && row.worn && (
                <button type="button" aria-label={t('shop.takeOffLabel', { item: label })} onClick={() => onCommand({ type: 'UnequipItem', itemId: row.id })}>
                  {t('shop.takeOff')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p class="status" role="status">
        {message}
      </p>
      <p class="muted">{t('shop.note', { name })}</p>
      <button type="button" class="primary" onClick={onClose}>
        {t('menu.close')}
      </button>
    </Dialog>
  );
}
