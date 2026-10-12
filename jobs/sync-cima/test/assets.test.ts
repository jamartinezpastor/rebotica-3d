import { PGlite } from '@electric-sql/pglite';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetCaja, medicamento } from '@rebotica/db';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { codificarKtx2, tilesPorPagina } from '../src/assets/atlas';
import { construirAssets } from '../src/assets/construir';
import { ajustarLineas, colorDominante, svgFrontal } from '../src/assets/frontal';
import { colorGrupo, COLORES_GRUPO } from '../src/assets/grupo';
import type { ClienteCima } from '../src/cliente';

const pg = new PGlite();
const db = drizzle(pg);
let directorio: string;
let descargas: string[];
let fotoRoja: Uint8Array;

const clienteFalso = (): ClienteCima => ({
  peticiones: 0,
  obtener: async () => null,
  obtenerBinario: async (url) => {
    descargas.push(url.toString());
    if (url.toString().includes('rota')) return new Uint8Array([1, 2, 3]);
    if (url.toString().includes('ausente')) return null;
    return fotoRoja;
  },
});

const codificarFalso = async (png: Buffer) => new Uint8Array(png.subarray(0, 16));

const base = { comerc: true, receta: false };

beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../../packages/db/migrations', import.meta.url)),
  });
  fotoRoja = new Uint8Array(
    await sharp({ create: { width: 113, height: 200, channels: 3, background: '#cc2222' } })
      .jpeg()
      .toBuffer(),
  );
});
afterAll(() => pg.close());

beforeEach(async () => {
  directorio = await mkdtemp(join(tmpdir(), 'rebotica-assets-'));
  descargas = [];
  await db.delete(assetCaja);
  await db.delete(medicamento);
  await db.insert(medicamento).values([
    {
      ...base,
      nregistro: '1',
      nombre: 'CON FOTO 500 mg COMPRIMIDOS',
      pactivos: 'principio a',
      forma: 'COMPRIMIDO',
      atcs: ['N02B', 'N02BA01'],
      fotoUrl: 'https://example.invalid/1.jpg',
    },
    {
      ...base,
      nregistro: '2',
      nombre: 'SIN FOTO JARABE',
      pactivos: 'principio b',
      dosis: '120 mg/5 ml',
      forma: 'JARABE',
      atcs: ['R05CB01'],
      fotoUrl: null,
    },
    {
      ...base,
      nregistro: '3',
      nombre: 'FOTO ROTA CREMA',
      pactivos: 'principio c',
      forma: 'CREMA',
      atcs: ['D02AX'],
      fotoUrl: 'https://example.invalid/rota.jpg',
    },
    {
      ...base,
      nregistro: '4',
      nombre: 'FOTO AUSENTE',
      pactivos: 'principio d',
      forma: 'SOBRE',
      atcs: [],
      fotoUrl: 'https://example.invalid/ausente.jpg',
    },
    // No comercializado: no entra en las baldas ni en el atlas.
    { ...base, comerc: false, nregistro: '5', nombre: 'RETIRADO', pactivos: 'x' },
  ]);
});

describe('construirAssets', () => {
  it('crea un asset_caja por producto comercializado, con foto o textura generada', async () => {
    const informe = await construirAssets(db, {
      directorio,
      cliente: clienteFalso(),
      codificar: codificarFalso,
    });
    expect(informe).toMatchObject({
      omitido: false,
      productos: 4,
      conFoto: 1,
      generados: 3,
      fotosDescargadas: 1,
      fotosFallidas: 1,
      paginas: 2,
    });

    const filas = await db.select().from(assetCaja);
    expect(filas.map((f) => f.nregistro).sort()).toEqual(['1', '2', '3', '4']);
    for (const f of filas) {
      expect(f.colorDominante).toMatch(/^#[0-9a-f]{6}$/i);
      expect(f.uv).toHaveLength(4);
      expect(f.atlasUrl).toMatch(/^\/media\/atlas\/[0-9a-f]{16}-[01]\.ktx2$/);
    }
    const porId = new Map(filas.map((f) => [f.nregistro, f]));
    expect(porId.get('1')?.forma).toBe('caja-plana');
    expect(porId.get('2')?.forma).toBe('caja-alta');
    expect(porId.get('3')?.forma).toBe('tubo');
    expect(porId.get('4')?.forma).toBe('caja-cuadrada');
    // El color dominante de la foto roja sale de la foto, no del grupo terapéutico.
    expect(porId.get('1')?.colorDominante.toLowerCase()).toMatch(/^#c[0-9a-f]2[0-9a-f]2[0-9a-f]$/);
    // Los uv son rectángulos distintos dentro de [0, 1].
    const uvs = new Set(filas.map((f) => f.uv.join(',')));
    expect(uvs.size).toBe(4);
    for (const f of filas) expect(f.uv.every((n) => n >= 0 && n <= 1)).toBe(true);

    expect(
      (await readdir(join(directorio, 'atlas'))).filter((a) => a.endsWith('.ktx2')),
    ).toHaveLength(2);
  });

  it('no repite trabajo si nada ha cambiado y reutiliza la caché de fotos', async () => {
    await construirAssets(db, { directorio, cliente: clienteFalso(), codificar: codificarFalso });
    descargas.length = 0;
    const segunda = await construirAssets(db, {
      directorio,
      cliente: clienteFalso(),
      codificar: codificarFalso,
    });
    expect(segunda.omitido).toBe(true);
    expect(descargas).toEqual([]);

    // Forzando, la foto sale de la caché de disco y no se vuelve a descargar.
    const tercera = await construirAssets(db, {
      directorio,
      cliente: clienteFalso(),
      codificar: codificarFalso,
      forzar: true,
    });
    expect(tercera.omitido).toBe(false);
    expect(tercera.fotosDescargadas).toBe(0);
    expect(descargas.filter((d) => d.includes('/1.jpg'))).toEqual([]);
  });

  it('regenera y limpia los atlas antiguos cuando cambia el catálogo', async () => {
    await construirAssets(db, { directorio, cliente: clienteFalso(), codificar: codificarFalso });
    const antes = await readdir(join(directorio, 'atlas'));
    await db.update(medicamento).set({ nombre: 'CAMBIADO' }).where(eq(medicamento.nregistro, '2'));
    const informe = await construirAssets(db, {
      directorio,
      cliente: clienteFalso(),
      codificar: codificarFalso,
    });
    expect(informe.omitido).toBe(false);
    const despues = await readdir(join(directorio, 'atlas'));
    expect(despues).toHaveLength(2);
    expect(despues.some((a) => antes.includes(a))).toBe(false);
  });

  it('elimina el asset de un producto que ya no se comercializa', async () => {
    await construirAssets(db, { directorio, cliente: clienteFalso(), codificar: codificarFalso });
    await db.update(medicamento).set({ comerc: false }).where(eq(medicamento.nregistro, '4'));
    await construirAssets(db, { directorio, cliente: clienteFalso(), codificar: codificarFalso });
    const filas = await db.select().from(assetCaja);
    expect(filas.map((f) => f.nregistro).sort()).toEqual(['1', '2', '3']);
  });

  it('el atlas real se comprime a KTX2', async () => {
    const png = await sharp({
      create: { width: 1024, height: 1024, channels: 4, background: '#336699' },
    })
      .png()
      .toBuffer();
    const ktx2 = await codificarKtx2(png);
    // Identificador de archivo KTX2: «KTX 20».
    expect(Buffer.from(ktx2.subarray(1, 7)).toString('latin1')).toBe('KTX 20');
    expect(ktx2.length).toBeLessThan(png.length);
  });

  afterAll(async () => {
    if (directorio) await rm(directorio, { recursive: true, force: true });
  });
});

describe('piezas del frontal', () => {
  it('ajustarLineas parte y recorta con puntos suspensivos', () => {
    expect(ajustarLineas('uno dos tres cuatro', 8, 4)).toEqual(['uno dos', 'tres', 'cuatro']);
    const recortado = ajustarLineas('aaa bbb ccc ddd eee fff', 7, 2);
    expect(recortado).toHaveLength(2);
    expect(recortado[1]?.endsWith('…')).toBe(true);
    expect(ajustarLineas('supercalifragilistico', 8, 1)[0]).toBe('superca…');
  });

  it('el SVG escapa caracteres peligrosos', () => {
    const svg = svgFrontal({
      nombre: '<script>"x" & y',
      pactivos: 'a<b',
      dosis: null,
      color: '#000000',
    });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;SCRIPT&gt;');
  });

  it('cada página admite varios tiles', () => {
    expect(tilesPorPagina('vertical')).toBe(28);
    expect(tilesPorPagina('apaisada')).toBe(28);
  });
});

describe('colorDominante', () => {
  it('ignora blancos y grises y devuelve el color más frecuente', () => {
    const pixeles: number[] = [];
    for (let i = 0; i < 100; i++) pixeles.push(250, 250, 250); // fondo
    for (let i = 0; i < 30; i++) pixeles.push(20, 60, 200); // azul
    for (let i = 0; i < 10; i++) pixeles.push(220, 30, 30); // rojo
    expect(colorDominante(Uint8Array.from(pixeles))).toMatch(/^#1[0-9a-f]3[0-9a-f]c[0-9a-f]$/i);
  });

  it('devuelve null si no hay color', () => {
    expect(colorDominante(Uint8Array.from([255, 255, 255, 128, 128, 128]))).toBeNull();
  });
});

describe('colorGrupo', () => {
  it('usa la letra ATC del código más específico y un color por defecto', () => {
    expect(colorGrupo(['N02B', 'N02BA01'])).toBe(colorGrupo(['N02BE01']));
    expect(colorGrupo(['N02B'])).not.toBe(colorGrupo(['R05']));
    expect(colorGrupo([])).toBe(colorGrupo(['X99']));
  });

  it('todos los colores dan contraste AA con texto blanco', () => {
    const luminancia = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
    };
    for (const color of COLORES_GRUPO) {
      expect(1.05 / (luminancia(color) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
