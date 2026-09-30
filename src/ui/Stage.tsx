import { useEffect, useRef } from 'preact/hooks';
import type { Clock } from '../core/time';
import type { PetRecord } from '../core/types';
import { createGame, type Game, type GameOptions } from '../game/controller';
import { createScene } from '../render/scene';

interface StageProps {
  pet: PetRecord;
  clock: Clock;
  /** Callbacks for the game. Read once when the stage mounts. */
  options?: Omit<GameOptions, 'pet' | 'clock'>;
  onGame?(game: Game): void;
}

/**
 * Mounts the canvas scene once. The canvas belongs to the renderer: Preact never re-renders it and
 * never drives its animation (guide §4.4). It is remounted only when the pet itself changes.
 */
export function Stage({ pet, clock, options, onGame }: StageProps) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const game = createGame({ ...options, pet, clock });
    const scene = createScene(el, {
      coat: pet.pet.coat,
      seed: pet.pet.id,
      onFrame: (now, s) => game.tick(now, s),
      onDraw: (ctx) => game.draw(ctx),
      onPointer: {
        down: (x, y, realMs) => game.pointerDown(x, y, realMs),
        move: (x, y) => game.pointerMove(x, y),
        up: (realMs) => game.pointerUp(realMs),
      },
    });
    onGame?.(game);
    // Dev only: `?debug=1` lets scripts and the console inspect the game (`__game.getPet()`).
    if (new URLSearchParams(window.location.search).has('debug')) (window as unknown as { __game: Game }).__game = game;
    return () => scene.destroy();
    // The stage is mounted per pet: a different pet id gives a fresh scene and game.
  }, [pet.pet.id]);

  return <div class="stage" ref={host} />;
}
