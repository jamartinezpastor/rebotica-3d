import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
import { PGlite } from '@electric-sql/pglite';
import { medicamento, protocolo as tabla } from '@rebotica/db';
import { ProtocoloTriajeRespuesta, TriajeRespuesta } from '@rebotica/shared';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  protocoloTriajeFicticio,
  respuestasFicticias,
} from '../../../packages/protocolos/test/fixtures';
import { buildApp } from '../src/app';

const pg = new PGlite();
const db = drizzle(pg);
const registros: string[] = [];
const stream = new Writable({
  write: (chunk, _encoding, done) => {
    registros.push(String(chunk));
    done();
  },
});
const app = buildApp({ db, fastify: { logger: { level: 'trace', stream } } });
const sinBd = buildApp();
const p = protocoloTriajeFicticio();
const enviar = (respuestas: unknown, version = 1) =>
  app.inject({
    method: 'POST',
    url: '/api/triaje',
    payload: { protocoloId: 'tos', version, respuestas },
  });
beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../../packages/db/migrations', import.meta.url)),
  });
  await db.insert(medicamento).values([
    {
      nregistro: 'F100',
      nombre: 'Producto ficticio A',
      pactivos: 'activo ficticio a',
      receta: false,
      comerc: true,
      atcs: [],
    },
    {
      nregistro: 'F200',
      nombre: 'Producto ficticio B',
      pactivos: 'activo ficticio b',
      receta: false,
      comerc: true,
      atcs: [],
    },
    {
      nregistro: 'F300',
      nombre: 'Producto ficticio con receta',
      pactivos: 'activo receta ficticio',
      receta: true,
      comerc: true,
      atcs: [],
    },
  ]);
});
beforeEach(async () => {
  await db.delete(tabla);
  await db.insert(tabla).values({
    id: p.id,
    version: 1,
    json: p,
    estado: 'validada',
    validadoPor: p.validadoPor,
    validadoEn: new Date(p.validadoEn!),
  });
  registros.length = 0;
});
afterAll(async () => {
  await app.close();
  await sinBd.close();
  await pg.close();
});

describe('GET protocolo y POST triaje F4-03', () => {
  it('entrega solo las preguntas de la versión firmada, sin medicamentos ni umbrales', async () => {
    const r = await app.inject({ url: '/api/protocolos/tos' });
    expect(r.statusCode).toBe(200);
    expect(ProtocoloTriajeRespuesta.parse(r.json())).toEqual({
      id: 'tos',
      version: 1,
      titulo: p.titulo,
      preguntas: p.preguntasTriaje,
    });
    expect(r.headers['cache-control']).toBe('no-store');
  });
  it('devuelve preguntas pendientes y una alarma parcial deriva sin pasillo ni vitrina', async () => {
    expect((await enviar({})).json()).toMatchObject({
      tipo: 'preguntas',
      pendientes: p.preguntasTriaje.map((q) => q.id),
    });
    const r = await enviar({ alarma: true });
    expect(r.statusCode).toBe(200);
    expect(TriajeRespuesta.parse(r.json())).toMatchObject({ tipo: 'derivar', urgencia: '112' });
    expect(r.json()).not.toHaveProperty('pasillo');
    expect(r.body).not.toContain('Producto ficticio');
  });
  it('entrega el pasillo local filtrado en POST, con baldas y receta separadas', async () => {
    const r = await enviar({ ...respuestasFicticias, ulcera: true });
    expect(r.statusCode).toBe(200);
    const resultado = TriajeRespuesta.parse(r.json());
    expect(resultado.tipo).toBe('recomendar');
    if (resultado.tipo !== 'recomendar') throw new Error('Resultado inesperado');
    expect(resultado.pasillo.ocultasPorPerfil).toBe(1);
    expect(resultado.pasillo.baldas).toHaveLength(1);
    expect(resultado.pasillo.baldas[0]!.productos.map((m) => m.nregistro)).toEqual(['F200']);
    expect(resultado.pasillo.vitrina[0]!.productos[0]!.receta).toBe(true);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.json()).not.toHaveProperty('respuestas');
  });
  it.each([{ edad: 30 }, { grupo: 'embarazo' }])(
    'aplica también las restricciones por edad/grupo: %j',
    async (cambio) => {
      const r = await enviar({ ...respuestasFicticias, ...cambio });
      expect(r.json().pasillo.ocultasPorPerfil).toBe(1);
    },
  );
  it('rechaza respuestas desconocidas o con tipos incorrectos', async () => {
    expect((await enviar({ ...respuestasFicticias, alarma: 'no' })).statusCode).toBe(400);
    expect((await enviar({ ...respuestasFicticias, inventado: false })).statusCode).toBe(400);
  });
  it('no expone borradores ni permite usar protocolos sin condiciones ejecutables', async () => {
    await db.update(tabla).set({
      estado: 'borrador',
      json: { ...p, estado: 'borrador', validadoPor: null, validadoEn: null },
    });
    expect((await app.inject({ url: '/api/protocolos/tos' })).statusCode).toBe(503);
    expect((await enviar(respuestasFicticias)).statusCode).toBe(503);
    await db.update(tabla).set({
      estado: 'validada',
      json: {
        ...p,
        criteriosDerivacion: p.criteriosDerivacion.map(({ cuando: _cuando, ...c }) => c),
      },
    });
    expect((await app.inject({ url: '/api/protocolos/tos' })).statusCode).toBe(503);
    expect((await enviar(respuestasFicticias)).statusCode).toBe(503);
  });
  it('no confía en estado de BD si firma, estado JSON o versión no coinciden', async () => {
    for (const json of [
      { ...p, validadoPor: 'Otra firma' },
      { ...p, estado: 'borrador' },
      { ...p, version: 2 },
      { ...p, validadoEn: '2999-01-01' },
    ]) {
      await db.update(tabla).set({ json });
      expect((await enviar(respuestasFicticias)).statusCode).toBe(503);
    }
  });
  it('una versión distinta obliga a reiniciar las preguntas', async () => {
    const r = await enviar(respuestasFicticias, 2);
    expect(r.statusCode).toBe(409);
    expect(r.headers['cache-control']).toBe('no-store');
  });
  it('sin BD ni protocolo publicado no autoriza pasillos', async () => {
    expect((await sinBd.inject({ url: '/api/protocolos/tos' })).statusCode).toBe(503);
    expect(
      (
        await sinBd.inject({
          method: 'POST',
          url: '/api/triaje',
          payload: { protocoloId: 'tos', version: 1, respuestas: {} },
        })
      ).statusCode,
    ).toBe(503);
    expect((await app.inject({ url: '/api/protocolos/fiebre' })).statusCode).toBe(503);
  });
  it('no registra datos del paciente, queries, JSON malformado o cuerpos demasiado grandes', async () => {
    const canario = 'CANARIO_PRIVADO_FICTICIO';
    const peticiones = [
      {
        method: 'POST' as const,
        url: '/api/triaje',
        payload: { protocoloId: 'tos', version: 1, respuestas: { grupo: canario } },
      },
      {
        method: 'POST' as const,
        url: `/api/triaje?datos=${canario}`,
        payload: { protocoloId: 'tos', version: 1, respuestas: {} },
      },
      { method: 'POST' as const, url: '/api/triaje', payload: `{"${canario}` },
      { method: 'POST' as const, url: '/api/triaje', payload: canario.repeat(2000) },
      { method: 'GET' as const, url: `/api/triaje?datos=${canario}` },
      { method: 'GET' as const, url: `/api/protocolos/tos?datos=${canario}` },
    ];
    for (const peticion of peticiones) {
      const r = await app.inject({ ...peticion, headers: { 'content-type': 'application/json' } });
      expect(r.statusCode).toBeGreaterThanOrEqual(400);
      expect(r.body).not.toContain(canario);
      expect(r.headers['cache-control']).toBe('no-store');
    }
    await app.inject({ url: '/api/health' });
    expect(registros.join('')).toContain('/api/health');
    expect(registros.join('')).not.toContain(canario);
  });
});
