/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

const visualizerPlugin = visualizer({
  filename: 'dist/stats.html',
  open: false,
  gzipSize: true,
  brotliSize: true,
  template: 'treemap',
})

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Bumpear `version` fuerza al SW a regenerar el precache y descartar
      // la versión vieja cuando el cliente recibe la actualización.
      // Incrementar cuando hagamos cambios significativos en el bundle.
      version: '1.2.0-multicomp',
      includeAssets: ['favicon.svg'],
      manifest: false, // usa /public/manifest.json (multi-comp friendly)
      workbox: {
        // Limpieza explícita de caches viejos en cada activación del SW.
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest, json}'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/imagecache\.365scores\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'images', expiration: { maxEntries: 50 } },
          },
          {
            // No cachear /api para siempre — solo stale-while-revalidate
            urlPattern: /\/api\/football\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-football',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 5 },
            },
          },
        ],
      },
    }),
    ...(mode === 'analyze' ? [visualizerPlugin] : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/index.ts', 'src/**/*.d.ts'],
    },
  },
}))
