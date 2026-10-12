import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  clean: true,
  // Se empaqueta todo salvo lo nativo (sharp), que se instala con `pnpm deploy` (Dockerfile).
  noExternal: [/^(?!(sharp|pg-native)(\/|$))/],
  external: ['pg-native', 'sharp'],
  // Dependencias CommonJS (pg) dentro de un bundle ESM necesitan `require`.
  banner: {
    js: "import { createRequire as __crearRequire } from 'node:module'; const require = __crearRequire(import.meta.url);",
  },
});
