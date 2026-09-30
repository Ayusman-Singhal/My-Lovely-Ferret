import type { ComponentChildren } from 'preact';
import { t, tDynamic } from '../../i18n/t';
import { hudMeters, type NeedId } from '../../game/needs';
import type { PetState } from '../../core/types';
import { BoltIcon, BowlIcon, DropIcon, HeartIcon, MenuIcon, MoonIcon } from './Icons';

const ICON: Record<NeedId, () => ComponentChildren> = {
  hunger: () => <BowlIcon />,
  hydration: () => <DropIcon />,
  energy: () => <BoltIcon />,
  happiness: () => <HeartIcon />,
};

interface HudProps {
  name: string;
  state: PetState;
  onMenu?: () => void;
}

/** The needs at the top. Each meter has an icon, a label, a number, a level word, and a bar length: never color alone. */
export function Hud({ name, state, onMenu }: HudProps) {
  const meters = hudMeters(state);
  return (
    <header class="hud">
      <div class="hud-top">
        <h1 class="hud-name">
          {name}
          {state.sleepState === 'asleep' && (
            <span class="hud-sleep">
              <MoonIcon size={16} /> {t('hud.sleeping')}
            </span>
          )}
        </h1>
        {onMenu && (
          <button type="button" class="icon-btn" onClick={onMenu} aria-label={t('action.menu')}>
            <MenuIcon />
          </button>
        )}
      </div>
      <ul class="meters" aria-label={t('hud.needs')}>
        {meters.map((m) => {
          const label = tDynamic(m.labelKey);
          const level = tDynamic(`hud.level.${m.level}`);
          return (
            <li key={m.id} class="meter" data-level={m.level} role="img" aria-label={t('hud.meter', { label, value: m.value, level })}>
              <span class="meter-head">
                {ICON[m.id]()}
                <span class="meter-label">{label}</span>
              </span>
              <span class="meter-bar">
                <span class="meter-fill" style={{ width: `${m.value}%` }} />
              </span>
              <span class="meter-value">
                {m.value} <span class="meter-level">{level}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </header>
  );
}
