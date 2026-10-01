// The ferret model file. Starting the download from here, before the three.js code has arrived,
// lets the two downloads overlap (docs/PERFORMANCE.md §3.2). Kept free of three.js so the UI can
// import it at once.

import ferretUrl from '../../animation/export/ferret.glb?url';

let pending: Promise<ArrayBuffer> | null = null;

export function fetchFerretModel(): Promise<ArrayBuffer> {
  pending ??= fetch(ferretUrl).then((response) => {
    if (!response.ok) throw new Error(`Could not load the ferret model (${response.status})`);
    return response.arrayBuffer();
  });
  // A failed download must be retried by the next caller, not remembered.
  pending.catch(() => {
    pending = null;
  });
  return pending;
}
