import { render } from 'preact';
import { App } from './ui/App';
import './ui/app.css';
import { fetchFerretModel } from './render/modelAsset';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app root element');
render(<App />, root);

// Start the two big downloads now, before the first screen needs the pet: the model file and the
// lazy three.js code. They then overlap each other and the boot (docs/PERFORMANCE.md §3.2).
void import('./render/scene3d').catch(() => undefined);
void fetchFerretModel().catch(() => undefined);
