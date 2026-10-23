import { PGlite } from '@electric-sql/pglite';
import { fileURLToPath } from 'node:url';
import { grupoReceta, medicamento, presentacion, reglaDosis, seccionFt } from '@rebotica/db';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearClienteCima } from '../src/cliente';
import { guardarMedicamento, quitarMarcas, sincronizar } from '../src/sync';
import { Detalle, SeccionesFT } from '../src/esquemas';

// Datos ficticios con la forma de las respuestas de CIMA.
const SIN_RECETA = [
  { nregistro: '1001', nombre: 'MARCA UNO 500 mg', receta: false, comerc: true },
  { nregistro: '1002', nombre: 'MARCA DOS 500 mg EFG', receta: false, comerc: true },
  { nregistro: '1003', nombre: 'MARCA TRES', receta: false, comerc: true },
];
const CON_RECETA = [
  {
    nregistro: '2001',
    nombre: 'MARCA RECETA UNO',
    receta: true,
    comerc: true,
    cpresc: 'Con receta médica',
    vtm: { nombre: 'principio ficticio a' },
    formaFarmaceuticaSimplificada: { nombre: 'COMPRIMIDO' },
  },
  {
    nregistro: '2002',
    nombre: 'MARCA RECETA DOS',
    receta: true,
    comerc: true,
    cpresc: 'Con receta médica. Diagnóstico hospitalario',
    vtm: { nombre: 'principio ficticio a' },
    formaFarmaceuticaSimplificada: { nombre: 'COMPRIMIDO' },
  },
  {
    nregistro: '2003',
    nombre: 'OTRA MARCA',
    receta: true,
    comerc: true,
    vtm: null,
  },
];

const detalle = (n: string, extra: object = {}) => ({
  nregistro: n,
  nombre: `MARCA ${n}`,
  pactivos: 'principio ficticio',
  labtitular: 'Laboratorio ficticio',
  receta: false,
  comerc: true,
  conduc: false,
  triangulo: false,
  psum: false,
  dosis: '500 mg',
  formaFarmaceutica: { nombre: 'COMPRIMIDO' },
  principiosActivos: [{ nombre: 'PRINCIPIO FICTICIO' }],
  atcs: [{ codigo: 'N02B' }, { codigo: 'N02BX99' }],
  presentaciones: [
    { cn: `${n}01`, nombre: 'envase 20', comerc: true },
    { cn: `${n}02`, nombre: 'envase 40', comerc: false },
  ],
  fotos: [
    { tipo: 'materialas', url: `https://example.invalid/${n}.jpg` },
    { tipo: 'formafarmac', url: `https://example.invalid/${n}-f.jpg` },
  ],
  ...extra,
});

const secciones = (n: string) => [
  { seccion: '1', titulo: 'NOMBRE', contenido: '<p>no se guarda</p>' },
  // Sección padre sin contenido, como la devuelve CIMA.
  { seccion: '4', titulo: 'DATOS CLÍNICOS' },
  {
    seccion: '4.1',
    titulo: 'Indicaciones',
    contenido: n.startsWith('2')
      ? '<p>Marca Receta Uno está indicado para el alivio sintomático.</p>'
      : `<p>Alivio sintomático ${n}.</p>`,
  },
  { seccion: '4.2', titulo: 'Posología', contenido: `<p>Texto de posología ${n}.</p>` },
  { seccion: '4.3', titulo: 'Contraindicaciones', contenido: '<p>Alergia.</p>' },
];

function cimaSimulada(opciones: { fallaDetalle?: string; sinSecciones?: string } = {}) {
  const fetch = async (entrada: URL | string | Request): Promise<Response> => {
    const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
    const resp = (cuerpo: unknown) => new Response(JSON.stringify(cuerpo));
    const p = url.searchParams;
    if (url.pathname.endsWith('/medicamentos')) {
      const todos = p.get('receta') === '1' ? CON_RECETA : SIN_RECETA;
      // Páginas de 2 para ejercitar la paginación.
      const pagina = Number(p.get('pagina') ?? 1);
      return resp({
        totalFilas: todos.length,
        pagina,
        tamanioPagina: 2,
        resultados: todos.slice((pagina - 1) * 2, pagina * 2),
      });
    }
    if (url.pathname.endsWith('/medicamento')) {
      const n = p.get('nregistro') ?? '';
      if (n === opciones.fallaDetalle) return new Response('{}', { status: 400 });
      if (n === '1003') return resp(detalle(n, { receta: true })); // inconsistencia: se omite
      return resp(
        detalle(n, n.startsWith('2') ? { receta: true, pactivos: 'principio ficticio a' } : {}),
      );
    }
    if (url.pathname.includes('docSegmentado')) {
      if (p.get('nregistro') === opciones.sinSecciones)
        return resp({ error: 'No existen secciones para el medicamento indicado' });
      const s = secciones(p.get('nregistro') ?? '');
      const una = p.get('seccion');
      return resp(una ? s.filter((x) => x.seccion === una) : s);
    }
    return new Response('{}', { status: 404 });
  };
  return fetch as typeof globalThis.fetch;
}

const cliente = new PGlite();
const db = drizzle(cliente);
const nuevoCliente = (f: typeof globalThis.fetch) =>
  crearClienteCima({ fetch: f, intervaloMs: 0, esperar: async () => {}, maxReintentos: 1 });

beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../../packages/db/migrations', import.meta.url)),
  });
});
afterAll(() => cliente.close());

describe('quitarMarcas', () => {
  it('sustituye el nombre comercial por el principio activo', () => {
    const texto = 'Abrilia Plus está indicado para la tos. ABRILIA también.';
    expect(quitarMarcas(texto, ['ABRILIA PLUS 20 MG COMPRIMIDOS EFG', 'ABRILIA 10 MG'], 'x')).toBe(
      'x está indicado para la tos. x también.',
    );
  });

  it('sustituye el sujeto corto de «está indicado» aunque la marca no tenga cifras', () => {
    expect(
      quitarMarcas('Abrysvo está indicado para inmunizar.', ['ABRYSVO polvo'], 'vacuna x'),
    ).toBe('vacuna x está indicado para inmunizar.');
    // Si hay una coma o un complemento largo no se toca.
    const texto = 'En adultos, el fármaco está indicado para la tos.';
    expect(quitarMarcas(texto, [], 'x')).toBe(texto);
  });

  it('no falla con símbolos propios de las expresiones regulares', () => {
    expect(quitarMarcas('A.A.S. (forte) sirve', ['A.A.S. (FORTE) 100 mg'], 'p')).toBe('p sirve');
  });
});

describe('sincronizar', () => {
  it('guarda el catálogo sin receta, presentaciones, secciones 4.x y grupos de la vitrina', async () => {
    const informe = await sincronizar(db, nuevoCliente(cimaSimulada()));

    expect(informe.errores).toEqual([]);
    expect(informe.sinReceta).toMatchObject({
      listados: 3,
      sincronizados: 2,
      omitidos: 1,
      presentaciones: 4,
      secciones: 6,
      sinPosologia: 0,
    });
    expect(informe.vitrina).toMatchObject({
      medicamentosConReceta: 3,
      grupos: 1,
      conIndicacion: 1,
      sinPrincipioActivo: 1,
    });

    const meds = await db.select().from(medicamento);
    expect(meds.map((m) => m.nregistro).sort()).toEqual(['1001', '1002', '2001', '2002', '2003']);
    expect(meds.find((m) => m.nregistro === '2001')).toMatchObject({
      receta: true,
      fotoUrl: 'https://example.invalid/2001.jpg',
    });
    expect(meds.find((m) => m.nregistro === '1001')).toMatchObject({
      pactivos: 'principio ficticio',
      fotoUrl: 'https://example.invalid/1001.jpg',
      atcs: ['N02B', 'N02BX99'],
    });

    expect(await db.select().from(presentacion)).toHaveLength(10);
    const secs = await db.select().from(seccionFt).where(eq(seccionFt.nregistro, '1001'));
    expect(secs.map((s) => s.seccion).sort()).toEqual(['4.1', '4.2', '4.3']);
    expect(secs.find((s) => s.seccion === '4.2')).toMatchObject({
      texto: 'Texto de posología 1001.',
      hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });

  it('la vitrina no guarda marcas ni nombres comerciales', async () => {
    const grupos = await db.select().from(grupoReceta);
    expect(grupos).toHaveLength(1);
    expect(grupos[0]).toMatchObject({
      pactivo: 'principio ficticio a',
      forma: 'comprimido',
      indicacion: 'principio ficticio a está indicado para el alivio sintomático.',
      condicionesPrescripcion: 'Con receta médica; Con receta médica. Diagnóstico hospitalario',
    });
    expect(JSON.stringify(grupos)).not.toMatch(/MARCA/i);
    expect(await db.select().from(medicamento).where(eq(medicamento.receta, true))).toHaveLength(3);
  });

  it('es idempotente y no toca las reglas de dosis', async () => {
    await db
      .insert(reglaDosis)
      .values({ nregistro: '1001', version: 1, json: {}, hashSeccion: 'h' });
    const informe = await sincronizar(db, nuevoCliente(cimaSimulada()));
    expect(informe.errores).toEqual([]);
    expect(await db.select().from(medicamento)).toHaveLength(5);
    expect(await db.select().from(presentacion)).toHaveLength(10);
    expect(await db.select().from(grupoReceta)).toHaveLength(1);
    expect(await db.select().from(reglaDosis)).toHaveLength(1);
  });

  it('conserva un medicamento sin secciones disponibles sin bloquear la carga completa', async () => {
    const informe = await sincronizar(db, nuevoCliente(cimaSimulada({ sinSecciones: '1002' })));
    expect(informe.errores).toEqual([]);
    expect(informe.sinReceta.sincronizados).toBe(2);
    expect(informe.sinReceta.sinPosologia).toBe(1);
    expect(
      await db.select().from(medicamento).where(eq(medicamento.nregistro, '1002')),
    ).toHaveLength(1);
    expect(await db.select().from(seccionFt).where(eq(seccionFt.nregistro, '1002'))).toEqual([]);
    expect(() => SeccionesFT.parse({ error: 'Error distinto o temporal' })).toThrow();
    expect(() => SeccionesFT.parse([{ seccion: '4.1' }])).toThrow();
  });

  it('un fallo en un medicamento no detiene el resto y se informa', async () => {
    const informe = await sincronizar(db, nuevoCliente(cimaSimulada({ fallaDetalle: '1002' })));
    expect(informe.errores).toHaveLength(1);
    expect(informe.errores[0]?.contexto).toBe('medicamento 1002');
    expect(informe.sinReceta.sincronizados).toBe(1);
    // Con errores no se retira nada del catálogo.
    expect(informe.sinReceta.retirados).toBe(0);
  });

  it('retira lo que ya no aparece en CIMA, sin borrarlo', async () => {
    await db.insert(medicamento).values({
      nregistro: '9999',
      nombre: 'RETIRADO',
      pactivos: 'x',
      receta: false,
      comerc: true,
    });
    const informe = await sincronizar(db, nuevoCliente(cimaSimulada()));
    expect(informe.sinReceta.retirados).toBe(1);
    const [retirado] = await db.select().from(medicamento).where(eq(medicamento.nregistro, '9999'));
    expect(retirado?.comerc).toBe(false);
  });

  it('guarda la 4.2 completa y exige revisar la regla si cambia un subapartado', async () => {
    const d = Detalle.parse(detalle('FICTICIO-SUBAPARTADOS'));
    const partes = [
      { seccion: '4.2', titulo: 'Posología ficticia' },
      { seccion: '4.2.1', titulo: 'Dosis ficticia', contenido: '<p>Posología ficticia.</p>' },
      { seccion: '4.2.2', titulo: 'Administración ficticia', contenido: '<p>Forma ficticia.</p>' },
    ];
    await guardarMedicamento(db, d, partes);
    const [actual] = await db.select().from(seccionFt).where(eq(seccionFt.nregistro, d.nregistro));
    expect(actual?.texto).toBe('Posología ficticia.\n\nForma ficticia.');
    await db.insert(reglaDosis).values({
      nregistro: d.nregistro,
      version: 1,
      json: {},
      hashSeccion: actual!.hash,
      estado: 'validada',
    });
    partes[2]!.contenido = '<p>Administración modificada ficticia.</p>';
    expect((await guardarMedicamento(db, d, partes)).reglasARevisar).toBe(1);
    const [regla] = await db.select().from(reglaDosis).where(eq(reglaDosis.nregistro, d.nregistro));
    expect(regla?.estado).toBe('revisar');
  });

  it('con límite solo procesa esa cantidad y no retira nada', async () => {
    const informe = await sincronizar(db, nuevoCliente(cimaSimulada()), { limite: 1 });
    expect(informe.sinReceta.sincronizados).toBe(1);
    expect(informe.sinReceta.retirados).toBe(0);
    expect(informe.vitrina.grupos).toBe(1);
  });
});
