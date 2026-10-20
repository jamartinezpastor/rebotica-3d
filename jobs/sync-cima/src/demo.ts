/**
 * Demo local sin PostgreSQL: levanta la API con una base de datos en memoria (PGlite),
 * sincroniza unos medicamentos reales de CIMA, extrae la paleta de sus envases y monta un pasillo
 * de ejemplo con ellos. Pensado para ver la web con datos reales:
 *
 *   pnpm demo            (arranca esta API y la web)
 *   http://localhost:5173/escena?pasillo=demo
 *
 * Variables: `DEMO_MEDICAMENTOS` (por defecto 18) y `DEMO_DIR` (caché de fotos y miniaturas).
 * El protocolo que monta es un borrador de demostración: no es clínico ni está validado.
 */
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { medicamento, protocolo } from '@rebotica/db';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { buildApp } from '../../../apps/api/src/app';
import { cargarReglasBorrador, leerReglasBorrador } from '../../../apps/api/src/reglas';
import { construirAssets } from './assets/construir';
import { crearClienteCima } from './cliente';
import { guardarMedicamento, sincronizar } from './sync';
import { urlFichaTecnica, urlMedicamento } from './cima';
import { Detalle, SeccionesFT } from './esquemas';

const total = Math.min(Math.max(Number(process.env.DEMO_MEDICAMENTOS) || 18, 4), 120);
const directorio = process.env.DEMO_DIR ?? join(tmpdir(), 'rebotica-demo');
const puerto = Number(process.env.PORT) || 3000;
const log = (m: string) => console.log(`demo: ${m}`);

const capitalizar = (t: string) => {
  const s = t.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

mkdirSync(directorio, { recursive: true });
const pg = new PGlite();
const db = drizzle(pg);
await migrate(db, {
  migrationsFolder: fileURLToPath(new URL('../../../packages/db/migrations', import.meta.url)),
});

const cliente = crearClienteCima();
log(`sincronizando ${total} medicamentos sin receta de CIMA (unos segundos por cada 10)…`);
const informe = await sincronizar(db, cliente, { limite: total, log });
log(
  `catálogo: ${informe.sinReceta.sincronizados} medicamentos, ${informe.sinReceta.secciones} secciones` +
    (informe.errores.length > 0 ? `, ${informe.errores.length} errores` : ''),
);

// Añade los cinco productos semilla aunque no estén en la primera página del catálogo.
const reglasDir = fileURLToPath(new URL('../../../packages/dosis/data/reglas/', import.meta.url));
const semillas = await leerReglasBorrador(reglasDir, log);
const registrosSemilla = new Set(semillas.map((r) => r.fuente.nregistro));
for (const nregistro of registrosSemilla) {
  const detalle = await cliente.obtener(urlMedicamento(nregistro), Detalle);
  if (!detalle) continue;
  const secciones = (await cliente.obtener(urlFichaTecnica(nregistro), SeccionesFT)) ?? [];
  await guardarMedicamento(db, detalle, secciones);
}
log(`reglas borrador cargadas: ${await cargarReglasBorrador(db, reglasDir, log)}`);

log('extrayendo la paleta de color y las miniaturas de los envases…');
const assets = await construirAssets(db, { directorio, cliente, log });
log(`miniaturas: ${assets.conFoto} con foto de CIMA, ${assets.sinFoto} sin foto`);

// Baldas de ejemplo: los principios activos con más productos, hasta dos estanterías.
const filas = await db
  .select({ pactivos: medicamento.pactivos, nregistro: medicamento.nregistro })
  .from(medicamento)
  .where(and(eq(medicamento.comerc, true), eq(medicamento.receta, false)));
const cuenta = new Map<string, number>();
for (const f of filas) cuenta.set(f.pactivos, (cuenta.get(f.pactivos) ?? 0) + 1);
const activosSemilla = new Set(
  filas.filter((f) => registrosSemilla.has(f.nregistro)).map((f) => f.pactivos),
);
const principios = [...cuenta.entries()]
  .sort(
    (a, b) =>
      Number(activosSemilla.has(b[0])) - Number(activosSemilla.has(a[0])) ||
      b[1] - a[1] ||
      a[0].localeCompare(b[0]),
  )
  .slice(0, 6)
  .map(([nombre]) => nombre);

const conReceta = await db
  .select({ pactivos: medicamento.pactivos, nregistro: medicamento.nregistro })
  .from(medicamento)
  .where(and(eq(medicamento.comerc, true), eq(medicamento.receta, true)));
const activosSemillaReceta = new Set(
  conReceta.filter((f) => registrosSemilla.has(f.nregistro)).map((f) => f.pactivos),
);
const principiosReceta = [...new Set(conReceta.map((p) => p.pactivos))]
  .sort(
    (a, b) =>
      Number(activosSemillaReceta.has(b)) - Number(activosSemillaReceta.has(a)) ||
      a.localeCompare(b),
  )
  .slice(0, 3);

await db.insert(protocolo).values({
  id: 'demo',
  version: 1,
  estado: 'borrador',
  json: {
    id: 'demo',
    version: 1,
    titulo: 'Pasillo de demostración',
    sinonimos: ['demostración'],
    preguntasTriaje: [],
    criteriosDerivacion: [
      {
        id: 'alarma-demo',
        descripcion: 'Criterio de demostración, no clínico',
        urgencia: 'medico',
        palabrasClave: ['demostración'],
      },
    ],
    baldas: principios.map((p, i) => ({
      titulo: capitalizar(p),
      principioActivo: p,
      orden: i + 1,
      gruposExcluidos: [],
      condicionesExcluidas: [],
    })),
    vitrina: principiosReceta.map((p) => ({
      principioActivo: p,
      paraQueSeUsa: 'Consulta las indicaciones oficiales en la ficha del producto.',
      porQueNecesitaReceta: 'Requiere valoración y prescripción médica.',
      situacion: 'No inicies ni cambies el tratamiento sin indicación de tu médico.',
    })),
    consejos: [],
    parafarmacia: [],
    estado: 'borrador',
    validadoPor: null,
    validadoEn: null,
  },
});

const app = buildApp({ db, assetsDir: directorio });
await app.listen({ port: puerto, host: '127.0.0.1' });
log(`API lista en http://127.0.0.1:${puerto}`);
log('Abre http://localhost:5173/escena?pasillo=demo  (Ctrl+C para parar)');

const cerrar = async () => {
  await app.close();
  await pg.close();
  process.exit(0);
};
process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);
