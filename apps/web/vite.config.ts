/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      // Atlas de texturas de las cajas, servidos por la API.
      '/media': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
  },
});
