import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative base so the same build works on GitHub Pages, a sub-folder, or inside the Android TV WebView.
  base: './',
  build: {
    // Old smart-TV WebViews (Chrome 61+ / Tizen 4+ / webOS 4+) — keep syntax conservative.
    target: ['es2017', 'chrome61', 'safari12'],
    cssTarget: ['chrome61', 'safari12'],
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 400,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registered in src/main.ts (with error handling)
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Sakina — Écran de prière',
        short_name: 'Sakina',
        description: 'Horaires de prière, iqama, adhan, versets et adhkar pour mosquées et foyers.',
        lang: 'fr',
        dir: 'ltr',
        display: 'fullscreen',
        orientation: 'any',
        background_color: '#04110d',
        theme_color: '#04110d',
        start_url: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell + fonts are precached; photos are cached on first view (they are big).
        globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
        globIgnores: ['backgrounds/**'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/backgrounds/'),
            handler: 'CacheFirst',
            options: { cacheName: 'sakina-backgrounds', expiration: { maxEntries: 40 } },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'api.aladhan.com' || url.hostname.endsWith('open-meteo.com'),
            handler: 'NetworkFirst',
            options: { cacheName: 'sakina-api', networkTimeoutSeconds: 6, expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 40 } },
          },
        ],
      },
    }),
  ],
});
