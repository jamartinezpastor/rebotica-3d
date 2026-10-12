import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  clean: true,
  // Se empaqueta todo salvo lo nativo o con WASM, que se instala con `pnpm deploy` (Dockerfile).
  noExternal: [/^(?!(sharp|ktx2-encoder|pg-native)(\/|$))/],
  external: ['pg-native', 'sharp', 'ktx2-encoder'],
  // Dependencias CommonJS (pg) dentro de un bundle ESM necesitan `require`.
  banner: {
    js: "import { createRequire as __crearRequire } from 'node:module'; const require = __crearRequire(import.meta.url);",
  },
});
