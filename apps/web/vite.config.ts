/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: { manifest: true },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Se activa al cerrar las ventanas anteriores, sin recargar una ficha o consulta abierta.
      registerType: 'prompt',
      injectRegister: 'script-defer',
      manifest: {
        id: '/',
        name: 'Rebotica 3D',
        short_name: 'Rebotica',
        description: 'Catálogo informativo de medicamentos por dolencia.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#08773e',
        background_color: '#faf8f4',
        icons: [
          { src: '/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Solo archivos de la aplicación. Ni consultas, respuestas de API ni datos de dosis.
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api(?:\/|$)/, /^\/media(?:\/|$)/],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: false,
      },
    }),
  ],
  server: {
    proxy: {
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
      // Atlas de texturas de las cajas, servidos por la API.
      '/media': process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
    },
  },
  preview: {
    proxy: {
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
      '/media': process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
  },
});
