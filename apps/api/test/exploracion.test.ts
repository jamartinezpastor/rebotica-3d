import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
import { PGlite } from '@electric-sql/pglite';
import { medicamento, seccionFt } from '@rebotica/db';
import { ExplorarRespuesta, ProductoResponse } from '@rebotica/shared';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { mencionaDolencia } from '../src/exploracion';

const pg = new PGlite();
const db = drizzle(pg);
const registros: string[] = [];
const stream = new Writable({
  write: (c, _e, done) => {
    registros.push(String(c));
    done();
  },
});
const app = buildApp({ db, fastify: { logger: { level: 'trace', stream } } });
const sinBd = buildApp();
beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../../packages/db/migrations', import.meta.url)),
  });
  for (const [i, receta, comerc] of [
    [1, false, true],
    [2, false, true],
    [3, true, true],
    [4, false, false],
    [5, false, true],
  ] as const) {
    await db.insert(medicamento).values({
      nregistro: `F${i}`,
      nombre: `Producto ficticio ${i}`,
      pactivos: 'activo ficticio',
      receta,
      comerc,
      atcs: [],
    });
    if (i !== 5)
      await db.insert(seccionFt).values({
        nregistro: `F${i}`,
        seccion: '4.1',
        titulo: 'Indicaciones',
        texto: i === 2 ? 'Indicación ficticia diferente' : 'Indicación ficticia: cefalea',
        html: '',
        hash: 'ficticio',
      });
    await db.insert(seccionFt).values({
      nregistro: `F${i}`,
      seccion: '4.2',
      titulo: 'Posología',
      texto: 'Texto de posología ficticio. Tos.',
      html: '',
      hash: 'ficticio',
    });
  }
});
afterAll(async () => {
  await app.close();
  await sinBd.close();
  await pg.close();
});
const explorar = (consultaId: string) =>
  app.inject({ method: 'POST', url: '/api/explorar', payload: { consultaId } });

describe('catálogo informativo por dolencia', () => {
  it('distingue una copia sin indicaciones de una búsqueda sin coincidencias', async () => {
    const localPg = new PGlite();
    const localDb = drizzle(localPg);
    const solicitar = async () => {
      const localApp = buildApp({ db: localDb });
      try {
        return await localApp.inject({
          method: 'POST',
          url: '/api/explorar',
          payload: { consultaId: 'tos' },
        });
      } finally {
        await localApp.close();
      }
    };
    const comprobarPendiente = async () => {
      const r = await solicitar();
      expect(r.statusCode).toBe(503);
      expect(r.headers['cache-control']).toBe('no-store');
      expect(r.json().codigo).toBe('CATALOGO_NO_SINCRONIZADO');
    };
    try {
      await migrate(localDb, {
        migrationsFolder: fileURLToPath(
          new URL('../../../packages/db/migrations', import.meta.url),
        ),
      });
      await comprobarPendiente();
      await localDb.insert(medicamento).values({
        nregistro: 'F0',
        nombre: 'Producto ficticio',
        pactivos: 'activo ficticio',
        receta: false,
        comerc: true,
        atcs: [],
      });
      await comprobarPendiente();
      await localDb.insert(seccionFt).values({
        nregistro: 'F0',
        seccion: '4.1',
        titulo: 'Indicaciones',
        texto: '   ',
        html: '',
        hash: 'ficticio',
      });
      await comprobarPendiente();
      await localDb.update(seccionFt).set({ texto: 'Indicación ficticia: cefalea' });
      const r = await solicitar();
      expect(r.statusCode).toBe(200);
      expect(ExplorarRespuesta.parse(r.json()).baldas).toEqual([]);
    } finally {
      await localPg.close();
    }
  });
  it('consulta solo 4.1, sin necesitar protocolos, y separa los productos con receta', async () => {
    const r = await explorar('dolor-cabeza');
    expect(r.statusCode).toBe(200);
    expect(r.headers['cache-control']).toBe('no-store');
    const p = ExplorarRespuesta.parse(r.json());
    expect(p.estado).toBe('informativo');
    expect(p.baldas.flatMap((b) => b.productos.map((m) => m.nregistro))).toEqual(['F1']);
    expect(p.vitrina.flatMap((b) => b.productos.map((m) => m.nregistro))).toEqual(['F3']);
    // Compartir principio activo, aparecer solo en 4.2 o estar retirado no crea una asociación.
    expect(ExplorarRespuesta.parse((await explorar('tos')).json()).baldas).toEqual([]);
  });
  it('conserva las fichas completas y no crea reglas de dosis', async () => {
    for (const id of ['F1', 'F3']) {
      const r = await app.inject({ url: `/api/productos/${id}` });
      expect(r.statusCode).toBe(200);
      const ficha = ProductoResponse.parse(r.json());
      expect(ficha.secciones.map((s) => s.seccion)).toEqual(['4.1', '4.2']);
      expect(ficha.reglaDosis).toBeNull();
    }
  });
  it('normaliza acentos y espacios, con límites de palabra', () => {
    expect(mencionaDolencia('RINITIS\nALÉRGICA', 'alergia-estacional')).toBe(true);
    expect(mencionaDolencia('datos de prueba', 'tos')).toBe(false);
  });
  it('no acepta perfiles, texto libre ni queries y no registra contenido rechazado', async () => {
    const canario = 'CANARIO_PRIVADO_FICTICIO';
    for (const payload of [
      { consultaId: 'inventado' },
      { consultaId: 'tos', texto: canario },
      { consultaId: 'tos', edad: 20 },
    ]) {
      expect((await app.inject({ method: 'POST', url: '/api/explorar', payload })).statusCode).toBe(
        400,
      );
    }
    const r = await app.inject({
      method: 'POST',
      url: `/api/explorar?texto=${canario}`,
      payload: { consultaId: 'tos' },
    });
    expect(r.statusCode).toBe(400);
    expect(r.body).not.toContain(canario);
    expect(registros.join('')).not.toContain(canario);
  });
  it('sin catálogo devuelve un motivo explícito', async () => {
    const r = await sinBd.inject({
      method: 'POST',
      url: '/api/explorar',
      payload: { consultaId: 'tos' },
    });
    expect(r.statusCode).toBe(503);
    expect(r.json().codigo).toBe('CATALOGO_NO_CONFIGURADO');
  });
});
