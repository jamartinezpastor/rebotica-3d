/** Catálogo CIMA completo en disco, sin instalar PostgreSQL ni reiniciar la carga en cada arranque. */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { count } from 'drizzle-orm';
import { medicamento } from '@rebotica/db';
import { z } from 'zod';
import { buildApp } from '../../../apps/api/src/app';
import { clasificadorDesdeEntorno } from '../../../apps/api/src/interpretacion/gemini';
import { abrirBaseLocal } from './base-local';
import { sincronizacionDiaria } from './cambios';
import { crearClienteCima } from './cliente';
import { construirAssets } from './assets/construir';

const directorio =
  process.env.CATALOGO_DIR ?? fileURLToPath(new URL('../../../.local/catalogo/', import.meta.url));
const puerto = z.coerce.number().int().min(1).max(65535).default(3000).parse(process.env.PORT);
const { db, cerrar: cerrarBase } = await abrirBaseLocal(directorio);
const assetsDir = join(directorio, 'assets');
const app = buildApp({
  db,
  assetsDir,
  interpretacion: { clasificar: clasificadorDesdeEntorno(process.env) },
});
let cerrando = false;
let enCurso = false;
const log = (mensaje: string) => {
  if (!cerrando) console.log(`catálogo local: ${mensaje}`);
};

const actualizar = async () => {
  if (enCurso || cerrando) return;
  enCurso = true;
  try {
    const cliente = crearClienteCima();
    // Sin --limite, semillas ni selección de marcas: ambos catálogos de CIMA completos.
    const resultado = await sincronizacionDiaria(db, cliente, { log });
    log(JSON.stringify(resultado));
    if (cerrando) return;
    const assets = await construirAssets(db, { directorio: assetsDir, cliente, log });
    log(JSON.stringify({ assets }));
    log(
      resultado.informe.errores.length
        ? 'Carga pendiente de reintentar; se conservan los datos guardados.'
        : 'Catálogo actualizado.',
    );
  } catch (error) {
    if (!cerrando)
      log(
        `Carga interrumpida: ${error instanceof Error ? error.message : String(error)}. Se reanudará en el siguiente arranque.`,
      );
  } finally {
    enCurso = false;
  }
};

try {
  await app.listen({ host: '127.0.0.1', port: puerto });
} catch (error) {
  await app.close();
  await cerrarBase();
  throw error;
}
log(`API lista en http://127.0.0.1:${puerto}. Datos persistentes en ${directorio}`);
log('La primera carga puede tardar horas. Hasta que termine, los resultados son parciales.');
void actualizar();
const diario = setInterval(() => void actualizar(), 24 * 60 * 60 * 1000);
const progreso = setInterval(() => {
  if (!enCurso || cerrando) return;
  void db
    .select({ total: count() })
    .from(medicamento)
    .then(([fila]) => log(`${fila?.total ?? 0} medicamentos guardados`))
    .catch(() => {});
}, 30_000);
diario.unref();
progreso.unref();

const cerrar = async () => {
  if (cerrando) return;
  cerrando = true;
  clearInterval(diario);
  clearInterval(progreso);
  try {
    await app.close();
    await cerrarBase();
  } finally {
    process.exit(0);
  }
};
process.on('SIGINT', () => void cerrar());
process.on('SIGTERM', () => void cerrar());
