import { createHash } from 'node:crypto';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { medicamento, reglaDosis, seccionFt } from '@rebotica/db';
import { ProductoResponse } from '@rebotica/shared';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { reglaFicticia } from '../../../packages/dosis/test/fixtures';
import { buildApp } from '../src/app';
import { cargarReglasBorrador } from '../src/reglas';

const pg = new PGlite();
const db = drizzle(pg);
const texto = 'Posología ficticia para tests.';
const hash = createHash('sha256').update(texto).digest('hex');
let directorio: string;

const borrador = (nregistro = 'FICTICIO') => {
  const r = reglaFicticia();
  return {
    ...r,
    estado: 'borrador' as const,
    fuente: { ...r.fuente, nregistro, hashSeccion: hash, validadoPor: null, fecha: null },
  };
};

beforeAll(async () => {
  directorio = await mkdtemp(join(tmpdir(), 'rebotica-reglas-'));
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../../packages/db/migrations', import.meta.url)),
  });
});
beforeEach(async () => {
  await pg.exec('TRUNCATE medicamento CASCADE');
  for (const archivo of await readdir(directorio)) await rm(join(directorio, archivo));
});
afterAll(async () => {
  await pg.close();
  await rm(directorio, { recursive: true, force: true });
});

async function fuente(nregistro = 'FICTICIO', receta = false) {
  await db.insert(medicamento).values({
    nregistro,
    nombre: 'Producto ficticio',
    pactivos: 'Principio ficticio',
    receta,
    comerc: true,
  });
  await db.insert(seccionFt).values({
    nregistro,
    seccion: '4.2',
    titulo: 'Posología',
    html: `<p>${texto}</p>`,
    texto,
    hash,
  });
}
async function archivo(datos: unknown, nombre = 'regla.json') {
  await writeFile(join(directorio, nombre), JSON.stringify(datos));
}

describe('cargarReglasBorrador', () => {
  it.each([false, true])(
    'importa un borrador vigente (receta=%s), es idempotente y solo publica metadatos',
    async (receta) => {
      await fuente('FICTICIO', receta);
      await archivo(borrador());
      expect(await cargarReglasBorrador(db, directorio)).toBe(1);
      expect(await cargarReglasBorrador(db, directorio)).toBe(0);
      expect(await db.select().from(reglaDosis)).toEqual([
        expect.objectContaining({ receta, estado: 'borrador', hashSeccion: hash }),
      ]);
      const app = buildApp({ db });
      try {
        const respuesta = await app.inject({ method: 'GET', url: '/api/productos/FICTICIO' });
        const ficha = ProductoResponse.parse(respuesta.json());
        expect(ficha.reglaDosis).toBeNull();
        expect(ficha.borradorDosis).toEqual({ id: borrador().id, version: borrador().version });
        expect(ficha.secciones[0]?.texto).toBe(texto);
        expect(respuesta.body).not.toMatch(/mgKgToma|intervaloHoras|tramos|validadoPor/);
      } finally {
        await app.close();
      }
    },
  );

  it.each(['validada', 'revisar'])(
    'no degrada ni sobrescribe una versión %s al volver a importar',
    async (estado) => {
      await fuente();
      await db.insert(reglaDosis).values({
        nregistro: 'FICTICIO',
        version: 1,
        json: reglaFicticia(),
        hashSeccion: hash,
        estado,
      });
      await archivo(borrador());
      expect(await cargarReglasBorrador(db, directorio)).toBe(0);
      const [guardada] = await db.select().from(reglaDosis);
      expect(guardada?.estado).toBe(estado);
      expect(guardada?.json).toEqual(reglaFicticia());
    },
  );

  it('omite JSON ilegible o inválido, firmas, estados publicados, citas ausentes y fuentes distintas', async () => {
    await fuente();
    const r = borrador();
    const casos = [
      {},
      reglaFicticia(),
      { ...r, fuente: { ...r.fuente, validadoPor: 'Firma ficticia' } },
      { ...r, fuente: { ...r.fuente, fecha: '2026-01-01' } },
      { ...r, fuente: { ...r.fuente, cita: undefined } },
      { ...r, fuente: { ...r.fuente, cita: 'No está en la fuente' } },
      { ...r, fuente: { ...r.fuente, hashSeccion: 'obsoleto' } },
      borrador('DESCONOCIDO'),
    ];
    for (const [i, datos] of casos.entries()) await archivo(datos, `${i}.json`);
    await writeFile(join(directorio, 'ilegible.json'), '{');
    const mensajes: string[] = [];
    expect(await cargarReglasBorrador(db, directorio, (m) => mensajes.push(m))).toBe(0);
    expect(mensajes).toHaveLength(casos.length + 1);
    expect(await db.select().from(reglaDosis)).toHaveLength(0);
  });

  it('una versión validada vigente tiene prioridad sobre un borrador posterior', async () => {
    await fuente();
    const r = reglaFicticia();
    const validada = { ...r, fuente: { ...r.fuente, hashSeccion: hash } };
    await db.insert(reglaDosis).values({
      nregistro: 'FICTICIO',
      version: 1,
      json: validada,
      hashSeccion: hash,
      estado: 'validada',
    });
    await archivo({ ...borrador(), version: 2 });
    expect(await cargarReglasBorrador(db, directorio)).toBe(1);
    const app = buildApp({ db });
    try {
      const ficha = ProductoResponse.parse(
        (await app.inject({ method: 'GET', url: '/api/productos/FICTICIO' })).json(),
      );
      expect(ficha.reglaDosis).toEqual(validada);
      expect(ficha.borradorDosis).toBeNull();
    } finally {
      await app.close();
    }
  });

  it('no importa una fuente local corrupta ni un medicamento retirado', async () => {
    await fuente();
    await archivo(borrador());
    await db.update(seccionFt).set({ texto: `${texto} Cambio sin actualizar el hash.` });
    expect(await cargarReglasBorrador(db, directorio)).toBe(0);
    await db.update(seccionFt).set({ texto });
    await db
      .update(medicamento)
      .set({ comerc: false })
      .where(eq(medicamento.nregistro, 'FICTICIO'));
    expect(await cargarReglasBorrador(db, directorio)).toBe(0);
  });
});
