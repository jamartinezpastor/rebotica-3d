import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
import { PGlite } from '@electric-sql/pglite';
import { medicamento, seccionFt } from '@rebotica/db';
import { InterpretarCatalogoRespuesta, prepararBusquedaIndicaciones } from '@rebotica/shared';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app';

const pg = new PGlite();
const db = drizzle(pg);
const logs: string[] = [];
const stream = new Writable({
  write(c, _e, done) {
    logs.push(String(c));
    done();
  },
});
const base = {
  protocoloId: null,
  confianza: 0.95,
  alarmasDetectadas: [],
  datosExtraidos: { paraQuien: 'desconocido', grupo: null, edad: null, duracion: null },
  necesitaAclarar: false,
  alternativas: [],
  busqueda: { tema: 'Llagas en la boca', terminos: ['aftas', 'úlceras bucales'] },
};
const clasificar = vi.fn().mockResolvedValue(base);
const app = buildApp({
  db,
  interpretacion: { clasificar },
  fastify: { logger: { level: 'trace', stream } },
});
beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../../packages/db/migrations', import.meta.url)),
  });
  for (const [id, receta, comerc, seccion, texto] of [
    ['A1', false, true, '4.1', 'Tratamiento local ficticio de las aftas bucales.'],
    ['A2', true, true, '4.1', 'Úlceras bucales en un contexto clínico ficticio distinto.'],
    ['A3', false, false, '4.1', 'Aftas.'],
    ['A4', false, true, '4.3', 'Advertencia ficticia relacionada con aftas y úlceras bucales.'],
    ['H1', false, true, '4.1', 'Herpes labial.'],
    ['E1', true, true, '4.1', 'Tratamiento de la disfunción eréctil.'],
    ['E2', true, true, '4.1', 'DISFUNCION ERECTIL.'],
    ['P1', true, true, '4.1', 'Eyaculación precoz.'],
    ['O1', false, true, '4.1', 'Hemorroides.'],
  ] as const) {
    await db.insert(medicamento).values({
      nregistro: id,
      nombre: `Producto ficticio ${id}`,
      pactivos: `Activo ficticio ${id}`,
      receta,
      comerc,
      atcs: [],
    });
    await db.insert(seccionFt).values({
      nregistro: id,
      seccion,
      titulo: 'Texto ficticio',
      html: `<p>${texto}</p>`,
      texto,
      hash: 'hash-ficticio',
    });
  }
});
afterAll(async () => {
  await app.close();
  await pg.close();
});
async function consultar(texto: string, resultado: unknown = base) {
  clasificar.mockResolvedValue(resultado);
  return app.inject({
    method: 'POST',
    url: '/api/interpretar',
    payload: { texto, modo: 'catalogo' },
  });
}
function registros(r: Awaited<ReturnType<typeof consultar>>) {
  const salida = InterpretarCatalogoRespuesta.parse(r.json());
  expect(salida.tipo).toBe('catalogo');
  if (salida.tipo !== 'catalogo') throw new Error('No es catálogo');
  return salida.pasillo;
}

describe('búsqueda informativa fuera de los chips (clasificador simulado)', () => {
  it('una llaga bucal abre todas las coincidencias de 4.1, separa receta y excluye advertencias y retirados', async () => {
    const r = await consultar('me ha salido una llaga en la boca');
    expect(r.statusCode).toBe(200);
    const p = registros(r);
    expect(p.baldas.flatMap((b) => b.productos.map((p) => p.nregistro))).toEqual(['A1']);
    expect(p.vitrina.flatMap((b) => b.productos.map((p) => p.nregistro))).toEqual(['A2']);
    expect(p.id).toBe('consulta-texto');
    expect(r.headers['cache-control']).toBe('no-store');
    expect(clasificar).toHaveBeenLastCalledWith(
      'me ha salido una llaga en la boca',
      expect.any(AbortSignal),
      'catalogo',
    );
  });
  it('mantener una erección encuentra varias marcas y genéricos sin mezclarlos con eyaculación precoz', async () => {
    const p = registros(
      await consultar('me gustaria que mis erecciones fueran mas duraderas', {
        ...base,
        busqueda: { tema: 'Duración de la erección', terminos: ['disfunción eréctil'] },
      }),
    );
    expect(p.baldas).toEqual([]);
    expect(p.vitrina.flatMap((b) => b.productos.map((p) => p.nregistro))).toEqual(['E1', 'E2']);
  });
  it('no limita la ampliación a esos dos ejemplos', async () => {
    const p = registros(
      await consultar('tengo hemorroides', {
        ...base,
        busqueda: { tema: 'Hemorroides', terminos: ['hemorroides'] },
      }),
    );
    expect(p.baldas.flatMap((b) => b.productos.map((p) => p.nregistro))).toEqual(['O1']);
  });
  it('sin coincidencias devuelve un catálogo vacío, sin completar con productos por activo', async () => {
    const p = registros(
      await consultar('consulta ficticia', {
        ...base,
        busqueda: { tema: 'Motivo ficticio', terminos: ['afección ficticia inexistente'] },
      }),
    );
    expect([...p.baldas, ...p.vitrina]).toEqual([]);
  });
  it('una alarma local prevalece sin consultar a Gemini', async () => {
    const n = clasificar.mock.calls.length;
    const r = await consultar('Tengo una llaga y no puedo respirar');
    expect(r.json()).toMatchObject({ tipo: 'derivacion', destino: '112' });
    expect(clasificar.mock.calls.length).toBe(n);
  });
  it('una alarma del modelo prevalece aunque proponga una búsqueda válida', async () => {
    const r = await consultar('Consulta sintética', {
      ...base,
      alarmasDetectadas: ['otra-urgencia'],
    });
    expect(r.json()).toMatchObject({ tipo: 'derivacion', destino: '112' });
    expect(r.json()).not.toHaveProperty('pasillo');
  });
  it.each([
    { ...base, confianza: 0.5 },
    { ...base, necesitaAclarar: true },
    { ...base, protocoloId: 'tos' },
    { ...base, busqueda: { tema: 'Tema demasiado genérico', terminos: ['tratamiento'] } },
  ])('no abre resultados ante incertidumbre o búsqueda indiscriminada %#', async (resultado) => {
    const r = await consultar('consulta ambigua', resultado);
    expect(r.json()).toMatchObject({ tipo: 'aclaracion' });
    expect(r.json()).not.toHaveProperty('pasillo');
  });
  it('rechaza instrucciones, dosis o productos que el proveedor intente añadir al contrato', async () => {
    const r = await consultar('consulta ficticia', {
      ...base,
      medicamentos: ['producto inventado'],
    });
    expect(r.statusCode).toBe(503);
    expect(r.body).not.toContain('producto inventado');
    const manipulada = await consultar('consulta ficticia', {
      ...base,
      busqueda: { tema: 'Ficticio', terminos: ['aftas.*'] },
    });
    expect(manipulada.statusCode).toBe(503);
  });
  it('el tema abierto no se convierte en autorización para el antiguo triaje', async () => {
    clasificar.mockResolvedValue(base);
    const r = await app.inject({
      method: 'POST',
      url: '/api/interpretar',
      payload: { texto: 'consulta ficticia' },
    });
    expect(r.statusCode).toBe(503);
  });
  it('no acepta búsqueda elegida por el cliente ni texto en URL', async () => {
    for (const [url, payload] of [
      ['/api/interpretar', { texto: 'privado', modo: 'catalogo', busqueda: base.busqueda }],
      ['/api/interpretar?texto=CANARIO_PRIVADO', { texto: 'privado', modo: 'catalogo' }],
    ] as const)
      expect((await app.inject({ method: 'POST', url, payload })).statusCode).toBe(400);
    expect(logs.join('')).not.toMatch(/CANARIO_PRIVADO|me ha salido|duraderas|busqueda|aftas/);
  });
  it('nunca muestra un catálogo alternativo si falta la base de datos', async () => {
    const sinBd = buildApp({ interpretacion: { clasificar: async () => base } });
    try {
      const r = await sinBd.inject({
        method: 'POST',
        url: '/api/interpretar',
        payload: { texto: 'consulta ficticia', modo: 'catalogo' },
      });
      expect(r.statusCode).toBe(503);
      expect(r.json()).toMatchObject({ codigo: 'CATALOGO_NO_CONFIGURADO' });
    } finally {
      await sinBd.close();
    }
  });
  it('no publica una etiqueta manipulada del modelo como consejo ni eco del texto', async () => {
    const r = await consultar('CANARIO_ETIQUETA', {
      ...base,
      busqueda: { ...base.busqueda, tema: 'CANARIO_ETIQUETA: toma un medicamento inventado' },
    });
    expect(registros(r).titulo).toBe('Medicamentos relacionados con la consulta');
    expect(r.body).not.toMatch(/CANARIO_ETIQUETA|toma un medicamento inventado/);
  });
});

describe('términos literales de indicación', () => {
  it('normaliza tildes y mayúsculas, deduplica y respeta palabras completas', () => {
    const buscar = prepararBusquedaIndicaciones(['úlceras bucales', 'ULCERAS BUCALES']);
    expect(buscar('Tratamiento de ÚLCERAS BUCALES.')).toBe(true);
    expect(buscar('Lesiones pseudoulceras bucales')).toBe(false);
  });
});
