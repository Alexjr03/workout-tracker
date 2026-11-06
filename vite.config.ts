import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages serves the app from /workout-tracker/ (see .github/workflows/deploy.yml).
  base: process.env.GITHUB_PAGES === 'true' ? '/workout-tracker/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/icon-180.png', 'icons/icon.svg'],
      manifest: {
        name: 'Workout',
        short_name: 'Workout',
        description: 'Offline workout, body weight and calorie tracker',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    // Default 5 s is too tight when ~50 DB-backed files run in parallel with coverage.
    testTimeout: 15_000,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.d.ts', 'src/main.tsx', 'src/test/**'],
      // Thresholds are set in CONSTRAINTS.md; change them there first.
      thresholds: {
        lines: 80,
        'src/domain/**': { branches: 100 },
      },
    },
  },
});
