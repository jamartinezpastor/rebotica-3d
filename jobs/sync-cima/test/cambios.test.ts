import { PGlite } from '@electric-sql/pglite';
import { fileURLToPath } from 'node:url';
import { medicamento, reglaDosis, seccionFt, syncEstado } from '@rebotica/db';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sincronizacionDiaria, sincronizarCambios } from '../src/cambios';
import { crearClienteCima } from '../src/cliente';
import { hashTexto } from '../src/texto';

// Estado mutable de la CIMA simulada: cada test lo ajusta.
interface Cambio {
  nregistro: string;
  tipoCambio: number;
  cambio: string[];
}
let cambios: Cambio[] = [];
let posologia = 'Posología original.';
let detalles: Record<string, object | null> = {};
const peticiones: string[] = [];

const detalle = (n: string, extra: object = {}) => ({
  nregistro: n,
  nombre: `MARCA ${n}`,
  pactivos: 'principio ficticio',
  receta: false,
  comerc: true,
  notas: false,
  formaFarmaceutica: { nombre: 'COMPRIMIDO' },
  presentaciones: [{ cn: `${n}01`, nombre: 'envase', comerc: true }],
  ...extra,
});

const fetchSimulado = (async (entrada: URL | string | Request) => {
  const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
  peticiones.push(url.pathname + url.search);
  const resp = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo));
  const p = url.searchParams;
  if (url.pathname.endsWith('/registroCambios')) {
    const pagina = Number(p.get('pagina') ?? 1);
    return resp({
      totalFilas: cambios.length,
      pagina,
      tamanioPagina: 2,
      resultados: cambios.slice((pagina - 1) * 2, pagina * 2),
    });
  }
  if (url.pathname.endsWith('/medicamento')) {
    const n = p.get('nregistro') ?? '';
    const d = n in detalles ? detalles[n] : detalle(n);
    return d === null ? new Response(null, { status: 404 }) : resp(d);
  }
  if (url.pathname.includes('docSegmentado')) {
    return resp([
      { seccion: '4.1', titulo: 'Indicaciones', contenido: '<p>Indicación.</p>' },
      { seccion: '4.2', titulo: 'Posología', contenido: `<p>${posologia}</p>` },
    ]);
  }
  return new Response('{}', { status: 404 });
}) as typeof globalThis.fetch;

const cliente = () =>
  crearClienteCima({
    fetch: fetchSimulado,
    intervaloMs: 0,
    esperar: async () => {},
    maxReintentos: 1,
  });

const pg = new PGlite();
const db = drizzle(pg);
const hash = (texto: string) => hashTexto(texto);

beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../../packages/db/migrations', import.meta.url)),
  });
});
afterAll(() => pg.close());

async function sembrar() {
  await db.delete(reglaDosis);
  await db.delete(medicamento);
  await db.delete(syncEstado);
  await db.insert(medicamento).values({
    nregistro: '1001',
    nombre: 'MARCA 1001',
    pactivos: 'principio ficticio',
    receta: false,
    comerc: true,
  });
  await db.insert(seccionFt).values({
    nregistro: '1001',
    seccion: '4.2',
    titulo: 'Posología',
    html: '<p>Posología original.</p>',
    texto: 'Posología original.',
    hash: hash('Posología original.'),
    resumenLlano: 'Resumen revisado',
  });
  await db.insert(reglaDosis).values({
    nregistro: '1001',
    version: 1,
    json: {},
    hashSeccion: hash('Posología original.'),
    estado: 'validada',
  });
}

beforeEach(async () => {
  cambios = [];
  posologia = 'Posología original.';
  detalles = {};
  peticiones.length = 0;
  await sembrar();
});

const estadoRegla = async () =>
  (await db.select().from(reglaDosis).where(eq(reglaDosis.nregistro, '1001')))[0]?.estado;

describe('sincronizarCambios', () => {
  it('actualiza las notas de seguridad cuando cambia su registro en CIMA', async () => {
    cambios = [{ nregistro: '1001', tipoCambio: 3, cambio: ['notasSeguridad'] }];
    const informe = await sincronizarCambios(db, cliente(), new Date('2026-10-10'));
    expect(informe.errores).toEqual([]);
    expect(informe.releidos).toBe(1);
    const [fila] = await db.select().from(medicamento).where(eq(medicamento.nregistro, '1001'));
    expect(fila?.informacionCima).toMatchObject({ seguridad: { notas: [] } });
  });
  it('si cambia la 4.2, la regla pasa a revisar y se invalida el resumen', async () => {
    cambios = [{ nregistro: '1001', tipoCambio: 3, cambio: ['ft'] }];
    posologia = 'Posología modificada por la AEMPS.';
    const informe = await sincronizarCambios(db, cliente(), new Date('2026-10-10'));

    expect(informe.errores).toEqual([]);
    expect(informe).toMatchObject({ releidos: 1, reglasARevisar: 1 });
    expect(await estadoRegla()).toBe('revisar');
    const [seccion] = await db.select().from(seccionFt).where(eq(seccionFt.seccion, '4.2'));
    expect(seccion?.texto).toBe('Posología modificada por la AEMPS.');
    expect(seccion?.resumenLlano).toBeNull();
  });

  it('si la ficha cambia pero la 4.2 es igual, la regla sigue validada', async () => {
    cambios = [{ nregistro: '1001', tipoCambio: 3, cambio: ['ft'] }];
    const informe = await sincronizarCambios(db, cliente(), new Date('2026-10-10'));
    expect(informe.reglasARevisar).toBe(0);
    expect(await estadoRegla()).toBe('validada');
    const [seccion] = await db.select().from(seccionFt).where(eq(seccionFt.seccion, '4.2'));
    expect(seccion?.resumenLlano).toBe('Resumen revisado');
  });

  it('ignora medicamentos desconocidos con cambios menores y cambios irrelevantes', async () => {
    cambios = [
      { nregistro: '7777', tipoCambio: 3, cambio: ['ft'] },
      { nregistro: '1001', tipoCambio: 3, cambio: ['matinf', 'prosp'] },
    ];
    const informe = await sincronizarCambios(db, cliente(), new Date('2026-10-10'));
    expect(informe).toMatchObject({ cambiosListados: 2, conocidos: 1, releidos: 0, nuevos: 0 });
    expect(peticiones.filter((p) => p.includes('/medicamento?'))).toEqual([]);
  });

  it('da de alta medicamentos nuevos sin receta y con receta', async () => {
    cambios = [
      { nregistro: '3001', tipoCambio: 1, cambio: [] },
      { nregistro: '3002', tipoCambio: 1, cambio: [] },
    ];
    detalles = { '3002': detalle('3002', { receta: true }) };
    const informe = await sincronizarCambios(db, cliente(), new Date('2026-10-10'));
    expect(informe.nuevos).toBe(2);
    const nuevos = await db.select().from(medicamento).where(eq(medicamento.nregistro, '3001'));
    expect(nuevos).toHaveLength(1);
    expect(await db.select().from(medicamento).where(eq(medicamento.nregistro, '3002'))).toEqual([
      expect.objectContaining({ receta: true, comerc: true }),
    ]);
  });

  it('mueve a la vitrina lo que pasa a receta e invalida su regla aunque no cambie la 4.2', async () => {
    cambios = [{ nregistro: '1001', tipoCambio: 3, cambio: ['estado'] }];
    detalles = { '1001': detalle('1001', { receta: true }) };
    const informe = await sincronizarCambios(db, cliente(), new Date('2026-10-10'));
    expect(informe).toMatchObject({ retirados: 0, ahoraConReceta: 1, reglasARevisar: 1 });
    const [m] = await db.select().from(medicamento).where(eq(medicamento.nregistro, '1001'));
    expect(m).toMatchObject({ comerc: true, receta: true });
    expect(await estadoRegla()).toBe('revisar');
    expect((await db.select().from(reglaDosis))[0]?.receta).toBe(true);
  });

  it('una baja sin detalle conserva la fila pero la saca de las baldas', async () => {
    cambios = [{ nregistro: '1001', tipoCambio: 2, cambio: [] }];
    detalles = { '1001': null };
    const informe = await sincronizarCambios(db, cliente(), new Date('2026-10-10'));
    expect(informe.retirados).toBe(1);
    const [m] = await db.select().from(medicamento).where(eq(medicamento.nregistro, '1001'));
    expect(m?.comerc).toBe(false);
  });

  it('agrupa las entradas repetidas de un mismo medicamento y recorre las páginas', async () => {
    cambios = [
      { nregistro: '1001', tipoCambio: 3, cambio: ['matinf'] },
      { nregistro: '1001', tipoCambio: 3, cambio: ['ft'] },
      { nregistro: '9999', tipoCambio: 3, cambio: ['prosp'] },
    ];
    const informe = await sincronizarCambios(db, cliente(), new Date('2026-10-10'));
    expect(informe).toMatchObject({ cambiosListados: 3, releidos: 1 });
    expect(peticiones.filter((p) => p.includes('/medicamento?'))).toHaveLength(1);
  });
});

describe('sincronizacionDiaria', () => {
  it('un fallo de notas no bloquea el catálogo y se reintenta en la siguiente pasada', async () => {
    await db
      .insert(syncEstado)
      .values({ clave: 'cima.ultima_sincronizacion', valor: '2026-10-10T00:00:00.000Z' });
    detalles = { '1001': detalle('1001', { notas: true }) };
    const resultado = await sincronizacionDiaria(db, cliente(), {
      ahora: () => new Date('2026-10-11T00:00:00.000Z'),
    });
    expect(resultado.informe.errores).toEqual([]);
    const [primera] = await db.select().from(medicamento).where(eq(medicamento.nregistro, '1001'));
    expect(primera?.informacionCima).toMatchObject({ seguridad: null });
    const [marca] = await db.select().from(syncEstado);
    expect(marca?.valor).toBe('2026-10-11T00:00:00.000Z');
    detalles = { '1001': detalle('1001', { notas: false }) };
    await sincronizacionDiaria(db, cliente());
    const [segunda] = await db.select().from(medicamento).where(eq(medicamento.nregistro, '1001'));
    expect(segunda?.informacionCima).toMatchObject({ seguridad: { notas: [] } });
  });
  it('completa los datos de un catálogo existente aunque no haya cambios en CIMA', async () => {
    await db
      .insert(syncEstado)
      .values({ clave: 'cima.ultima_sincronizacion', valor: '2026-10-10T00:00:00.000Z' });
    const resultado = await sincronizacionDiaria(db, cliente());
    expect(resultado.informe.errores).toEqual([]);
    const [fila] = await db.select().from(medicamento).where(eq(medicamento.nregistro, '1001'));
    expect(fila?.informacionCima).toMatchObject({
      suministro: { incidencias: [] },
      seguridad: { notas: [] },
    });
    peticiones.length = 0;
    await sincronizacionDiaria(db, cliente());
    expect(peticiones.filter((p) => p.includes('/medicamento?'))).toHaveLength(0);
  });
  it.each([
    { forzarCompleto: false, anterior: false },
    { forzarCompleto: true, anterior: false },
    { forzarCompleto: false, anterior: true },
  ])(
    'recupera una carga interrumpida sin perder productos (forzar=$forzarCompleto, previa=$anterior)',
    async ({ forzarCompleto, anterior }) => {
      let interrumpir = true;
      const consultas: string[] = [];
      const fetch = (async (entrada: URL | string | Request) => {
        const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
        consultas.push(url.pathname + url.search);
        if (url.pathname.endsWith('/medicamentos')) {
          const receta = url.searchParams.get('receta') === '1';
          if (receta && interrumpir) return new Response('{}', { status: 503 });
          const resultados = (receta ? ['2001'] : ['1001', '1002']).map((nregistro) => ({
            nregistro,
            nombre: 'Producto ficticio',
            receta,
            comerc: true,
            vtm: { nombre: 'activo ficticio' },
          }));
          return Response.json({
            totalFilas: resultados.length,
            pagina: 1,
            tamanioPagina: 25,
            resultados,
          });
        }
        return fetchSimulado(entrada);
      }) as typeof globalThis.fetch;
      const crear = () => crearClienteCima({ fetch, intervaloMs: 0, maxReintentos: 0 });
      detalles = { '2001': detalle('2001', { receta: true }) };
      const inicio = new Date();
      if (anterior)
        await db.insert(syncEstado).values({
          clave: 'cima.ultima_sincronizacion',
          valor: '2026-10-01T00:00:00.000Z',
        });
      const primera = await sincronizacionDiaria(db, crear(), {
        ahora: () => inicio,
        forzarCompleto: anterior,
      });
      expect(primera.informe.errores).toHaveLength(1);
      expect(await db.select().from(medicamento)).toHaveLength(2);
      expect(
        await db
          .select()
          .from(syncEstado)
          .where(eq(syncEstado.clave, 'cima.ultima_sincronizacion')),
      ).toHaveLength(anterior ? 1 : 0);

      interrumpir = false;
      consultas.length = 0;
      const reanudacion = new Date(Date.now() + 1000);
      const segunda = await sincronizacionDiaria(db, crear(), {
        ahora: () => reanudacion,
        forzarCompleto,
      });
      if (segunda.modo !== 'completo') throw new Error('Debe continuar la carga completa');
      expect(segunda.informe.errores).toEqual([]);
      expect(segunda.informe.sinReceta.reutilizados).toBe(forzarCompleto ? 0 : 2);
      expect(segunda.informe.vitrina.sincronizados).toBe(1);
      expect(consultas.filter((url) => /\/medicamento\?nregistro=100[12]$/.test(url))).toHaveLength(
        forzarCompleto ? 2 : 0,
      );
      expect((await db.select().from(medicamento)).map((m) => m.nregistro).sort()).toEqual([
        '1001',
        '1002',
        '2001',
      ]);
      const [marca] = await db.select().from(syncEstado);
      expect(marca).toMatchObject({
        clave: 'cima.ultima_sincronizacion',
        valor: (forzarCompleto ? reanudacion : inicio).toISOString(),
      });
    },
  );
  it('la primera vez es completa y guarda la marca; después solo lee cambios', async () => {
    const ahora = () => new Date('2026-10-12T03:00:00Z');
    // Sin listado simulado de /medicamentos: la pasada completa termina sin datos y sin errores.
    const primera = await sincronizacionDiaria(db, cliente(), { ahora });
    expect(primera.modo).toBe('completo');
    const [marca] = await db.select().from(syncEstado);
    expect(marca?.valor).toBe('2026-10-12T03:00:00.000Z');

    const segunda = await sincronizacionDiaria(db, cliente(), {
      ahora: () => new Date('2026-10-13T03:00:00Z'),
    });
    expect(segunda.modo).toBe('cambios');
    // Un día de solape respecto a la marca.
    expect(segunda.informe).toMatchObject({ desde: '2026-10-11' });
  });

  it('no avanza la marca si hubo errores', async () => {
    await db
      .insert(syncEstado)
      .values({ clave: 'cima.ultima_sincronizacion', valor: '2026-10-10T00:00:00.000Z' });
    cambios = [{ nregistro: '1001', tipoCambio: 3, cambio: ['ft'] }];
    detalles = { '1001': { forma: 'inesperada' } };
    const r = await sincronizacionDiaria(db, cliente(), {
      ahora: () => new Date('2026-10-12T00:00:00Z'),
    });
    expect(r.informe.errores).toHaveLength(1);
    const [marca] = await db.select().from(syncEstado);
    expect(marca?.valor).toBe('2026-10-10T00:00:00.000Z');
  });
});
