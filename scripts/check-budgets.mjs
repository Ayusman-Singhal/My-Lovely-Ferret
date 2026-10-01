// Bundle budget check (guide §4.2). Zero dependencies on purpose.
// Initial JS = the entry chunk plus everything it imports statically, plus the lazy chunks listed
// in budgets.json under "countedLazyEntries". The 3D scene is lazy (so the loading text shows before
// three.js is parsed) but needed for the first pet frame, so it must be counted or the budget would
// hide it. Other dynamic imports (Firebase, lazy screens) get their own budgets later.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const dist = new URL('../dist/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('.vite/manifest.json', dist), 'utf8'));
const budgets = JSON.parse(readFileSync(new URL('./budgets.json', import.meta.url), 'utf8'));

const entry = Object.values(manifest).find((chunk) => chunk.isEntry);
if (!entry) {
  console.error('No entry chunk in dist/.vite/manifest.json. Run "npm run build" first.');
  process.exit(1);
}

const counted = budgets.countedLazyEntries ?? [];
const seen = new Set();
const files = [];
const visit = (key) => {
  if (seen.has(key)) return;
  seen.add(key);
  const chunk = manifest[key];
  if (chunk.file.endsWith('.js')) files.push(chunk.file);
  for (const dep of chunk.imports ?? []) visit(dep);
};
const entryKey = Object.keys(manifest).find((key) => manifest[key] === entry);
visit(entryKey);
for (const [key, chunk] of Object.entries(manifest)) {
  if (chunk.isDynamicEntry && counted.some((name) => (chunk.src ?? key).endsWith(name))) visit(key);
}

let totalGzip = 0;
for (const file of files) {
  const gz = gzipSync(readFileSync(new URL(file, dist))).length;
  totalGzip += gz;
  console.log(`  ${file}  ${(gz / 1024).toFixed(2)} KB gzip`);
}

const totalKB = totalGzip / 1024;
const limitKB = budgets.initialJsGzipKB;
console.log(`Initial JS: ${totalKB.toFixed(2)} KB gzip (budget ${limitKB} KB)`);
if (totalKB > limitKB) {
  console.error(`Budget exceeded by ${(totalKB - limitKB).toFixed(2)} KB.`);
  process.exit(1);
}
