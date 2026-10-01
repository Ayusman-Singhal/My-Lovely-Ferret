import { useEffect, useRef, useState } from 'preact/hooks';
import type { Clock } from '../core/time';
import type { PetRecord } from '../core/types';
import { createGame, type Game, type GameOptions } from '../game/controller';
import { t } from '../i18n/t';
import { fetchFerretModel } from '../render/modelAsset';
import type { PetScene } from '../render/petScene';

interface StageProps {
  pet: PetRecord;
  clock: Clock;
  /** Callbacks for the game. Read once when the stage mounts. */
  options?: Omit<GameOptions, 'pet' | 'clock'>;
  onGame?(game: Game): void;
}

type Status = 'loading' | 'ready' | 'unsupported' | 'failed';

/**
 * Mounts the 3D scene once. The canvas belongs to the renderer: Preact never re-renders it and
 * never drives its animation (guide §4.4). It is remounted only when the pet itself changes.
 * The model download starts at once and the three.js code loads in parallel, so the loading text
 * shows long before either has arrived (docs/PERFORMANCE.md §3.2).
 */
export function Stage({ pet, clock, options, onGame }: StageProps) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    let scene: PetScene | null = null;
    setStatus('loading');
    const model = fetchFerretModel();
    model.catch(() => undefined); // reported below, through the scene
    const game = createGame({ ...options, pet, clock });
    onGame?.(game);
    // Dev only: `?debug=1` lets scripts and the console inspect the game (`__game.getPet()`).
    if (new URLSearchParams(window.location.search).has('debug')) (window as unknown as { __game: Game }).__game = game;

    void (async () => {
      try {
        const three = await import('../render/scene3d');
        if (cancelled) return;
        if (!three.webglAvailable()) {
          setStatus('unsupported');
          return;
        }
        const created = await three.createScene3D(el, {
          coat: pet.pet.coat,
          seed: pet.pet.id,
          model,
          onFrame: (now, s) => game.tick(now, s),
          getProps: () => game.props(),
          onPointer: {
            down: (x, y, realMs, hit) => game.pointerDown(x, y, realMs, hit),
            move: (x, y, _realMs, hit) => game.pointerMove(x, y, hit),
            up: (realMs, hit) => game.pointerUp(realMs, hit),
          },
        });
        if (cancelled) {
          created.destroy();
          return;
        }
        scene = created;
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('failed');
      }
    })();

    return () => {
      cancelled = true;
      scene?.destroy();
    };
    // The stage is mounted per pet: a different pet id gives a fresh scene and game.
  }, [pet.pet.id]);

  return (
    <>
      <div class="stage" ref={host} />
      {status !== 'ready' && (
        <p class="stage-note" role="status">
          {status === 'loading' ? t('stage.loading') : status === 'unsupported' ? t('stage.unsupported') : t('stage.failed')}
        </p>
      )}
    </>
  );
}
