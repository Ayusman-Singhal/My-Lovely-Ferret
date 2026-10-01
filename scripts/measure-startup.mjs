/* global window, performance, document */
// Startup measurement (docs/PERFORMANCE.md §3.2). Two modes:
//   node scripts/measure-startup.mjs [runs] spike   the dev-only page dev/ferret3d.html (default)
//   node scripts/measure-startup.mjs [runs] app     the real app, built into dist/, at /?pet=measure
// It builds, serves the output with gzip (like GitHub Pages does), and drives the Chrome installed
// on this machine through playwright-core.
//
// Numbers printed:
//  - JS gzip (entry chunk plus static imports, same rule as scripts/check-budgets.mjs)
//  - asset sizes, raw and gzip
//  - time until the first model frame is on the canvas ("scene ready"), unthrottled and under
//    slow 4G (1.6 Mbps, 150 ms) plus 4x CPU slowdown, median of N runs, cache off
//  - frames drawn while paused (must be 0, a settled scene costs nothing)
// Headless Chrome renders WebGL in software, so frame rate is not measured and the ready
// time is a pessimistic proxy for a phone GPU, not a replacement for a real-phone check.
import { mkdirSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright-core';
import { build } from 'vite';

const RUNS = Number(process.argv[2] ?? 5);
const PORT = 5178;
const MODE = process.argv[3] === 'app' ? 'app' : 'spike';
const OUT = MODE === 'app' ? 'dist' : 'dist-spike';
const counted = JSON.parse(readFileSync('scripts/budgets.json', 'utf8')).countedLazyEntries ?? [];

await build(MODE === 'app' ? { logLevel: 'error' } : { configFile: 'vite.spike.config.ts', logLevel: 'error' });

// ---- sizes ----
const manifest = JSON.parse(readFileSync(join(OUT, '.vite/manifest.json'), 'utf8'));
const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry);
const seen = new Set();
const jsFiles = [];
const visit = (key) => {
  if (seen.has(key)) return;
  seen.add(key);
  const chunk = manifest[key];
  if (chunk.file.endsWith('.js')) jsFiles.push(chunk.file);
  for (const dep of chunk.imports ?? []) visit(dep);
};
visit(entryKey);
if (MODE === 'app') {
  // The 3D scene is lazy but needed for the first pet frame, so it counts (scripts/check-budgets.mjs).
  for (const [key, chunk] of Object.entries(manifest)) {
    if (chunk.isDynamicEntry && counted.some((name) => (chunk.src ?? key).endsWith(name))) visit(key);
  }
}
const gz = (buf) => gzipSync(buf, { level: 9 }).length;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
let jsGzip = 0;
let jsRaw = 0;
for (const file of jsFiles) {
  const buf = readFileSync(join(OUT, file));
  jsGzip += gz(buf);
  jsRaw += buf.length;
}
console.log(`JS: ${kb(jsRaw)} raw, ${kb(jsGzip)} gzip (${jsFiles.length} file${jsFiles.length === 1 ? '' : 's'})`);
const assetDir = join(OUT, 'assets');
for (const name of readdirSync(assetDir)) {
  if (name.endsWith('.js')) continue;
  const buf = readFileSync(join(assetDir, name));
  console.log(`asset ${name}: ${kb(buf.length)} raw, ${kb(gz(buf))} gzip`);
}

// ---- static server with gzip ----
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png' };
const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const file = join(OUT, path === '/' ? (MODE === 'app' ? 'index.html' : 'dev/ferret3d.html') : path);
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end();
    return;
  }
  const ext = extname(file);
  const body = readFileSync(file);
  const compress = ['.html', '.js', '.css', '.glb', '.json'].includes(ext);
  res.writeHead(200, { 'content-type': types[ext] ?? 'application/octet-stream', ...(compress ? { 'content-encoding': 'gzip' } : {}) });
  res.end(compress ? gzipSync(body) : body);
});
await new Promise((resolve) => server.listen(PORT, resolve));
const url = MODE === 'app' ? `http://localhost:${PORT}/?pet=measure&debug=1` : `http://localhost:${PORT}/dev/ferret3d.html`;

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
const errors = [];

async function run(throttled) {
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === "error") errors.push(`${m.text()} ${m.location().url}`);
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (throttled) {
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  await page.goto(url, { waitUntil: 'commit' });
  let readyMs;
  let marks;
  if (MODE === 'app') {
    // Loading text visible = first useful paint. Ready = the 3D canvas exists and the text is gone.
    // Polled every 50 ms, so numbers are good to about that.
    const textAt = await page.waitForFunction(() => (document.querySelector('.stage-note') ? performance.now() : false), undefined, { timeout: 120000, polling: 50 });
    readyMs = await (await page.waitForFunction(() => (document.querySelector('canvas') && !document.querySelector('.stage-note') ? performance.now() : false), undefined, { timeout: 120000, polling: 50 })).jsonValue();
    marks = { entry: await textAt.jsonValue(), model: 0, three: 0, firstDraw: readyMs };
  } else {
    await page.waitForFunction(() => window.__spike?.ready === true, undefined, { timeout: 120000, polling: 50 });
    readyMs = await page.evaluate(() => window.__spike.readyMs);
    marks = await page.evaluate(() => window.__spike.marks);
  }
  const transfer = await page.evaluate(() => performance.getEntriesByType('resource').reduce((sum, e) => sum + e.transferSize, 0));
  return { page, context, readyMs, transfer, marks };
}

try {
  mkdirSync('shots', { recursive: true });
  const free = [];
  for (let i = 0; i < Math.max(3, RUNS - 2); i++) {
    const r = await run(false);
    free.push(r.readyMs);
    await r.context.close();
  }
  const slow = [];
  const phases = [];
  let transfer = 0;
  let last;
  for (let i = 0; i < RUNS; i++) {
    // Close the previous page first: its render loop would compete for the (software) GPU and CPU.
    if (last) await last.context.close();
    const r = await run(true);
    slow.push(r.readyMs);
    phases.push(r.marks);
    transfer = r.transfer;
    last = r;
  }
  console.log(`scene ready, no throttle:           median ${median(free).toFixed(0)} ms  (${free.map((v) => v.toFixed(0)).join(', ')})`);
  console.log(`scene ready, slow 4G + 4x CPU:      median ${median(slow).toFixed(0)} ms  (${slow.map((v) => v.toFixed(0)).join(', ')})`);
  const m = (key) => median(phases.map((p) => p[key])).toFixed(0);
  console.log(MODE === 'app' ? `  loading text visible (median): ${m('entry')} ms` : `  phases (median): entry script ran ${m('entry')} ms, model bytes arrived ${m('model')} ms, three.js code ready ${m('three')} ms, first draw done ${m('firstDraw')} ms`);
  console.log(`bytes over the wire (last run):     ${kb(transfer)}`);

  const { page } = last;
  if (MODE === 'app') {
    await page.screenshot({ path: 'shots/measure-app.png' });
    console.log(errors.length ? `PAGE ERRORS: ${errors.join(' | ')}` : 'no page errors');
    process.exitCode = 0;
    throw new Error('__done__');
  }
  // A settled scene must cost nothing: pause, then count frames for 2 seconds.
  await page.evaluate(() => window.__spike.pause(true));
  const before = await page.evaluate(() => window.__spike.frames);
  await page.waitForTimeout(2000);
  const after = await page.evaluate(() => window.__spike.frames);
  console.log(`frames drawn while paused for 2 s:  ${after - before} (must be 0)`);
  const stats = await page.evaluate(() => ({ tris: window.__spike.triangles, calls: window.__spike.drawCalls, clips: window.__spike.clips }));
  console.log(`scene: ${stats.tris} triangles, ${stats.calls} draw calls, ${stats.clips} clips`);
  await page.evaluate(() => window.__spike.pause(false));
  // Stills of a few clips to look at (shots/ is git-ignored). Time is stepped by hand, so the
  // result does not depend on how slow the software renderer is.
  for (const [clip, kind, seconds] of [['idle', 'base', 0.8], ['walk', 'base', 0.15], ['sleep', 'base', 1.5], ['run', 'base', 0.1], ['idle', 'happy', 0.45], ['idle', 'blink', 0.08]]) {
    await page.evaluate(([c, k]) => {
      const spike = window.__spike;
      spike.pause(true);
      spike.setBase(c);
      if (k !== 'base') spike.react(k);
    }, [clip, kind]);
    await page.evaluate(() => window.__spike.step(0.5)); // finish the 0.2 s crossfade
    await page.evaluate((s) => window.__spike.step(s), seconds);
    await page.screenshot({ path: `shots/spike-${clip}${kind === 'base' ? '' : `-${kind}`}.png` });
  }
  console.log(errors.length ? `PAGE ERRORS: ${errors.join(' | ')}` : 'no page errors');
} catch (error) {
  if (!(error instanceof Error) || error.message !== '__done__') throw error;
} finally {
  await browser.close();
  server.close();
}
