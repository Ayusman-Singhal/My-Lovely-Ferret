import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

// BASE_PATH is set by CI for GitHub Pages project sites (for example "/repo-name/").
export default defineConfig({
  base: process.env['BASE_PATH'] ?? '/',
  // The build id shown in the menu, in feedback, and in error details (set by CI from the commit).
  define: { __APP_VERSION__: JSON.stringify((process.env['GITHUB_SHA'] ?? 'dev').slice(0, 7)) },
  plugins: [preact()],
  build: {
    // The manifest lets scripts/check-budgets.mjs find the initial (non-lazy) JS.
    manifest: true,
    target: 'es2022',
    // The lazy three.js scene chunk is about 650 KB raw; size is budgeted by scripts/check-budgets.mjs.
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
