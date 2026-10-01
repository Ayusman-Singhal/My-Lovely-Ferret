import { useState } from 'preact/hooks';
import type { PetRecord } from '../../core/types';
import type { SaveFile } from '../../core/save';
import { DAY_MS, HOUR_MS, type OffsetClock } from '../../core/time';
import type { Behavior } from '../../core/petAI';
import { NEED_KEYS, setNeed, type NeedKey } from '../../game/devTools';
import type { Game } from '../../game/controller';
import { t, tDynamic } from '../../i18n/t';
import type { SaveStore } from '../../platform/saveStore';
import { Dialog } from './Dialog';

interface DevPanelProps {
  game: Game;
  /** Null when the game runs on the plain clock. */
  clock: OffsetClock | null;
  /** The newest save in memory, for the inspector. */
  save: SaveFile;
  /** Null in a preview: nothing is saved there. */
  store: SaveStore | null;
  /** Rewind the pet's remembered times, save, and reload (Home does the saving). */
  onPretendAway(ms: number): void;
  onExport(): void;
  onClose(): void;
}

const BEHAVIORS: readonly Behavior[] = ['idle', 'wander', 'sniff', 'curious', 'eat', 'drink', 'playful', 'steal'];
const SAVE_PREVIEW_CHARS = 3500;

/**
 * Developer tools (guide §25.7). Clock control goes through the one clock the game reads, never
 * through a patched `Date`. Opened with `?dev=1` or by tapping the version in the menu 7 times.
 */
export function DevPanel({ game, clock, save, store, onPretendAway, onExport, onClose }: DevPanelProps) {
  const [seed, setSeed] = useState('');
  const [message, setMessage] = useState('');
  const pet: PetRecord = game.getPet();

  const need = (key: NeedKey): number => Math.round(pet.state[key] / 100);
  const advance = (ms: number): void => clock?.advance(ms);
  const clockLocked = store !== null;

  const corrupt = async (which: 'newest' | 'both'): Promise<void> => {
    if (!store || !window.confirm(t('dev.corruptConfirm'))) return;
    await store.debugCorrupt(which);
    setMessage(t('dev.corruptDone'));
  };

  return (
    <Dialog title={t('dev.title')} onClose={onClose}>
      <div class="stack dev">
        <h3 class="card-subtitle">{t('dev.clock')}</h3>
        {clock && clock.offsetMs() !== 0 && <p class="muted">{t('dev.clockOffset', { hours: Math.round(clock.offsetMs() / HOUR_MS) })}</p>}
        {clockLocked && <p class="muted">{t('dev.clockLocked')}</p>}
        <div class="row">
          <button type="button" disabled={clockLocked || !clock} onClick={() => advance(HOUR_MS)}>
            {t('dev.plus1h')}
          </button>
          <button type="button" disabled={clockLocked || !clock} onClick={() => advance(8 * HOUR_MS)}>
            {t('dev.plus8h')}
          </button>
          <button type="button" disabled={clockLocked || !clock} onClick={() => advance(DAY_MS)}>
            {t('dev.plus1d')}
          </button>
        </div>
        <button type="button" disabled={clockLocked || !clock} onClick={() => clock?.reset()}>
          {t('dev.clockReset')}
        </button>

        <h3 class="card-subtitle">{t('dev.away')}</h3>
        <p class="muted">{t('dev.awayNote')}</p>
        <div class="row">
          <button type="button" onClick={() => onPretendAway(HOUR_MS)}>
            {t('dev.plus1h')}
          </button>
          <button type="button" onClick={() => onPretendAway(8 * HOUR_MS)}>
            {t('dev.plus8h')}
          </button>
          <button type="button" onClick={() => onPretendAway(DAY_MS)}>
            {t('dev.plus1d')}
          </button>
        </div>

        <h3 class="card-subtitle">{t('dev.needs')}</h3>
        {NEED_KEYS.map((key) => (
          <label key={key} class="slider">
            <span>
              {tDynamic(`dev.need.${key}`)} {need(key)}
            </span>
            <input type="range" min={0} max={100} value={need(key)} onInput={(e) => game.replacePet(setNeed(game.getPet(), key, Number((e.currentTarget as HTMLInputElement).value)))} />
          </label>
        ))}

        <h3 class="card-subtitle">{t('dev.behavior')}</h3>
        <div class="chips">
          {BEHAVIORS.map((b) => (
            <button key={b} type="button" onClick={() => game.brain.request(b)}>
              {b}
            </button>
          ))}
        </div>

        <h3 class="card-subtitle">{t('dev.seed')}</h3>
        <div class="row">
          <input type="text" value={seed} placeholder={t('dev.seedPlaceholder')} onInput={(e) => setSeed((e.currentTarget as HTMLInputElement).value)} aria-label={t('dev.seed')} />
          <button type="button" disabled={!seed.trim()} onClick={() => (window.location.search = `?pet=${encodeURIComponent(seed.trim())}&dev=1`)}>
            {t('dev.seedGo')}
          </button>
        </div>

        <h3 class="card-subtitle">{t('dev.save')}</h3>
        {store ? (
          <>
            <pre class="preview">{JSON.stringify(save, null, 1).slice(0, SAVE_PREVIEW_CHARS)}</pre>
            <button type="button" onClick={onExport}>
              {t('dev.saveExport')}
            </button>
            <button type="button" onClick={() => void corrupt('newest')}>
              {t('dev.corruptNewest')}
            </button>
            <button type="button" onClick={() => void corrupt('both')}>
              {t('dev.corruptBoth')}
            </button>
          </>
        ) : (
          <p class="muted">{t('dev.saveNone')}</p>
        )}
        <button
          type="button"
          onClick={() =>
            window.setTimeout(() => {
              throw new Error('Test error from the developer tools');
            }, 0)
          }
        >
          {t('dev.throw')}
        </button>
        <p class="status" role="status">
          {message}
        </p>
        <button type="button" class="primary" onClick={onClose}>
          {t('dev.close')}
        </button>
      </div>
    </Dialog>
  );
}
