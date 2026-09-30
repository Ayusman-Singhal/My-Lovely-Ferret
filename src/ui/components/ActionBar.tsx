import { t } from '../../i18n/t';
import type { Interaction } from '../../game/hints';
import { BallIcon, BowlIcon, DropIcon, MoonIcon } from './Icons';

interface ActionBarProps {
  disabled: boolean;
  /** The interaction the first-time hint points at, if any. Its button gets a marker (not color alone). */
  hinted: Interaction | null;
  onFeed(): void;
  onWater(): void;
  onPlay(): void;
  onSleep(): void;
}

/** Big, thumb-sized buttons (at least 44 px) with an icon and a word each. */
export function ActionBar({ disabled, hinted, onFeed, onWater, onPlay, onSleep }: ActionBarProps) {
  const button = (id: Interaction, label: string, icon: preact.ComponentChildren, onClick: () => void) => (
    <button type="button" class="action" data-hinted={hinted === id ? 'true' : undefined} disabled={disabled} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
  return (
    <nav class="actions" aria-label={t('action.bar')}>
      {button('feed', t('action.feed'), <BowlIcon size={22} />, onFeed)}
      {button('water', t('action.water'), <DropIcon size={22} />, onWater)}
      {button('play', t('action.play'), <BallIcon size={22} />, onPlay)}
      {button('sleep', t('action.sleep'), <MoonIcon size={22} />, onSleep)}
    </nav>
  );
}
