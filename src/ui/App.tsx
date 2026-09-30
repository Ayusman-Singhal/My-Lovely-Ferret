import { useEffect, useRef, useState } from 'preact/hooks';
import type { CommandResult } from '../core/commands';
import { createPet } from '../core/pet';
import { createScaledClock } from '../core/time';
import type { FoodId } from '../core/types';
import { createGame, type Game } from '../game/controller';
import { createScene } from '../render/scene';

// Phase 1 work in progress. The canvas is mounted once and owned by the renderer, Preact never
// re-renders it (guide §4.4). The pet is a throwaway in-memory pet and the buttons below are a
// TEMPORARY test bar: the real HUD, action bar, and save come in Part 1G.
//
// Preview options: ?pet=<any text> picks a different pet (traits and coat come from the id),
//                  ?speed=60 runs game time 60x faster (watch sleep and daily events),
//                  ?debug=1 shows what the pet is thinking.

const FOOD_ROTATION: FoodId[] = ['chicken', 'egg', 'salmon', 'kibble'];

function describe(result: CommandResult): string {
  const o = result.outcome;
  if (!o.ok) {
    return {
      invalid: 'That did not work.',
      not_hungry: 'Not hungry right now.',
      not_thirsty: 'Not thirsty right now.',
      too_tired: 'Too tired to play.',
      not_sleepy: 'Not sleepy yet.',
      no_play_started: 'No game was running.',
    }[o.reason];
  }
  return o.bondGain > 0 ? `Nice! Bond +${(o.bondGain / 100).toFixed(1)}.` : 'Done.';
}

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [, redraw] = useState(0);
  const [message, setMessage] = useState('');
  const feeds = useRef(0);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const params = new URLSearchParams(window.location.search);
    const speed = Math.min(600, Math.max(1, Number(params.get('speed')) || 1));
    const clock = createScaledClock(() => Date.now(), () => performance.now(), speed);

    let overlay: HTMLDivElement | null = null;
    if (params.has('debug')) {
      overlay = document.createElement('div');
      overlay.style.cssText =
        'position:fixed;left:6px;top:6px;font:11px/1.3 monospace;background:#fffc;padding:4px 6px;border-radius:4px;white-space:pre;z-index:9';
      document.body.appendChild(overlay);
    }

    const game = createGame({
      pet: createPet({
        id: params.get('pet') ?? 'demo-pet-1',
        name: 'Mochi',
        nowMs: clock.nowMs(),
        tzOffsetMin: -new Date().getTimezoneOffset(),
        deviceId: 'preview',
      }),
      clock,
      onChange: () => redraw((n) => n + 1),
      onDecision: (p) => {
        redraw((n) => n + 1);
        if (overlay) {
          const t = p.personality;
          const s = p.state;
          overlay.textContent =
            `${p.pet.coat}  mischief ${t.mischief}  curiosity ${t.curiosity}  affection ${t.affection}\n` +
            `hunger ${Math.floor(s.hunger / 100)}  water ${Math.floor(s.hydration / 100)}  energy ${Math.floor(s.energy / 100)}  happy ${Math.floor(s.happiness / 100)}  bond ${Math.floor(s.bond / 100)}\n` +
            `${s.sleepState}  ${game.brain.current()?.behavior ?? ''}  game time ${new Date(clock.nowMs()).toISOString().slice(0, 16).replace('T', ' ')}  x${speed}`;
        }
      },
      onPlayEnd: (r) =>
        setMessage(`Played! ${r.catches} catches, band ${r.band}.${r.result.outcome.ok && r.result.outcome.rewarded ? '' : ' (No reward: played recently.)'}`),
    });
    gameRef.current = game;
    // Dev only: lets scripts and the console inspect the game (`__game.getPet()`, `__game.minigame()`).
    if (params.has('debug')) (window as unknown as { __game: Game }).__game = game;

    const scene = createScene(el, {
      coat: game.getPet().pet.coat,
      seed: game.getPet().pet.id,
      onFrame: (now, s) => game.tick(now, s),
      onDraw: (ctx) => game.draw(ctx),
      onPointer: {
        down: (x, y, realMs) => game.pointerDown(x, y, realMs),
        move: (x, y) => game.pointerMove(x, y),
        up: (realMs) => game.pointerUp(realMs),
      },
    });
    return () => {
      scene.destroy();
      overlay?.remove();
      gameRef.current = null;
    };
  }, []);

  const game = gameRef.current;
  const pet = game?.getPet();
  const playing = game?.minigame() != null;
  const say = (r: CommandResult): void => setMessage(describe(r));

  return (
    <main class="frame">
      <div class="stage" ref={host} />
      {game && pet && (
        <div class="testbar" role="group" aria-label="Test controls">
          <p class="testmsg" aria-live="polite">
            {playing ? 'Drag the toy! Stop it to let the ferret catch it.' : message || 'Tap the pet. Long press or tap 3 times to pet it.'}
          </p>
          <div class="testbtns">
            <button type="button" disabled={playing} onClick={() => say(game.dispatch({ type: 'FeedPet', foodId: FOOD_ROTATION[feeds.current++ % 4] as FoodId }))}>
              Feed
            </button>
            <button type="button" disabled={playing} onClick={() => say(game.dispatch({ type: 'GiveWater' }))}>
              Water
            </button>
            <button type="button" disabled={playing} onClick={() => say(game.startPlay(pet.state.favoriteToy))}>
              Play
            </button>
            <button type="button" disabled={playing} onClick={() => say(game.dispatch({ type: 'PutToBed' }))}>
              Bed
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
