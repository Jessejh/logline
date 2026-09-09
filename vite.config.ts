import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves this repo from https://<user>.github.io/logline/,
// so production assets need the subpath. Dev stays at the root.
const PAGES_BASE = '/logline/';

// The minute this build was made, shown on the front page. Distribution is a
// URL and a service worker, so this is the only way to tell on the phone
// whether the deploy that just went out is the one you are looking at.
const BUILD_TIME = new Date().toISOString();

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? PAGES_BASE : '/',
  build: {
    target: 'es2022',
    sourcemap: true
  },
  define: {
    __BUILD_TIME__: JSON.stringify(BUILD_TIME)
  },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon-32.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        // The whole app is a few hundred KB; precache it all so a flight
        // never stalls on a dead connection.
        navigateFallback: `${PAGES_BASE}index.html`,
        cleanupOutdatedCaches: true
      },
      manifest: {
        name: 'Logline',
        short_name: 'Logline',
        description: 'A line drawn through the day.',
        start_url: PAGES_BASE,
        scope: PAGES_BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#050810',
        theme_color: '#050810',
        categories: ['lifestyle', 'games'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
}));
