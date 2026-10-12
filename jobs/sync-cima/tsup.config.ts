import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  clean: true,
  // El job se ejecuta desde una carpeta sin node_modules: se empaqueta todo.
  noExternal: [/.*/],
  external: ['pg-native'],
  // Dependencias CommonJS (pg) dentro de un bundle ESM necesitan `require`.
  banner: {
    js: "import { createRequire as __crearRequire } from 'node:module'; const require = __crearRequire(import.meta.url);",
  },
});
