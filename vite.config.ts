import { defineConfig } from 'vite';

// COOP/COEP from day 1 so SharedArrayBuffer is available to physics/nav workers later.
// Consequence: every asset must be self-hosted (no third-party CDNs).
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  server: { headers: isolation, port: 5188, strictPort: true },
  preview: { headers: isolation, port: 5189, strictPort: true },
  build: { target: 'es2022', sourcemap: true },
  test: { include: ['src/**/*.test.ts'] },
});
