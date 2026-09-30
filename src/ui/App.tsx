import { useEffect, useRef } from 'preact/hooks';
import { createPet } from '../core/pet';
import type { AIWorld } from '../core/petAI';
import { createScaledClock } from '../core/time';
import type { PetRecord } from '../core/types';
import { createBrain } from '../render/brain';
import { drawSock } from '../render/props';
import { ROOM } from '../render/room';
import { createScene } from '../render/scene';

// Phase 1 work in progress. The canvas is mounted once and owned by the renderer, Preact never
// re-renders it (guide §4.4). The pet here is a throwaway in-memory pet: the real one comes
// from the save in Part 1G, together with the HUD and action bar.
//
// Preview options: ?pet=<any text> picks a different pet (traits and coat come from the id),
//                  ?speed=60 runs game time 60x faster (watch sleep and daily events),
//                  ?debug=1 shows what the pet is thinking.
export function App() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const params = new URLSearchParams(window.location.search);
    const speed = Math.min(600, Math.max(1, Number(params.get('speed')) || 1));
    const clock = createScaledClock(() => Date.now(), () => performance.now(), speed);

    let pet: PetRecord = createPet({
      id: params.get('pet') ?? 'demo-pet-1',
      name: 'Mochi',
      nowMs: clock.nowMs(),
      tzOffsetMin: -new Date().getTimezoneOffset(),
      deviceId: 'preview',
    });

    // TEMPORARY until the feed and water commands exist (Part 1F): bowls are always stocked.
    const world: AIWorld = { foodInBowl: true, waterInBowl: true, hasToy: true, hasStealable: true, propNearby: false, pointerInRoom: false };

    let overlay: HTMLDivElement | null = null;
    if (params.has('debug')) {
      overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;left:6px;top:6px;font:11px/1.3 monospace;background:#fffc;padding:4px 6px;border-radius:4px;white-space:pre;z-index:9';
      document.body.appendChild(overlay);
    }

    const brain = createBrain({
      pet: { get: () => pet, set: (p) => (pet = p) },
      clock,
      world,
      eatingSatisfiesNeeds: true, // TEMPORARY until Part 1F
      onDecision: (d, p) => {
        if (overlay) {
          const t = p.personality;
          overlay.textContent = `${p.pet.coat}  mischief ${t.mischief}  curiosity ${t.curiosity}  affection ${t.affection}\n${d.behavior}${p.state.sleepState === 'asleep' ? ' (asleep)' : ''}  hunger ${Math.floor(p.state.hunger / 100)}  energy ${Math.floor(p.state.energy / 100)}\ngame time ${new Date(clock.nowMs()).toISOString().slice(0, 16).replace('T', ' ')}  x${speed}`;
        }
      },
    });

    const scene = createScene(el, {
      coat: pet.pet.coat,
      seed: pet.pet.id,
      onFrame: (now, s) => brain.tick(now, s),
      onDraw: (ctx) => {
        if (!brain.sock.carried) drawSock(ctx, brain.sock.x, ROOM.groundY);
      },
    });
    return () => {
      scene.destroy();
      overlay?.remove();
    };
  }, []);

  return (
    <main class="frame">
      <div class="stage" ref={host} />
    </main>
  );
}
