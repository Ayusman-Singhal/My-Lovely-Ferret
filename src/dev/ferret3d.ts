// Dev-only spike entry (Part 1K.3). Starts the ferret model download at once, then loads the
// three.js code in parallel, so the two downloads overlap and the page can show its loading
// text before the 600 KB of three.js has been parsed. The real game should do the same.
import ferretUrl from '../../animation/export/ferret.glb?url';

const entry = performance.now();
const model = fetch(ferretUrl)
  .then((response) => response.arrayBuffer())
  .then((bytes) => ({ bytes, at: performance.now() }));

const [scene, loaded] = await Promise.all([import('./ferret3dScene'), model]);
scene.start(loaded.bytes, { entry, model: loaded.at });
