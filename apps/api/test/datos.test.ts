import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import {
  assetCaja,
  grupoReceta,
  medicamento,
  presentacion,
  protocolo,
  reglaDosis,
  seccionFt,
} from '@rebotica/db';
import { ReglaDosis } from '@rebotica/dosis';
import { ErrorResponse, PasilloResponse, ProductoResponse } from '@rebotica/shared';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

const pg = new PGlite();
const db = drizzle(pg);
const app = buildApp({ db });
const appSinBd = buildApp();

const HASH_VIGENTE = 'hash-vigente';

// Datos ficticios: los números de la regla no proceden de ninguna ficha técnica.
const reglaFicticia = (estado: 'validada' | 'borrador' = 'validada') => ({
  id: 'regla-ficticia',
  version: 1,
  fuente: {
    nregistro: '1001',
    seccion: '4.2',
    hashSeccion: HASH_VIGENTE,
    validadoPor: estado === 'validada' ? 'Farmacéutica Ficticia' : null,
    fecha: estado === 'validada' ? '2026-01-01' : null,
  },
  presentacion: {
    concentracion: 10,
    unidad: 'mg/ml',
    unidadToma: 'ml',
    pasoDosificable: 0.5,
    fraccionable: false,
  },
  tramos: [
    {
      modo: 'porPeso',
      edadMinMeses: 12,
      intervaloHoras: 6,
      mgKgToma: 2,
      maxMgKgDia: 8,
      maxMgToma: 50,
    },
  ],
  diasMaxSinConsultar: { dolor: 3 },
  bloqueos: [],
  avisos: [],
  estado,
});

const protocoloFicticio = (version: number, estado: 'borrador' | 'validado') => ({
  id: 'dolor-ficticio',
  version,
  titulo: `Dolor ficticio v${version}`,
  sinonimos: ['dolor'],
  preguntasTriaje: [],
  criteriosDerivacion: [
    { id: 'alarma', descripcion: 'Alarma ficticia', urgencia: '112', palabrasClave: ['alarma'] },
  ],
  baldas: [
    {
      titulo: 'Principio A',
      principioActivo: 'principio activo a',
      orden: 2,
      gruposExcluidos: [],
      condicionesExcluidas: [],
    },
    {
      titulo: 'Principio B',
      principioActivo: 'Ácido Ficticio',
      orden: 1,
      edadMinMeses: 24,
      gruposExcluidos: ['embarazo'],
      condicionesExcluidas: ['ulcera'],
    },
  ],
  vitrina: [
    {
      principioActivo: 'principio c',
      paraQueSeUsa: 'Para un dolor intenso.',
      porQueNecesitaReceta: 'Necesita valoración médica.',
      situacion: 'Si el dolor no cede.',
    },
  ],
  consejos: ['Descansa.'],
  parafarmacia: ['Suero fisiológico'],
  estado,
  validadoPor: estado === 'validado' ? 'Farmacéutica Ficticia' : null,
  validadoEn: estado === 'validado' ? '2026-01-01' : null,
});

const base = { comerc: true, receta: false, atcs: [] as string[] };

beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../../packages/db/migrations', import.meta.url)),
  });
  await db.insert(medicamento).values([
    {
      ...base,
      nregistro: '1001',
      nombre: 'MARCA UNO 10 mg/ml SOLUCION ORAL',
      pactivos: 'PRINCIPIO ACTIVO A',
      forma: 'SOLUCION ORAL',
      dosis: '10 mg/ml',
      labtitular: 'Laboratorio Ficticio',
      psum: true,
    },
    {
      ...base,
      nregistro: '1002',
      nombre: 'MARCA DOS 500 mg COMPRIMIDOS EFG',
      pactivos: 'principio activo a',
      forma: 'COMPRIMIDO',
      conduc: true,
    },
    // Asociación: no es el mismo principio activo que «principio activo a».
    { ...base, nregistro: '1003', nombre: 'COMBINADO', pactivos: 'PRINCIPIO ACTIVO A, OTRO' },
    // Con receta y retirado: nunca aparecen en las baldas.
    {
      ...base,
      receta: true,
      nregistro: '1004',
      nombre: 'MARCA RECETA',
      pactivos: 'PRINCIPIO ACTIVO A',
    },
    {
      ...base,
      comerc: false,
      nregistro: '1005',
      nombre: 'RETIRADO',
      pactivos: 'PRINCIPIO ACTIVO A',
    },
    // Escrito al revés que en el protocolo.
    { ...base, nregistro: '2001', nombre: 'FICTICIO ACIDO', pactivos: 'FICTICIO ACIDO' },
  ]);
  await db.insert(assetCaja).values({
    nregistro: '1001',
    atlasUrl: '/media/atlas/abc-0.ktx2',
    uv: [0, 0, 0.25, 0.25],
    colorDominante: '#336699',
    forma: 'caja-alta',
  });
  await db.insert(presentacion).values([
    { cn: '700001', nregistro: '1001', nombre: 'envase 100 ml', comerc: true, psum: true },
    { cn: '700002', nregistro: '1001', nombre: 'envase retirado', comerc: false },
  ]);
  await db.insert(seccionFt).values([
    {
      nregistro: '1001',
      seccion: '4.1',
      titulo: 'Indicaciones',
      html: '<p>x</p>',
      texto: 'Indicación ficticia.',
      hash: 'h41',
      resumenLlano: 'Resumen revisado.',
    },
    {
      nregistro: '1001',
      seccion: '4.2',
      titulo: 'Posología',
      html: '<p>x</p>',
      texto: 'Posología ficticia.',
      hash: HASH_VIGENTE,
    },
    {
      nregistro: '1002',
      seccion: '4.2',
      titulo: 'Posología',
      html: '<p>x</p>',
      texto: 'Otra posología ficticia.',
      hash: 'h-1002',
    },
  ]);
  await db.insert(reglaDosis).values([
    {
      nregistro: '1001',
      version: 1,
      json: reglaFicticia(),
      hashSeccion: HASH_VIGENTE,
      estado: 'validada',
    },
    // Su 4.2 cambió desde que se transcribió: no activa la calculadora.
    {
      nregistro: '1002',
      version: 1,
      json: reglaFicticia(),
      hashSeccion: 'antiguo',
      estado: 'validada',
    },
  ]);
  await db.insert(grupoReceta).values([
    { pactivo: 'principio c', forma: 'comprimido' },
    { pactivo: 'Principio C', forma: 'solución inyectable' },
  ]);
  await db.insert(protocolo).values([
    {
      id: 'dolor-ficticio',
      version: 1,
      json: protocoloFicticio(1, 'validado'),
      estado: 'validada',
      validadoPor: 'Farmacéutica Ficticia',
      validadoEn: new Date('2026-01-01'),
    },
    // Una versión posterior sin firmar no sustituye a la validada.
    {
      id: 'dolor-ficticio',
      version: 2,
      json: protocoloFicticio(2, 'borrador'),
      estado: 'borrador',
    },
    {
      id: 'solo-borrador',
      version: 1,
      json: { ...protocoloFicticio(1, 'borrador'), id: 'solo-borrador' },
    },
    { id: 'roto', version: 1, json: { nada: true } },
  ]);
});

afterAll(async () => {
  await app.close();
  await appSinBd.close();
  await pg.close();
});

const get = async (url: string) => app.inject({ method: 'GET', url });

describe('GET /api/pasillos/:id', () => {
  it('devuelve el pasillo validado con baldas ordenadas y productos del principio activo', async () => {
    const res = await get('/api/pasillos/dolor-ficticio');
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toContain('max-age');
    const pasillo = PasilloResponse.parse(res.json());

    expect(pasillo).toMatchObject({ id: 'dolor-ficticio', version: 1, estado: 'validado' });
    expect(pasillo.baldas.map((b) => b.titulo)).toEqual(['Principio B', 'Principio A']);
    expect(pasillo.ocultasPorPerfil).toBe(0);

    const [b, a] = pasillo.baldas;
    // «Ácido Ficticio» casa con «FICTICIO ACIDO» de CIMA.
    expect(b?.productos.map((p) => p.nregistro)).toEqual(['2001']);
    // Solo sin receta, comercializados y monocomponentes; por orden alfabético.
    expect(a?.productos.map((p) => p.nregistro)).toEqual(['1002', '1001']);
    expect(JSON.stringify(pasillo)).not.toMatch(/MARCA RECETA|RETIRADO|COMBINADO/);
  });

  it('informa de asset, forma de caja, genérico, conducción y calculadora vigente', async () => {
    const pasillo = PasilloResponse.parse((await get('/api/pasillos/dolor-ficticio')).json());
    const productos = pasillo.baldas.flatMap((b) => b.productos);
    const uno = productos.find((p) => p.nregistro === '1001');
    const dos = productos.find((p) => p.nregistro === '1002');
    expect(uno).toMatchObject({
      formaCaja: 'caja-alta',
      generico: false,
      asset: { atlasUrl: '/media/atlas/abc-0.ktx2', colorDominante: '#336699' },
      calculadora: true,
    });
    expect(dos).toMatchObject({ formaCaja: 'caja-plana', generico: true, conduccion: true });
    expect(dos?.asset).toBeNull();
    // Su regla está validada, pero la 4.2 ya no coincide: sin calculadora.
    expect(dos?.calculadora).toBe(false);
  });

  it('filtra las baldas según el perfil y cuenta las ocultas', async () => {
    const porEdad = PasilloResponse.parse(
      (await get('/api/pasillos/dolor-ficticio?edadMeses=12')).json(),
    );
    expect(porEdad.baldas.map((b) => b.titulo)).toEqual(['Principio A']);
    expect(porEdad.ocultasPorPerfil).toBe(1);

    const porGrupo = PasilloResponse.parse(
      (await get('/api/pasillos/dolor-ficticio?grupo=embarazo')).json(),
    );
    expect(porGrupo.baldas.map((b) => b.titulo)).toEqual(['Principio A']);

    const porCondicion = PasilloResponse.parse(
      (await get('/api/pasillos/dolor-ficticio?condiciones=asma,ulcera')).json(),
    );
    expect(porCondicion.ocultasPorPerfil).toBe(1);

    const adulto = PasilloResponse.parse(
      (await get('/api/pasillos/dolor-ficticio?grupo=adulto&edadMeses=400')).json(),
    );
    expect(adulto.baldas).toHaveLength(2);
  });

  it('la vitrina solo lleva principio activo, formas y texto explicativo', async () => {
    const pasillo = PasilloResponse.parse((await get('/api/pasillos/dolor-ficticio')).json());
    expect(pasillo.vitrina).toEqual([
      {
        principioActivo: 'principio c',
        formas: ['comprimido', 'solución inyectable'],
        paraQueSeUsa: 'Para un dolor intenso.',
        porQueNecesitaReceta: 'Necesita valoración médica.',
        situacion: 'Si el dolor no cede.',
      },
    ]);
    // Principio 1: ni marcas, ni registros, ni imágenes en la vitrina.
    const texto = JSON.stringify(pasillo.vitrina);
    expect(texto).not.toMatch(/nregistro|nombre|asset|atlas|foto|dosis/i);
  });

  it('un protocolo sin versión validada se sirve como borrador', async () => {
    const res = await get('/api/pasillos/solo-borrador');
    expect(PasilloResponse.parse(res.json()).estado).toBe('borrador');
  });

  it('responde 404 si no existe o el JSON es inválido, y 400 ante entradas no válidas', async () => {
    expect((await get('/api/pasillos/no-existe')).statusCode).toBe(404);
    expect((await get('/api/pasillos/roto')).statusCode).toBe(404);
    const malo = await get('/api/pasillos/Dolor_Ficticio');
    expect(malo.statusCode).toBe(400);
    ErrorResponse.parse(malo.json());
    expect((await get('/api/pasillos/dolor-ficticio?grupo=robot')).statusCode).toBe(400);
    expect((await get('/api/pasillos/dolor-ficticio?edadMeses=-3')).statusCode).toBe(400);
  });
});

describe('GET /api/productos/:nregistro', () => {
  it('devuelve la ficha con secciones, presentaciones comercializadas y regla vigente', async () => {
    const res = await get('/api/productos/1001');
    expect(res.statusCode).toBe(200);
    const ficha = ProductoResponse.parse(res.json());

    expect(ficha).toMatchObject({
      nregistro: '1001',
      laboratorio: 'Laboratorio Ficticio',
      formaCaja: 'caja-alta',
      problemaSuministro: true,
    });
    expect(ficha.presentaciones).toEqual([
      { cn: '700001', nombre: 'envase 100 ml', problemaSuministro: true },
    ]);
    expect(ficha.secciones.map((s) => s.seccion)).toEqual(['4.1', '4.2']);
    expect(ficha.secciones[0]?.resumenLlano).toBe('Resumen revisado.');
    expect(ficha.enlaces.prospecto).toBe('https://cima.aemps.es/cima/dochtml/p/1001/P_1001.html');
    // La regla que sale por la API cumple el esquema de @rebotica/dosis.
    expect(ReglaDosis.parse(ficha.reglaDosis).estado).toBe('validada');
  });

  it('no envía la regla si la 4.2 cambió, si no está validada o si el JSON no coincide', async () => {
    const desfasada = ProductoResponse.parse((await get('/api/productos/1002')).json());
    expect(desfasada.reglaDosis).toBeNull();

    // Sincronización: el estado de la columna pasa a «revisar».
    await db
      .update(reglaDosis)
      .set({ estado: 'revisar' })
      .where(and(eq(reglaDosis.nregistro, '1001'), eq(reglaDosis.version, 1)));
    const app2 = buildApp({ db });
    const enRevision = ProductoResponse.parse(
      (await app2.inject({ method: 'GET', url: '/api/productos/1001' })).json(),
    );
    expect(enRevision.reglaDosis).toBeNull();

    // JSON en borrador aunque la columna diga «validada»: tampoco.
    await db
      .update(reglaDosis)
      .set({ estado: 'validada', json: reglaFicticia('borrador') })
      .where(eq(reglaDosis.nregistro, '1001'));
    const app3 = buildApp({ db });
    const borrador = ProductoResponse.parse(
      (await app3.inject({ method: 'GET', url: '/api/productos/1001' })).json(),
    );
    expect(borrador.reglaDosis).toBeNull();

    await db
      .update(reglaDosis)
      .set({ estado: 'validada', json: reglaFicticia() })
      .where(eq(reglaDosis.nregistro, '1001'));
    await app2.close();
    await app3.close();
  });

  it('los medicamentos con receta y los retirados no tienen ficha', async () => {
    for (const id of ['1004', '1005', 'NOEXISTE']) {
      const res = await get(`/api/productos/${id}`);
      expect(res.statusCode).toBe(404);
      ErrorResponse.parse(res.json());
    }
    expect((await get('/api/productos/bad%20id')).statusCode).toBe(400);
  });
});

describe('sin base de datos', () => {
  it('las rutas de datos responden 503 en JSON', async () => {
    const res = await appSinBd.inject({ method: 'GET', url: '/api/pasillos/dolor-ficticio' });
    expect(res.statusCode).toBe(503);
    ErrorResponse.parse(res.json());
    const prod = await appSinBd.inject({ method: 'GET', url: '/api/productos/1001' });
    expect(prod.statusCode).toBe(503);
  });
});
