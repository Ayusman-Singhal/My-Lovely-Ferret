import { useEffect, useState } from 'preact/hooks';
import { createPet } from '../core/pet';
import { createEmptySave, defaultSettings, type SaveFile } from '../core/save';
import { createScaledClock, type Clock } from '../core/time';
import type { PetRecord } from '../core/types';
import { bootSession, type BootResult } from '../game/session';
import { t } from '../i18n/t';
import { createMemoryBackend } from '../platform/memoryBackend';
import { createFirstRunSave, createSaveStore, type SaveStore, type SaveStoreDeps } from '../platform/saveStore';
import { createIdbBackend } from '../platform/web/idbBackend';
import { requestPersistentStorage } from '../platform/web/persist';
import { Home } from './screens/Home';
import { Onboarding } from './screens/Onboarding';
import { Recovery } from './screens/Recovery';

// Preview options (no saving in these modes, so a test pet never touches a real save):
//   ?pet=<any text>  a pet whose traits and coat come from that text
//   ?speed=60        game time runs 60 times faster (watch sleep and daily events)

type Screen =
  | { kind: 'loading' }
  | { kind: 'boot'; boot: BootResult; store: SaveStore; deps: SaveStoreDeps; saveUnavailable: boolean }
  | { kind: 'preview'; pet: PetRecord; save: SaveFile; clock: Clock }
  | { kind: 'home'; save: SaveFile; pet: PetRecord; store: SaveStore; saveUnavailable: boolean };

const realClock: Clock = { nowMs: () => Date.now() };

export function App() {
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
        const clock = createScaledClock(() => Date.now(), () => performance.now(), speed);
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
    return <Home save={screen.save} pet={screen.pet} welcome={null} clock={screen.clock} store={null} />;
  }

  if (screen.kind === 'home') {
    return <Home save={screen.save} pet={screen.pet} welcome={null} clock={realClock} store={screen.store} saveUnavailable={screen.saveUnavailable} />;
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
        clock={realClock}
        onAdopted={(save, pet) => {
          void store.save(save).catch(() => undefined); // Home saves again and reports a problem
          setScreen({ kind: 'home', save, pet, store, saveUnavailable });
        }}
      />
    );
  }

  return <Home save={boot.save} pet={boot.pet} welcome={boot.welcome} clock={realClock} store={store} saveUnavailable={saveUnavailable} />;
}
