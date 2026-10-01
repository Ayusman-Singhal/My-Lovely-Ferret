import { useEffect, useState } from 'preact/hooks';
import type { ItemKind } from '../../core/catalog';
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
  onPreview(mode: 'pet' | 'room' | null): void;
  onClose(): void;
}

/**
 * The shop (Part 1L.5). A sheet along the bottom, so the pet stays in view and the player sees an
 * outfit on it at once. Shinies come from caring and are never bought, so this is the only place
 * they are spent (guide §14).
 */
export function ShopDialog({ pet, message, onCommand, onPreview, onClose }: ShopDialogProps) {
  const [tab, setTab] = useState<ItemKind>('outfit');
  useEffect(() => {
    onPreview(tab === 'outfit' ? 'pet' : 'room');
  }, [tab]);
  useEffect(() => () => onPreview(null), []);
  const name = pet.pet.name;
  const rows = shopRows(pet).filter((row) => row.kind === tab);
  return (
    <Dialog title={t('shop.title')} placement="bottom" compact={tab === 'decor'} onClose={onClose}>
      <p class="shop-balance">
        <ShinyIcon /> {t('shop.balance', { count: pet.inventory.shinies })}
      </p>
      <div class="row shop-tabs" role="group" aria-label={t('shop.tabs')}>
        {(['outfit', 'decor'] as const).map((kind) => (
          <button key={kind} type="button" aria-pressed={tab === kind} class={tab === kind ? 'primary' : ''} onClick={() => setTab(kind)}>
            {tDynamic(`shop.tab.${kind}`)}
          </button>
        ))}
      </div>
      <ul class="shop-list">
        {rows.map((row) => {
          const label = tDynamic(`item.${row.id}`);
          return (
            <li key={row.id} class="shop-row">
              <span class="shop-name">
                <strong>{label}</strong>
                <span class="muted">
                  {tDynamic(`slot.${row.slot}`)}{' '}
                  {row.owned
                    ? row.worn
                      ? `· ${row.kind === 'outfit' ? t('shop.wearing', { name }) : t('shop.inUse')}`
                      : `· ${t('shop.owned')}`
                    : `· ${t('shop.price', { count: row.price })}`}
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
                <button
                  type="button"
                  aria-label={row.kind === 'outfit' ? t('shop.wearLabel', { item: label }) : t('shop.useLabel', { item: label })}
                  onClick={() => onCommand({ type: 'EquipItem', itemId: row.id })}
                >
                  {row.kind === 'outfit' ? t('shop.wear') : t('shop.use')}
                </button>
              )}
              {row.owned && row.worn && (
                <button
                  type="button"
                  aria-label={row.kind === 'outfit' ? t('shop.takeOffLabel', { item: label }) : t('shop.removeLabel', { item: label })}
                  onClick={() => onCommand({ type: 'UnequipItem', itemId: row.id })}
                >
                  {row.kind === 'outfit' ? t('shop.takeOff') : t('shop.remove')}
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
