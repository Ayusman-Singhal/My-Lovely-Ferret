// End-to-end smoke test in real Chrome (guide §19): first run, naming, caring, the mini-game,
// a reload that keeps the pet, a backup export, and the welcome-back summary after time away.
// Run after a build: npm run build && npm run smoke. Uses the Chrome installed on the machine
// (playwright-core, no download). Screenshots go to shots/ (git-ignored).
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

mkdirSync('shots', { recursive: true });
const server = await preview({ logLevel: 'error', preview: { port: 5188, strictPort: true } });
const url = 'http://localhost:5188/';
// Software WebGL flags: CI runners have no GPU, and the 3D pet needs a WebGL context.
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, acceptDownloads: true });
const errors = [];
const watch = (page) => {
  page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('404')) errors.push(`console: ${m.text()}`);
  });
};
let step = 0;
const ok = (condition, message) => {
  if (!condition) throw new Error(`FAILED step ${step}: ${message}`);
  console.log(`  ok  ${message}`);
};
const stepName = (name) => {
  step++;
  console.log(`${step}. ${name}`);
};

try {
  const page = await context.newPage();
  watch(page);

  stepName('first run shows the two adoption buttons over the room');
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Adopt a pet' }).waitFor();
  ok(await page.getByRole('button', { name: "Care for a friend's pet" }).isDisabled(), "friend's pet is disabled for now");
  await page.locator('canvas').first().waitFor({ timeout: 30000 });
  ok((await page.locator('canvas').count()) === 1, 'the 3D room and ferret canvas is on screen');
  await page.screenshot({ path: 'shots/smoke-1-adopt.png' });

  stepName('naming: empty and too-long names are refused with a clear message');
  await page.getByRole('button', { name: 'Adopt a pet' }).click();
  await page.getByLabel('Name').fill('');
  await page.getByRole('button', { name: 'Continue' }).click();
  ok((await page.locator('#name-error').textContent()).includes('type a name'), 'empty name shows an error');
  await page.getByLabel('Name').fill('x'.repeat(17));
  await page.getByRole('button', { name: 'Continue' }).click();
  ok((await page.locator('#name-error').textContent()).includes('too long'), 'a 17 character name is too long');
  await page.getByLabel('Name').fill('👨‍👩‍👧‍👦'.repeat(16)); // 16 clusters, many code units each
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('heading', { name: /^Meet / }).waitFor();
  ok(true, 'sixteen emoji clusters is accepted (counted as characters, not bytes)');

  stepName('start over with a normal name and read the introduction');
  await page.goto(url, { waitUntil: 'networkidle' }); // the emoji pet was never confirmed, so nothing was saved
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Adopt a pet' }).click();
  await page.getByLabel('Name').fill('Mochi');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('heading', { name: 'Meet Mochi' }).waitFor();
  ok((await page.locator('.summary li').count()) === 4, 'three personality lines and a favorites line');
  await page.screenshot({ path: 'shots/smoke-2-intro.png' });
  await page.getByRole('button', { name: "Let's go" }).click();

  stepName('home: the needs are shown as icon, label, number, and level word');
  await page.locator('.meter').first().waitFor();
  ok((await page.locator('.meter').count()) === 4, 'four meters');
  const meterLabel = await page.locator('.meter').first().getAttribute('aria-label');
  ok(/Hunger: \d+ out of 100, (low|okay|good)/.test(meterLabel), `a meter has a full text label (${meterLabel})`);
  ok((await page.locator('.action').count()) === 4, 'four action buttons');
  ok((await page.locator('.status').textContent()).includes('Tap Feed'), 'the first hint points at Feed');
  const box = await page.locator('.action').first().boundingBox();
  ok(box.height >= 44 && box.width >= 44, `touch targets are at least 44 px (${Math.round(box.width)} x ${Math.round(box.height)})`);
  await page.screenshot({ path: 'shots/smoke-3-home.png' });

  stepName('care: feeding, the hint moving on, and a refusal');
  await page.getByRole('button', { name: 'Water' }).click();
  await page.getByRole('button', { name: 'Feed' }).click();
  await page.waitForTimeout(300);
  ok((await page.locator('.status').textContent()).length > 0, 'a message answers the tap');
  await page.getByRole('button', { name: 'Feed' }).click();
  await page.getByRole('button', { name: 'Feed' }).click();
  ok((await page.locator('.status').textContent()).includes('not hungry'), 'feeding a full pet is politely refused');

  stepName('play: the toy-chase mini-game runs about 20 seconds, then reports a result');
  await page.getByRole('button', { name: 'Play' }).click();
  ok((await page.locator('.status').textContent()).includes('Drag the toy'), 'instructions are shown');
  ok(await page.getByRole('button', { name: 'Feed' }).isDisabled(), 'other actions wait while playing');
  const stage = await page.locator('.stage > div').boundingBox();
  const px = (x) => stage.x + (x / 360) * stage.width;
  const py = stage.y + (400 / 540) * stage.height; // just above the floor line the pet stands on
  await page.mouse.move(px(200), py);
  await page.mouse.down();
  const t0 = Date.now();
  while (Date.now() - t0 < 21500) {
    const phase = Math.floor((Date.now() - t0) / 2000) % 2;
    await page.mouse.move(px(phase === 0 ? 150 : 260), py, { steps: 6 });
    await page.waitForTimeout(1000);
  }
  await page.mouse.up();
  await page.waitForTimeout(600);
  const result = await page.locator('.status').textContent();
  ok(/caught the toy \d+ times/.test(result), `the result is shown (${result})`);

  stepName('the pet stays after a reload (saved on its own)');
  await page.waitForTimeout(2500); // the debounced autosave
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Mochi' }).waitFor();
  ok((await page.getByRole('button', { name: 'Adopt a pet' }).count()) === 0, 'no adoption screen the second time');
  ok(!(await page.locator('.status').textContent()).includes('Tap Feed'), 'the Feed hint is gone: the count was saved');
  await page.screenshot({ path: 'shots/smoke-4-reload.png' });

  stepName('backup: export gives a file with a checksum and no install id');
  await page.getByRole('button', { name: 'Menu' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export backup' }).click()]);
  const path = await download.path();
  const text = readFileSync(path, 'utf8');
  const file = JSON.parse(text);
  ok(download.suggestedFilename().startsWith('ferret-backup-'), `file name ${download.suggestedFilename()}`);
  ok(file.format === 'ferret-backup' && typeof file.checksum === 'string', 'it is a Ferret backup with a checksum');
  ok(!text.includes('installId'), 'no installId inside');
  ok(file.save.pets[0].pet.name === 'Mochi', 'it holds the pet');
  await page.getByRole('button', { name: 'Close' }).click();
  await page.close();

  stepName('coming back after 8 hours shows a warm summary');
  const later = await context.newPage();
  watch(later);
  await later.clock.install({ time: Date.now() + 8 * 3600 * 1000 });
  await later.goto(url, { waitUntil: 'networkidle' });
  await later.getByRole('dialog', { name: 'Welcome back!' }).waitFor();
  const lines = await later.locator('.summary li').allTextContents();
  ok(lines.length >= 2 && lines.every((l) => l.includes('Mochi')), `summary: ${lines.join(' | ')}`);
  ok(!lines.join(' ').match(/hours (away|since)|days/), 'it never talks about how long you were gone');
  await later.screenshot({ path: 'shots/smoke-5-welcome.png' });
  await later.getByRole('button', { name: 'OK' }).click();
  await later.getByRole('dialog').waitFor({ state: 'detached' });

  stepName('tester tools: About my pet, feedback, the hidden developer tools, copy error details');
  // The page from step 9 is still open (8 hours later), which is a good moment to look at the counters.
  await later.getByRole('button', { name: 'Menu' }).click();
  await later.getByRole('button', { name: 'About my pet' }).click();
  const about = later.getByRole('dialog', { name: /About Mochi/ });
  await about.waitFor();
  const aboutText = await about.textContent();
  ok(/Day \d+ together/.test(aboutText ?? ''), 'it says which day it is');
  ok(/meals: [1-9]/.test(aboutText ?? ''), 'it counts the meal fed in step 5');
  ok(/games: [1-9]/.test(aboutText ?? ''), 'it counts the game played in step 6');
  ok(/opened the game [2-9]\d* times/.test(aboutText ?? ''), 'it counts the sessions');
  ok((aboutText ?? '').includes('stay on your device'), 'it says the numbers stay on the device');
  await later.getByRole('button', { name: 'Close' }).click();

  await later.getByRole('button', { name: 'Send feedback' }).click();
  const feedback = later.getByRole('dialog', { name: 'Send feedback' });
  await feedback.waitFor();
  await feedback.getByRole('textbox').fill('So cute!');
  await feedback.getByText('What will be sent').click();
  const preview = (await feedback.locator('.preview').textContent()) ?? '';
  ok(preview.startsWith('So cute!') && preview.includes('Sessions:') && preview.includes('Things done: feed'), 'the preview has the message and the counters');
  ok(!/install/i.test(preview), 'no install id in the feedback');
  await feedback.getByRole('button', { name: 'Copy feedback' }).click();
  await feedback.getByRole('status').filter({ hasText: /Copied|Could not copy/ }).waitFor();
  ok(true, 'copying answers with a message');
  await feedback.getByRole('button', { name: 'Close' }).click();

  ok((await later.getByRole('button', { name: 'Developer tools' }).count()) === 0, 'developer tools are hidden at first');
  for (let i = 0; i < 7; i++) await later.getByText(/Preview build/).click();
  ok((await later.getByRole('button', { name: 'Developer tools' }).count()) === 1, 'seven taps on the version line reveal them');
  await later.getByRole('button', { name: 'Close' }).last().click();

  await later.evaluate(() => { void Promise.reject(new Error('smoke test error')); });
  await later.getByRole('alert').waitFor();
  await later.getByRole('button', { name: 'Copy error details' }).click();
  await later.getByText('Copied. Please send it to us.').waitFor();
  await later.getByRole('button', { name: 'Dismiss' }).click();
  errors.length = 0; // the error above was thrown on purpose
  await later.close();

  stepName('developer tools in a preview: clock, needs, behaviors');
  const dev = await context.newPage();
  watch(dev);
  await dev.goto(`${url}?pet=devtest&dev=1`, { waitUntil: 'networkidle' });
  await dev.getByRole('button', { name: 'Menu' }).click();
  await dev.getByRole('button', { name: 'Developer tools' }).click();
  const panel = dev.getByRole('dialog', { name: 'Developer tools' });
  await panel.waitFor();
  await panel.getByRole('button', { name: '+8 hours' }).first().click();
  await panel.getByText('Clock moved forward by 8 hours.').waitFor();
  ok(true, 'the clock moves by hand');
  await panel.getByLabel(/^hunger/).fill('12');
  await dev.waitForTimeout(200);
  await panel.getByRole('button', { name: 'Close' }).last().click();
  await dev.getByRole('button', { name: 'Close' }).click();
  ok(((await dev.getByRole('list', { name: 'Needs' }).textContent()) ?? '').includes('12'), 'the hunger meter follows the slider');
  await dev.close();

  stepName('iPhone in the browser: the Home Screen notice, once');
  const iphone = await browser.newContext({
    viewport: { width: 390, height: 780 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    hasTouch: true,
  });
  const phone = await iphone.newPage();
  watch(phone);
  await phone.goto(`${url}?pet=ios`, { waitUntil: 'networkidle' });
  await phone.getByText(/Add this page to your Home Screen/).waitFor();
  await phone.screenshot({ path: 'shots/smoke-6-ios.png' });
  await phone.getByRole('button', { name: 'Got it' }).click();
  ok((await phone.getByText(/Add this page to your Home Screen/).count()) === 0, 'the notice goes away');
  await phone.reload({ waitUntil: 'networkidle' });
  await phone.getByRole('button', { name: 'Menu' }).waitFor();
  ok((await phone.getByText(/Add this page to your Home Screen/).count()) === 0, 'and stays away after a reload');
  await iphone.close();

  stepName('no errors in the console');
  ok(errors.length === 0, errors.length ? errors.join(' | ') : 'clean');
  console.log('\nSmoke test passed.');
} catch (e) {
  console.error(`\n${e.message}`);
  if (errors.length) console.error(`Errors seen: ${errors.join(' | ')}`);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
