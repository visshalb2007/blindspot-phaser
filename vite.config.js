import { defineConfig } from 'vite';

// `base: './'` keeps the built asset URLs relative so the same `dist/`
// works from a GitHub Pages project sub-path and from the local filesystem.
export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1600,
  },
});
