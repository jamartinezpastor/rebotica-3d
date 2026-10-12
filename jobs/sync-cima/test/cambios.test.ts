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

  it('da de alta un medicamento nuevo sin receta y descarta uno nuevo con receta', async () => {
    cambios = [
      { nregistro: '3001', tipoCambio: 1, cambio: [] },
      { nregistro: '3002', tipoCambio: 1, cambio: [] },
    ];
    detalles = { '3002': detalle('3002', { receta: true }) };
    const informe = await sincronizarCambios(db, cliente(), new Date('2026-10-10'));
    expect(informe.nuevos).toBe(1);
    const nuevos = await db.select().from(medicamento).where(eq(medicamento.nregistro, '3001'));
    expect(nuevos).toHaveLength(1);
    expect(await db.select().from(medicamento).where(eq(medicamento.nregistro, '3002'))).toEqual(
      [],
    );
  });

  it('retira de las baldas lo que pasa a receta o deja de comercializarse', async () => {
    cambios = [{ nregistro: '1001', tipoCambio: 3, cambio: ['estado'] }];
    detalles = { '1001': detalle('1001', { receta: true }) };
    const informe = await sincronizarCambios(db, cliente(), new Date('2026-10-10'));
    expect(informe).toMatchObject({ retirados: 1, ahoraConReceta: 1 });
    const [m] = await db.select().from(medicamento).where(eq(medicamento.nregistro, '1001'));
    expect(m?.comerc).toBe(false);
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
