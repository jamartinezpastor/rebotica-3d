import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
import { PGlite } from '@electric-sql/pglite';
import { consultaConteo, consultaEvento, medicamento, seccionFt } from '@rebotica/db';
import { getTableColumns } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app';
import { contarConsulta } from '../src/analitica';

const pg = new PGlite();
const db = drizzle(pg);
const logs: string[] = [];
const stream = new Writable({
  write(c, _e, done) {
    logs.push(String(c));
    done();
  },
});
const app = buildApp({ db, fastify: { logger: { level: 'trace', stream } } });
const consultar = () =>
  app.inject({ method: 'POST', url: '/api/explorar', payload: { consultaId: 'fiebre' } });
beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../../packages/db/migrations', import.meta.url)),
  });
  await db.insert(medicamento).values({
    nregistro: 'METRICA1',
    nombre: 'Producto ficticio',
    pactivos: 'Activo ficticio',
    receta: false,
    comerc: true,
  });
  await db.insert(seccionFt).values({
    nregistro: 'METRICA1',
    seccion: '4.1',
    titulo: 'Indicación ficticia',
    texto: 'Fiebre de prueba',
    html: '',
    hash: 'ficticio',
  });
});
beforeEach(async () => {
  await db.delete(consultaConteo);
  logs.length = 0;
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await app.close();
  await pg.close();
});

it('agrega peticiones correctas en una fila diaria sin registrar texto, cabeceras ni eventos', async () => {
  const canario = 'CONTENIDO_PRIVADO_FICTICIO';
  const respuesta = await app.inject({
    method: 'POST',
    url: '/api/explorar',
    payload: { consultaId: 'fiebre' },
    headers: { 'user-agent': canario, 'x-forwarded-for': '192.0.2.1' },
  });
  expect(respuesta.statusCode).toBe(200);
  expect((await consultar()).statusCode).toBe(200);
  await expect.poll(async () => (await db.select().from(consultaConteo))[0]?.total).toBe(2);
  expect(await db.select().from(consultaConteo)).toEqual([
    { dia: new Date().toISOString().slice(0, 10), protocoloId: 'fiebre', total: 2 },
  ]);
  expect(Object.keys(getTableColumns(consultaConteo)).sort()).toEqual([
    'dia',
    'protocoloId',
    'total',
  ]);
  expect(await db.select().from(consultaEvento)).toEqual([]);
  expect(logs.join('')).not.toContain(canario);
  expect(logs.join('')).not.toContain('192.0.2.1');
});

it('no cuenta errores, métodos rechazados ni visitas al catálogo general', async () => {
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/api/explorar',
        payload: { consultaId: 'fiebre', texto: 'no almacenar' },
      })
    ).statusCode,
  ).toBe(400);
  expect((await app.inject({ method: 'GET', url: '/api/explorar' })).statusCode).toBe(405);
  expect((await app.inject({ method: 'GET', url: '/api/catalogo' })).statusCode).toBe(200);
  expect((await app.inject({ method: 'GET', url: '/api/analitica' })).statusCode).toBe(404);
  expect(await db.select().from(consultaConteo)).toEqual([]);
});

it('un fallo de escritura no cambia la respuesta ni filtra errores a los logs', async () => {
  const insertar = vi.spyOn(db, 'insert').mockImplementationOnce(() => {
    throw new Error('ERROR_PRIVADO_FICTICIO');
  });
  expect((await consultar()).statusCode).toBe(200);
  await expect.poll(() => insertar.mock.calls.length).toBe(1);
  expect(logs.join('')).not.toContain('ERROR_PRIVADO_FICTICIO');
});

it('las escrituras concurrentes son atómicas y cambian de fila al cambiar el día UTC', async () => {
  await Promise.all(
    Array.from({ length: 10 }, () =>
      contarConsulta(db, 'fiebre', new Date('2026-01-01T23:59:59Z')),
    ),
  );
  await contarConsulta(db, 'fiebre', new Date('2026-01-02T00:00:00Z'));
  await contarConsulta(db, 'tos', new Date('2026-01-02T00:00:00Z'));
  expect(
    await db.select().from(consultaConteo).orderBy(consultaConteo.dia, consultaConteo.protocoloId),
  ).toEqual([
    { dia: '2026-01-01', protocoloId: 'fiebre', total: 10 },
    { dia: '2026-01-02', protocoloId: 'fiebre', total: 1 },
    { dia: '2026-01-02', protocoloId: 'tos', total: 1 },
  ]);
  await expect(contarConsulta(db, 'identificador ajeno al catálogo')).rejects.toThrow();
});
