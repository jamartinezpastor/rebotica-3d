import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { medicamento, seccionFt, syncEstado } from '@rebotica/db';
import {
  CoberturaCatalogo,
  EstadoCatalogoPublico,
  ExplorarRespuesta,
  PasilloResponse,
} from '@rebotica/shared';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { buildApp } from '../src/app';

const pg = new PGlite();
const db = drizzle(pg);
let app = buildApp({ db });
const sinDb = buildApp();
beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../../packages/db/migrations', import.meta.url)),
  });
});
beforeEach(async () => {
  await app.close();
  await db.delete(seccionFt);
  await db.delete(medicamento);
  await db.delete(syncEstado);
  app = buildApp({ db });
});
afterAll(async () => {
  await app.close();
  await sinDb.close();
  await pg.close();
});
const estado = async () =>
  EstadoCatalogoPublico.parse(
    (await app.inject({ method: 'GET', url: '/api/catalogo/estado' })).json(),
  );
it('una copia completada sin 4.1 consultable se distingue de una carga pendiente', async () => {
  await db.insert(medicamento).values({
    nregistro: 'SIN41',
    nombre: 'Producto ficticio',
    pactivos: 'Activo ficticio',
    receta: false,
    comerc: true,
  });
  await db
    .insert(syncEstado)
    .values({ clave: 'cima.ultima_sincronizacion', valor: '2026-01-01T00:00:00.000Z' });
  const res = await app.inject({
    method: 'POST',
    url: '/api/explorar',
    payload: { consultaId: 'tos' },
  });
  expect(res.statusCode).toBe(503);
  expect(res.json().codigo).toBe('CATALOGO_SIN_INDICACIONES');
  expect((await estado()).estado).toBe('completo');
});
async function muestra() {
  await db.insert(medicamento).values(
    Array.from({ length: 6 }, (_, i) => ({
      nregistro: `C${i + 1}`,
      nombre: i === 5 ? 'CEFALEAS NOMBRE FICTICIO' : `Producto ficticio ${i + 1}`,
      pactivos: 'Activo ficticio',
      receta: i === 1 || i === 3,
      comerc: i !== 3,
    })),
  );
  await db.insert(seccionFt).values(
    [
      ['C1', '4.1', 'Indicación ficticia: CEFÁLEAS y fiebre'],
      ['C2', '4.1', 'Indicación ficticia: migrañas'],
      ['C3', '4.1', ' \t\n\r\u00a0'],
      ['C4', '4.1', 'Indicación ficticia: cefalea'],
      ['C5', '4.1', 'Dolor ocasional leve o moderado'],
      ['C6', '4.2', 'Texto ficticio: cefalea y tos'],
    ].map(([nregistro, seccion, texto]) => ({
      nregistro: nregistro!,
      seccion: seccion!,
      texto: texto!,
      html: '',
      titulo: 'Texto ficticio',
      hash: 'ficticio',
    })),
  );
}

it('una base vacía no se presenta como completa aunque tenga una marca antigua', async () => {
  await db
    .insert(syncEstado)
    .values({ clave: 'cima.ultima_sincronizacion', valor: '2026-01-01T00:00:00.000Z' });
  expect(await estado()).toMatchObject({ estado: 'vacio', total: 0, conIndicaciones: 0 });
});
it('datos sin carga completa verificada son parciales y cuantifican las indicaciones disponibles', async () => {
  await muestra();
  expect(await estado()).toMatchObject({
    estado: 'parcial',
    total: 5,
    sinReceta: 4,
    conReceta: 1,
    conIndicaciones: 3,
    sinIndicaciones: 2,
    cargaPendiente: false,
    sincronizadoHasta: null,
  });
  const res = await app.inject({
    method: 'POST',
    url: '/api/explorar',
    payload: { consultaId: 'dolor-cabeza' },
    headers: { 'x-rebotica-catalogo': '1' },
  });
  expect(ExplorarRespuesta.parse(res.json()).catalogo?.estado).toBe('parcial');
});
it('una carga pendiente prevalece sobre la última copia completa y una fecha inválida no certifica sincronización', async () => {
  await muestra();
  await db
    .insert(syncEstado)
    .values({ clave: 'cima.ultima_sincronizacion', valor: '2026-01-01T00:00:00.000Z' });
  expect((await estado()).estado).toBe('completo');
  await db
    .insert(syncEstado)
    .values({ clave: 'cima.carga_completa_desde', valor: 'fecha inválida' });
  expect(await estado()).toMatchObject({
    estado: 'parcial',
    cargaPendiente: true,
    cargaPendienteDesde: null,
  });
  await db.delete(syncEstado);
  await db
    .insert(syncEstado)
    .values({ clave: 'cima.ultima_sincronizacion', valor: '2099-01-01T00:00:00.000Z' });
  expect(await estado()).toMatchObject({ estado: 'parcial', sincronizadoHasta: null });
});
it('el informe y la búsqueda coinciden, sin inferir por nombres, 4.2 o dolor genérico', async () => {
  await muestra();
  const res = await app.inject({ method: 'GET', url: '/api/catalogo/cobertura' });
  expect(res.headers['cache-control']).toBe('no-store');
  const informe = CoberturaCatalogo.parse(res.json());
  expect(informe.consultas.find((c) => c.id === 'dolor-cabeza')).toMatchObject({
    sinReceta: 1,
    conReceta: 1,
  });
  expect(informe.consultas.find((c) => c.id === 'tos')).toMatchObject({
    sinReceta: 0,
    conReceta: 0,
  });
  for (const c of informe.consultas) {
    const r = await app.inject({
      method: 'POST',
      url: '/api/explorar',
      payload: { consultaId: c.id },
    });
    const p = ExplorarRespuesta.parse(r.json());
    expect(p.baldas.flatMap((b) => b.productos)).toHaveLength(c.sinReceta);
    expect(p.vitrina.flatMap((b) => b.productos)).toHaveLength(c.conReceta);
  }
});
it('cero coincidencias mantiene el estado parcial o completo, sin confundirlo con una copia vacía', async () => {
  await muestra();
  const solicitar = () =>
    app.inject({
      method: 'POST',
      url: '/api/explorar',
      payload: { consultaId: 'piojos' },
      headers: { 'x-rebotica-catalogo': '1' },
    });
  const parcial = ExplorarRespuesta.parse((await solicitar()).json());
  expect(parcial.baldas).toEqual([]);
  expect(parcial.catalogo?.estado).toBe('parcial');
  await db
    .insert(syncEstado)
    .values({ clave: 'cima.ultima_sincronizacion', valor: '2026-01-01T00:00:00.000Z' });
  expect(ExplorarRespuesta.parse((await solicitar()).json()).catalogo?.estado).toBe('completo');
});
it('los diagnósticos rechazan parámetros y sin conexión no inventan recuentos', async () => {
  for (const ruta of ['/api/catalogo/estado', '/api/catalogo/cobertura']) {
    expect((await app.inject({ method: 'GET', url: ruta + '?texto=privado' })).statusCode).toBe(
      400,
    );
    expect((await sinDb.inject({ method: 'GET', url: ruta })).statusCode).toBe(503);
  }
});
it('las versiones anteriores de la web conservan el contrato sin metadatos adicionales', async () => {
  await muestra();
  const anterior = PasilloResponse.omit({ catalogo: true });
  const vieja = await app.inject({
    method: 'POST',
    url: '/api/explorar',
    payload: { consultaId: 'fiebre' },
  });
  expect(anterior.safeParse(vieja.json()).success).toBe(true);
  const nueva = await app.inject({
    method: 'POST',
    url: '/api/explorar',
    payload: { consultaId: 'fiebre' },
    headers: { 'x-rebotica-catalogo': '1' },
  });
  expect(ExplorarRespuesta.parse(nueva.json()).catalogo?.estado).toBe('parcial');
});
it('una carga que empieza vacía se vuelve consultable al guardar datos sin esperar a la caché', async () => {
  const solicitar = () =>
    app.inject({ method: 'POST', url: '/api/explorar', payload: { consultaId: 'fiebre' } });
  expect((await solicitar()).statusCode).toBe(503);
  await muestra();
  expect((await solicitar()).statusCode).toBe(200);
});
