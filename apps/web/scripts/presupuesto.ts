import { gzipSync } from 'node:zlib';
import { z } from 'zod';

const Entrada = z.object({
  file: z.string(),
  imports: z.array(z.string()).optional(),
  isEntry: z.boolean().optional(),
});
const Manifest = z.record(z.string(), Entrada);
export const LIMITE_JS_INICIAL = 250_000;

/** Mide los archivos iniciales en gzip; sigue imports estáticos, nunca dynamicImports ni CSS. */
export function medirJavaScript(
  manifest: unknown,
  html: string,
  leer: (archivo: string) => Uint8Array,
) {
  const entradas = Manifest.parse(manifest);
  const vistos = new Set<string>();
  const archivos = new Set<string>();
  function visitar(id: string) {
    if (vistos.has(id)) return;
    vistos.add(id);
    const entrada = entradas[id];
    if (!entrada) throw new Error(`Import estático ausente del manifiesto: ${id}`);
    archivos.add(entrada.file);
    for (const referencia of entrada.imports ?? []) visitar(referencia);
  }
  for (const [id, entrada] of Object.entries(entradas)) if (entrada.isEntry) visitar(id);
  // Incluye también el pequeño registro de PWA insertado en el HTML después de Vite.
  for (const m of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)) {
    const src = m[1]!;
    if (/^(?:[a-z]+:|\/\/)/i.test(src)) throw new Error('El JavaScript inicial debe ser local');
    archivos.add(src.replace(/^\//, ''));
  }
  if (!archivos.size) throw new Error('No se encontró JavaScript inicial');
  const chunks = [...archivos].map((archivo) => ({
    archivo,
    gzipBytes: gzipSync(leer(archivo), { level: 9 }).length,
  }));
  const gzipBytes = chunks.reduce((total, c) => total + c.gzipBytes, 0);
  if (gzipBytes >= LIMITE_JS_INICIAL)
    throw new Error(
      `JavaScript inicial: ${gzipBytes} bytes gzip; debe ser inferior a ${LIMITE_JS_INICIAL}`,
    );
  return { gzipBytes, limiteBytes: LIMITE_JS_INICIAL, chunks };
}
