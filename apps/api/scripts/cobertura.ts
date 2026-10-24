import {
  CoberturaCatalogo,
  CONSULTAS_FRECUENTES,
  ProductoResponse,
  terminosCoincidentes,
} from '@rebotica/shared';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';
import { evaluarCobertura } from '../src/cobertura';
import { crearCatalogo } from '../src/catalogo';

// Solo consulta la API propia y su copia local. No accede a CIMA ni al texto de los usuarios.
const base = z.url().parse(process.env.API_URL ?? 'http://127.0.0.1:3000');
const argumentos = process.argv.slice(2);
const modoLocal = argumentos.includes('--local');
let cerrarLocal: (() => Promise<void>) | undefined;
const indice = argumentos.indexOf('--registro');
const registro =
  indice < 0
    ? null
    : z
        .string()
        .regex(/^[A-Za-z0-9]{1,16}$/)
        .parse(argumentos[indice + 1]);
async function obtener(ruta: string) {
  const res = await fetch(new URL(ruta, base), {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`La API respondió ${res.status}`);
  return res.json() as Promise<unknown>;
}
try {
  const local = modoLocal
    ? await (
        await import('../../../jobs/sync-cima/src/base-local')
      ).abrirBaseLocal(
        process.env.CATALOGO_DIR ??
          fileURLToPath(new URL('../../../.local/catalogo/', import.meta.url)),
      )
    : null;
  cerrarLocal = local?.cerrar;
  const informe = CoberturaCatalogo.parse(
    local ? await evaluarCobertura(local.db) : await obtener('/api/catalogo/cobertura'),
  );
  const ficha = registro
    ? ProductoResponse.parse(
        local
          ? await crearCatalogo(local.db).ficha(registro)
          : await obtener(`/api/productos/${encodeURIComponent(registro)}`),
      )
    : null;
  const seccion = ficha?.secciones.find((s) => s.seccion === '4.1');
  const comprobacion = ficha
    ? {
        registro: ficha.nregistro,
        indicacionesDisponibles: !!seccion?.texto.trim(),
        hashSeccion: seccion?.hash ?? null,
        coincidencias: CONSULTAS_FRECUENTES.flatMap((c) => {
          const terminos = terminosCoincidentes(seccion?.texto ?? '', c.id);
          return terminos.length ? [{ id: c.id, terminos }] : [];
        }),
      }
    : null;
  console.log(JSON.stringify({ ...informe, ...(comprobacion ? { comprobacion } : {}) }, null, 2));
} catch {
  console.error(
    modoLocal
      ? 'No se pudo abrir la copia local. Detén el servidor de catálogo antes de usar --local.'
      : 'No se pudo evaluar la copia local. Comprueba que la API esté disponible y actualizada.',
  );
  process.exitCode = 1;
} finally {
  await cerrarLocal?.();
}
