import { defineConfig } from 'vite';

// Builds only the dev-only 3D spike page (dev/ferret3d.html) into dist-spike/, so its real
// production size and startup time can be measured by scripts/measure-startup.mjs without
// touching the app build (Part 1K.3).
export default defineConfig({
  base: './',
  assetsInclude: ['**/*.glb'],
  build: {
    outDir: 'dist-spike',
    emptyOutDir: true,
    manifest: true,
    target: 'es2022',
    rollupOptions: { input: 'dev/ferret3d.html' },
  },
});
