import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

// BASE_PATH is set by CI for GitHub Pages project sites (for example "/repo-name/").
export default defineConfig({
  base: process.env['BASE_PATH'] ?? '/',
  plugins: [preact()],
  build: {
    // The manifest lets scripts/check-budgets.mjs find the initial (non-lazy) JS.
    manifest: true,
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
