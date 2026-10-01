import { useEffect, useState } from 'preact/hooks';
import { createPet } from '../core/pet';
import { createEmptySave, defaultSettings, type SaveFile } from '../core/save';
import { createOffsetClock, createScaledClock, type Clock, type OffsetClock } from '../core/time';
import type { PetRecord } from '../core/types';
import { bootSession, type BootResult } from '../game/session';
import { t } from '../i18n/t';
import { createMemoryBackend } from '../platform/memoryBackend';
import { createFirstRunSave, createSaveStore, type SaveStore, type SaveStoreDeps } from '../platform/saveStore';
import { createIdbBackend } from '../platform/web/idbBackend';
import { copyText } from '../platform/web/clipboard';
import { createErrorLog, formatErrorReport, installErrorHandler } from '../platform/web/errorReport';
import { requestPersistentStorage } from '../platform/web/persist';
import { ErrorBanner } from './components/Notices';
import { Home } from './screens/Home';
import { Onboarding } from './screens/Onboarding';
import { Recovery } from './screens/Recovery';

// Preview options (no saving in these modes, so a test pet never touches a real save):
//   ?pet=<any text>  a pet whose traits and coat come from that text
//   ?speed=60        game time runs 60 times faster (watch sleep and daily events)

type Screen =
  | { kind: 'loading' }
  | { kind: 'boot'; boot: BootResult; store: SaveStore; deps: SaveStoreDeps; saveUnavailable: boolean }
  | { kind: 'preview'; pet: PetRecord; save: SaveFile; clock: OffsetClock }
  | { kind: 'home'; save: SaveFile; pet: PetRecord; store: SaveStore; saveUnavailable: boolean };

const realClock: Clock = { nowMs: () => Date.now() };
/** The one clock real play reads. Plain play never moves its offset; only the dev panel does (guide §25.7). */
const gameClock: OffsetClock = createOffsetClock(realClock);
/** The last few uncaught errors, for "copy error details" (guide §25.3). */
const errorLog = createErrorLog();

/** Shows a small notice after an uncaught error and lets the tester copy the details. */
export function App() {
  const [errored, setErrored] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => installErrorHandler(window, errorLog, () => Date.now(), () => { setErrored(true); setCopied(false); }), []);

  const copyDetails = (): void => {
    const text = formatErrorReport(errorLog.list(), { version: __APP_VERSION__, userAgent: navigator.userAgent, url: window.location.origin + window.location.pathname, nowIso: new Date().toISOString() });
    void copyText(text).then((ok) => setCopied(ok));
  };

  return (
    <>
      <Screens />
      {errored && <ErrorBanner copied={copied} onCopy={copyDetails} onDismiss={() => { setErrored(false); errorLog.clear(); }} />}
    </>
  );
}

function Screens() {
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });

  useEffect(() => {
    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const deps: SaveStoreDeps = {
        randomId: () => crypto.randomUUID(),
        nowMs: () => Date.now(),
        prefersReducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
      };

      if (params.has('pet') || params.has('speed')) {
        const speed = Math.min(600, Math.max(1, Number(params.get('speed')) || 1));
        const clock = createOffsetClock(createScaledClock(() => Date.now(), () => performance.now(), speed));
        const pet = createPet({
          id: params.get('pet') ?? 'demo-pet-1',
          name: 'Mochi',
          nowMs: clock.nowMs(),
          tzOffsetMin: -new Date().getTimezoneOffset(),
          deviceId: 'preview',
        });
        const save = { ...createEmptySave('preview', clock.nowMs(), defaultSettings()), pets: [pet], activePetId: pet.pet.id };
        setScreen({ kind: 'preview', pet, save, clock });
        return;
      }

      let store: SaveStore;
      let boot: BootResult;
      let saveUnavailable = false;
      try {
        store = createSaveStore(createIdbBackend(), deps);
        boot = await bootSession(store, deps);
        void requestPersistentStorage();
      } catch {
        // No IndexedDB (a private window, blocked storage): play without saving, and say so.
        saveUnavailable = true;
        store = createSaveStore(createMemoryBackend(), deps);
        boot = await bootSession(store, deps);
      }
      setScreen({ kind: 'boot', boot, store, deps, saveUnavailable });
    })();
  }, []);

  if (screen.kind === 'loading') return <p class="loading">{t('app.loading')}</p>;

  if (screen.kind === 'preview') {
    return <Home save={screen.save} pet={screen.pet} welcome={null} clock={screen.clock} offsetClock={screen.clock} store={null} />;
  }

  if (screen.kind === 'home') {
    return <Home save={screen.save} pet={screen.pet} welcome={null} clock={gameClock} offsetClock={gameClock} store={screen.store} saveUnavailable={screen.saveUnavailable} />;
  }

  const { boot, store, deps, saveUnavailable } = screen;

  if (boot.kind === 'corrupt' || boot.kind === 'too_new') {
    return (
      <Recovery
        kind={boot.kind}
        store={store}
        onStartOver={() => {
          void createFirstRunSave(store, deps).then((save) =>
            setScreen({ kind: 'boot', boot: { kind: 'first-run', save }, store, deps, saveUnavailable }),
          );
        }}
      />
    );
  }

  if (boot.kind === 'first-run') {
    return (
      <Onboarding
        save={boot.save}
        clock={gameClock}
        onAdopted={(save, pet) => {
          void store.save(save).catch(() => undefined); // Home saves again and reports a problem
          setScreen({ kind: 'home', save, pet, store, saveUnavailable });
        }}
      />
    );
  }

  return <Home save={boot.save} pet={boot.pet} welcome={boot.welcome} clock={gameClock} offsetClock={gameClock} store={store} saveUnavailable={saveUnavailable} />;
}
