import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Firebase must never enter the initial bundle (guide §4.3, §18 rule 11). Static imports
// are banned everywhere except src/sync/firebase. Dynamic import() is not covered by
// no-restricted-imports, so lazy loading stays allowed.
const firebasePatterns = [
  { group: ['firebase', 'firebase/*', '@firebase/*'], message: 'Load Firebase only via dynamic import() from src/sync/firebase (guide §4.3).' },
  { group: ['**/sync/firebase', '**/sync/firebase/**'], message: 'Only dynamic import() may reach src/sync/firebase (guide §4.3).' },
];

// src/core is pure TypeScript: no DOM, UI, renderer, platform, or network (guide §0, §18).
const corePatterns = [
  ...firebasePatterns,
  { group: ['preact', 'preact/*', 'pixi.js', 'pixi.js/*', '@pixi/*'], message: 'src/core must not import UI or renderer libraries.' },
  { group: ['**/render', '**/render/**', '**/ui', '**/ui/**', '**/platform', '**/platform/**', '**/sync', '**/sync/**', '**/i18n', '**/i18n/**'], message: 'src/core must not import from render, ui, platform, sync, or i18n.' },
];

const bannedGlobals = [
  'window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage',
  'indexedDB', 'performance', 'fetch', 'setTimeout', 'setInterval', 'requestAnimationFrame',
].map((name) => ({ name, message: 'src/core is pure and deterministic: no DOM, timers, or network (guide §7.2).' }));

// Results of these can differ slightly between JS engines (guide §7.2). Math.random is not seeded.
const bannedMath = [
  'random', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh',
  'exp', 'expm1', 'log', 'log2', 'log10', 'log1p', 'pow', 'cbrt', 'hypot',
].map((property) => ({
  object: 'Math',
  property,
  message: 'Not deterministic across engines. Use integer arithmetic and the seeded RNG (guide §7.2).',
}));

export default [
  { ignores: ['dist/', 'node_modules/', 'coverage/', '.vite/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['src/sync/firebase/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: firebasePatterns }],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: corePatterns }],
      'no-restricted-globals': ['error', ...bannedGlobals],
      'no-restricted-properties': [
        'error',
        ...bannedMath,
        { object: 'Date', property: 'now', message: 'Time is passed into src/core, never read (guide §7.2).' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "BinaryExpression[operator='**']", message: 'Exponentiation is not deterministic across engines (guide §7.2).' },
        { selector: "AssignmentExpression[operator='**=']", message: 'Exponentiation is not deterministic across engines (guide §7.2).' },
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: 'new Date() reads the clock. Pass time in (guide §7.2).' },
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.js'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly', URL: 'readonly', setTimeout: 'readonly' } },
  },
];
