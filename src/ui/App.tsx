import { useEffect, useRef } from 'preact/hooks';
import { createDemoBrain } from '../render/demoBrain';
import { createScene } from '../render/scene';

// Phase 1 work in progress. The canvas is mounted once and owned by the renderer, Preact
// never re-renders it (guide §4.4). The demo brain is temporary until PetAI exists (Part 1E),
// and the real HUD, action bar, and pet come from the save in Part 1G.
export function App() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const scene = createScene(host.current, { coat: 'sable', seed: 'demo-pet', onFrame: createDemoBrain() });
    return () => scene.destroy();
  }, []);

  return (
    <main class="frame">
      <div class="stage" ref={host} />
    </main>
  );
}
