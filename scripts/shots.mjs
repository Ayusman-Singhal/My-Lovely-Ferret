// Dev tool: screenshots of the rig gallery and of the running app at phone size, written to
// shots/ (git-ignored). Uses the Chrome installed on this machine through playwright-core,
// so nothing is downloaded. Run: node scripts/shots.mjs
// Headless Chrome uses software rendering: fine for looks, not for frame-rate numbers.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

mkdirSync('shots', { recursive: true });
const server = await createServer({ logLevel: 'error', server: { port: 5177, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true });

try {
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text());
    });
  };

  const gallery = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  watch(gallery);
  await gallery.goto('http://localhost:5177/dev/gallery.html', { waitUntil: 'networkidle' });
  await gallery.screenshot({ path: 'shots/gallery.png', fullPage: true });

  const app = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  watch(app);
  await app.goto('http://localhost:5177/', { waitUntil: 'networkidle' });
  for (const [waitMs, name] of [[1500, 'start'], [12000, 'later']]) {
    await app.waitForTimeout(waitMs);
    await app.screenshot({ path: `shots/app-${name}.png` });
  }
  console.log(errors.length ? `errors: ${errors.join(' | ')}` : 'no page errors. Screenshots in shots/');
} finally {
  await browser.close();
  await server.close();
}
