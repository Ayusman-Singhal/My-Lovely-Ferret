import { useEffect, useRef, useState } from 'preact/hooks';
import type { Command, CommandResult } from '../../core/commands';
import { bumpInteraction, type SaveFile } from '../../core/save';
import type { Clock } from '../../core/time';
import type { PetRecord } from '../../core/types';
import type { Game, PlayResult } from '../../game/controller';
import { interactionOf, nextHint } from '../../game/hints';
import { announcements } from '../../game/needs';
import { createAutosave } from '../../game/persistence';
import type { WelcomeSummary } from '../../game/summary';
import { t, tDynamic } from '../../i18n/t';
import type { SaveStore } from '../../platform/saveStore';
import { ActionBar } from '../components/ActionBar';
import { Dialog } from '../components/Dialog';
import { Hud } from '../components/Hud';
import { MenuDialog } from '../components/MenuDialog';
import { Stage } from '../Stage';

interface HomeProps {
  save: SaveFile;
  pet: PetRecord;
  welcome: WelcomeSummary | null;
  clock: Clock;
  /** Null in preview mode: nothing is saved. */
  store: SaveStore | null;
  /** The save could not be written or read in this browser. */
  saveUnavailable?: boolean;
}

function describeResult(result: CommandResult, name: string): string {
  const o = result.outcome;
  if (!o.ok) return tDynamic(`refuse.${o.reason}`, { name });
  return o.bondGain > 0 ? t('result.bond', { name, amount: (o.bondGain / 100).toFixed(1) }) : t('result.done');
}

export function Home({ save, pet: initialPet, welcome, clock, store, saveUnavailable }: HomeProps) {
  const gameRef = useRef<Game | null>(null);
  const saveRef = useRef(save);
  const prevState = useRef(initialPet.state);
  const [, redraw] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [live, setLive] = useState('');
  const [counters, setCounters] = useState(save.tester.interactionCounts);
  const [menuOpen, setMenuOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(welcome !== null);
  const [saveProblem, setSaveProblem] = useState(false);

  const name = initialPet.pet.name;

  // Autosave: debounced, and flushed when the page is hidden (guide §8). Off in preview mode.
  const autosave = useRef(
    createAutosave(
      async () => {
        const game = gameRef.current;
        if (!store || !game) return;
        const current = game.getPet();
        const next: SaveFile = { ...saveRef.current, pets: saveRef.current.pets.map((p) => (p.pet.id === current.pet.id ? current : p)) };
        saveRef.current = next;
        try {
          await store.save(next);
          setSaveProblem(false);
        } catch (e) {
          setSaveProblem(true);
          throw e;
        }
      },
      { setTimer: (fn, ms) => window.setTimeout(fn, ms), clearTimer: (h) => window.clearTimeout(h as number) },
    ),
  ).current;

  useEffect(() => {
    if (!store) return;
    const flush = (): void => void autosave.flush();
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    autosave.markDirty(); // the session count and the catch-up simulation from boot
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  const refresh = (): void => {
    const game = gameRef.current;
    if (game) {
      const keys = announcements(prevState.current, game.getPet().state);
      prevState.current = game.getPet().state;
      if (keys.length > 0) setLive(keys.map((k) => tDynamic(k, { name })).join(' '));
    }
    redraw((n) => n + 1);
    if (store) autosave.markDirty();
  };

  const onCommand = (command: Command, result: CommandResult): void => {
    const interaction = interactionOf(command);
    if (result.outcome.ok && interaction) {
      saveRef.current = bumpInteraction(saveRef.current, interaction);
      setCounters(saveRef.current.tester.interactionCounts);
    }
    if (command.type === 'PetTouch') setFeedback(describeResult(result, name));
  };

  const onPlayEnd = (r: PlayResult): void => {
    const message = tDynamic(`play.band.${r.band}`);
    const noReward = r.result.outcome.ok && !r.result.outcome.rewarded ? ` ${t('play.noReward', { name })}` : '';
    setFeedback(`${t('play.result', { name, count: r.catches, message })}${noReward}`);
  };

  const game = gameRef.current;
  const pet = game?.getPet() ?? initialPet;
  const playing = game?.minigame() != null;
  const act = (command: Command): void => {
    if (!game) return;
    setFeedback(describeResult(game.dispatch(command), name));
  };
  // No "put to bed" hint for a pet that is already asleep.
  const hint = pet.state.sleepState === 'asleep' ? null : nextHint(counters);
  const statusLine = playing ? t('play.instructions', { name }) : feedback || (hint ? t(`hint.${hint}`, { name }) : '');

  return (
    <div class="app">
      <Hud name={name} state={pet.state} onMenu={() => setMenuOpen(true)} />
      <div class="stage-wrap">
        <Stage
          pet={initialPet}
          clock={clock}
          options={{ onChange: refresh, onPetChange: refresh, onCommand, onPlayEnd }}
          onGame={(g) => {
            gameRef.current = g;
            refresh();
          }}
        />
      </div>
      <div class="bottom">
        <p class="status" role="status">
          {statusLine}
        </p>
        <ActionBar
          disabled={playing || !game}
          hinted={playing || feedback ? null : hint}
          onFeed={() => act({ type: 'FeedPet', foodId: pet.state.favoriteFood })}
          onWater={() => act({ type: 'GiveWater' })}
          onPlay={() => {
            if (!game) return;
            const r = game.startPlay(pet.state.favoriteToy);
            setFeedback(r.outcome.ok ? '' : describeResult(r, name));
          }}
          onSleep={() => act({ type: 'PutToBed' })}
        />
      </div>

      {(saveUnavailable || saveProblem) && <p class="banner">{t('menu.saveFailed')}</p>}
      <div class="sr-only" aria-live="polite">
        {live}
      </div>

      {welcome && welcomeOpen && (
        <Dialog title={t('welcome.title')} onClose={() => setWelcomeOpen(false)}>
          <ul class="summary">
            {welcome.lines.map((line, i) => {
              const params = { ...line.params };
              if (typeof params['itemId'] === 'string') params['item'] = tDynamic(`item.${params['itemId']}`);
              return <li key={i}>{tDynamic(line.key, params)}</li>;
            })}
          </ul>
          <button type="button" class="primary" onClick={() => setWelcomeOpen(false)}>
            {t('welcome.ok')}
          </button>
        </Dialog>
      )}

      {menuOpen && (
        <MenuDialog
          petName={name}
          store={store}
          beforeExport={() => autosave.flush()}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}
