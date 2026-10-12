import { PGlite } from '@electric-sql/pglite';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetCaja, medicamento } from '@rebotica/db';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { construirAssets } from '../src/assets/construir';
import { colorGrupo, COLORES_GRUPO } from '../src/assets/grupo';
import { ajustarLuz, aHex, deHex, extraerPaleta, paletaDeCaja } from '../src/assets/paleta';
import type { ClienteCima } from '../src/cliente';
import { categoriaDe } from '../src/sync';
import { categoriaLegible } from '../src/texto';

const pg = new PGlite();
const db = drizzle(pg);
let directorio: string;
let descargas: string[];
let fotoAzulAmarilla: Uint8Array;

const clienteFalso = (): ClienteCima => ({
  peticiones: 0,
  obtener: async () => null,
  obtenerBinario: async (url) => {
    descargas.push(url.toString());
    if (url.toString().includes('rota')) return new Uint8Array([1, 2, 3]);
    if (url.toString().includes('ausente')) return null;
    return fotoAzulAmarilla;
  },
});

const base = { comerc: true, receta: false };

/** Envase ficticio: caja azul con una banda amarilla sobre fondo blanco. */
async function crearFoto(): Promise<Uint8Array> {
  const banda = await sharp({
    create: { width: 60, height: 20, channels: 3, background: '#f2c200' },
  })
    .png()
    .toBuffer();
  const caja = await sharp({
    create: { width: 120, height: 90, channels: 3, background: '#1f4fa8' },
  })
    .composite([{ input: banda, left: 30, top: 60 }])
    .png()
    .toBuffer();
  const foto = await sharp({
    create: { width: 200, height: 140, channels: 3, background: '#ffffff' },
  })
    .composite([{ input: caja, left: 40, top: 25 }])
    .jpeg({ quality: 95 })
    .toBuffer();
  return new Uint8Array(foto);
}

beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../../packages/db/migrations', import.meta.url)),
  });
  fotoAzulAmarilla = await crearFoto();
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
      nombre: 'CON FOTO',
      pactivos: 'a',
      forma: 'COMPRIMIDO',
      atcs: ['N02B'],
      fotoUrl: 'https://example.invalid/1.jpg',
    },
    {
      ...base,
      nregistro: '2',
      nombre: 'SIN FOTO',
      pactivos: 'b',
      forma: 'JARABE',
      atcs: ['R05CB01'],
      fotoUrl: null,
    },
    {
      ...base,
      nregistro: '3',
      nombre: 'FOTO ROTA',
      pactivos: 'c',
      forma: 'CREMA',
      atcs: ['D02AX'],
      fotoUrl: 'https://example.invalid/rota.jpg',
    },
    {
      ...base,
      nregistro: '4',
      nombre: 'FOTO AUSENTE',
      pactivos: 'd',
      forma: 'SOBRE',
      atcs: [],
      fotoUrl: 'https://example.invalid/ausente.jpg',
    },
    { ...base, comerc: false, nregistro: '5', nombre: 'RETIRADO', pactivos: 'x' },
  ]);
});

afterAll(async () => {
  if (directorio) await rm(directorio, { recursive: true, force: true });
});

describe('construirAssets', () => {
  it('crea un asset_caja por producto comercializado con su paleta y miniatura', async () => {
    const informe = await construirAssets(db, { directorio, cliente: clienteFalso() });
    expect(informe).toMatchObject({
      omitido: false,
      productos: 4,
      conFoto: 1,
      sinFoto: 3,
      fotosDescargadas: 1,
      fotosFallidas: 1,
      miniaturas: 1,
    });

    const filas = await db.select().from(assetCaja);
    const porId = new Map(filas.map((f) => [f.nregistro, f]));
    expect(filas.map((f) => f.nregistro).sort()).toEqual(['1', '2', '3', '4']);

    // La foto aporta su paleta: el azul de la caja y el amarillo de la banda.
    const uno = porId.get('1');
    expect(uno?.forma).toBe('caja-plana');
    expect(uno?.paleta.length).toBeGreaterThanOrEqual(2);
    const [r, g, b] = deHex(uno?.colorDominante ?? '#000000');
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
    expect(uno?.paleta[0]).toBe(uno?.colorDominante);
    const hayAmarillo = (uno?.paleta ?? []).some((c) => {
      const [rr, gg, bb] = deHex(c);
      return rr > 180 && gg > 150 && bb < 100;
    });
    expect(hayAmarillo).toBe(true);
    expect(uno?.foto).toMatch(/^\/media\/miniaturas\/1-[0-9a-f]{8}\.webp$/);

    // Sin foto, falla o no existe: colores del grupo terapéutico y sin miniatura.
    for (const id of ['2', '3', '4']) {
      const f = porId.get(id);
      expect(f?.foto).toBeNull();
      expect(f?.paleta.length).toBeGreaterThanOrEqual(2);
      expect(COLORES_GRUPO).toContain(f?.colorDominante);
    }
    expect(porId.get('2')?.colorDominante).toBe(colorGrupo(['R05CB01']));
    expect(porId.get('2')?.forma).toBe('caja-alta');
    expect(porId.get('3')?.forma).toBe('tubo');
  });

  it('guarda una miniatura WebP de como mucho 200 px y no deja el atlas antiguo', async () => {
    await mkdir(join(directorio, 'atlas'), { recursive: true });
    await writeFile(join(directorio, 'atlas', 'viejo-0.ktx2'), 'antiguo');
    await construirAssets(db, { directorio, cliente: clienteFalso() });

    const archivos = await readdir(join(directorio, 'miniaturas'));
    expect(archivos).toHaveLength(1);
    const meta = await sharp(join(directorio, 'miniaturas', archivos[0] ?? '')).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(200);
    // Se recortan los márgenes blancos: la miniatura es más pequeña que la foto de 200×140.
    expect((meta.width ?? 0) * (meta.height ?? 0)).toBeLessThan(200 * 140);
    expect(await readdir(directorio)).not.toContain('atlas');
  });

  it('no repite trabajo si nada ha cambiado y reutiliza la caché de fotos', async () => {
    await construirAssets(db, { directorio, cliente: clienteFalso() });
    descargas.length = 0;
    const segunda = await construirAssets(db, { directorio, cliente: clienteFalso() });
    expect(segunda.omitido).toBe(true);
    expect(descargas).toEqual([]);

    const tercera = await construirAssets(db, {
      directorio,
      cliente: clienteFalso(),
      forzar: true,
    });
    expect(tercera.omitido).toBe(false);
    expect(tercera.fotosDescargadas).toBe(0);
    expect(descargas.filter((d) => d.includes('/1.jpg'))).toEqual([]);
  });

  it('elimina el asset de un producto que ya no se comercializa', async () => {
    await construirAssets(db, { directorio, cliente: clienteFalso() });
    await db.update(medicamento).set({ comerc: false }).where(eq(medicamento.nregistro, '4'));
    await construirAssets(db, { directorio, cliente: clienteFalso() });
    const filas = await db.select().from(assetCaja);
    expect(filas.map((f) => f.nregistro).sort()).toEqual(['1', '2', '3']);
  });

  it('borra las miniaturas que ya no corresponden a ningún producto', async () => {
    await construirAssets(db, { directorio, cliente: clienteFalso() });
    await writeFile(join(directorio, 'miniaturas', '99-deadbeef.webp'), 'huérfana');
    await construirAssets(db, { directorio, cliente: clienteFalso(), forzar: true });
    expect(await readdir(join(directorio, 'miniaturas'))).toHaveLength(1);
  });

  it('la base rechaza una paleta o una foto con formato no válido', async () => {
    await expect(
      db.insert(assetCaja).values({
        nregistro: '1',
        colorDominante: '#336699',
        paleta: ['azul'],
        forma: 'caja-plana',
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(assetCaja).values({
        nregistro: '1',
        colorDominante: '#336699',
        paleta: ['#336699'],
        forma: 'caja-plana',
        foto: 'https://otro.example/x.jpg',
      }),
    ).rejects.toThrow();
  });
});

describe('extraerPaleta', () => {
  const pixeles = (...bloques: [string, number][]) =>
    Uint8Array.from(
      bloques.flatMap(([color, n]) => Array.from({ length: n }).flatMap(() => deHex(color))),
    );

  it('ordena los colores por presencia e ignora blancos, grises y negros', () => {
    const rgb = pixeles(
      ['#ffffff', 500],
      ['#808080', 200],
      ['#101010', 100],
      ['#1f4fa8', 300],
      ['#f2c200', 120],
    );
    const paleta = extraerPaleta(rgb);
    expect(paleta).toHaveLength(2);
    expect(deHex(paleta[0] ?? '#000000')[2]).toBeGreaterThan(130); // azul primero
    expect(deHex(paleta[1] ?? '#000000')[0]).toBeGreaterThan(200); // amarillo después
  });

  it('funde tonos parecidos en un solo color', () => {
    const rgb = pixeles(['#1f4fa8', 200], ['#2455ad', 150], ['#1a49a0', 100]);
    expect(extraerPaleta(rgb)).toHaveLength(1);
  });

  it('descarta colores casi inexistentes y respeta el máximo', () => {
    const rgb = pixeles(['#1f4fa8', 1000], ['#e03030', 10], ['#2faa4f', 400], ['#f2c200', 300]);
    const paleta = extraerPaleta(rgb, { max: 2 });
    expect(paleta).toHaveLength(2);
    expect(extraerPaleta(rgb, { max: 5 })).not.toContain('#e03030');
  });

  it('un envase en blanco y negro no tiene paleta', () => {
    expect(extraerPaleta(pixeles(['#ffffff', 100], ['#000000', 100], ['#999999', 50]))).toEqual([]);
    expect(extraerPaleta(new Uint8Array())).toEqual([]);
  });
});

describe('paletaDeCaja', () => {
  it('usa la de la foto y, sin ella, la del grupo; siempre al menos dos colores', () => {
    expect(paletaDeCaja(['#1f4fa8', '#f2c200'], '#000000')).toEqual(['#1f4fa8', '#f2c200']);
    const sola = paletaDeCaja(['#1f4fa8'], '#000000');
    expect(sola).toHaveLength(2);
    expect(sola[1]).toBe(ajustarLuz('#1f4fa8', 0.6));
    const respaldo = paletaDeCaja([], '#2b6b5e');
    expect(respaldo[0]).toBe('#2b6b5e');
    expect(respaldo).toHaveLength(2);
  });

  it('ajustarLuz oscurece y aclara sin salirse de rango', () => {
    expect(ajustarLuz('#808080', 0.5)).toBe('#404040');
    expect(ajustarLuz('#000000', 1.5)).toBe('#808080');
    expect(aHex(300, -4, 12.4)).toBe('#ff000c');
    expect(() => deHex('rojo')).toThrow(RangeError);
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
      const [r, g, b] = deHex(hex).map((c) => {
        const x = c / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
    };
    for (const color of COLORES_GRUPO) {
      expect(1.05 / (luminancia(color) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('categoría del producto', () => {
  it('pone en frase normal el nombre ATC de CIMA y le devuelve las tildes habituales', () => {
    expect(categoriaLegible('OTROS ANALGESICOS Y ANTIPIRETICOS')).toBe(
      'Otros analgésicos y antipiréticos',
    );
    expect(categoriaLegible('  ANTIACIDOS  ')).toBe('Antiácidos');
    expect(categoriaLegible('PALABRA DESCONOCIDA')).toBe('Palabra desconocida');
  });

  it('toma el nivel 3 de los ATC del detalle, o el 4 si falta', () => {
    expect(
      categoriaDe({
        atcs: [
          { codigo: 'N02B', nombre: 'OTROS ANALGESICOS Y ANTIPIRETICOS', nivel: 3 },
          { codigo: 'N02BA', nombre: 'Acido salicilico y derivados', nivel: 4 },
        ],
      }),
    ).toBe('Otros analgésicos y antipiréticos');
    expect(categoriaDe({ atcs: [{ codigo: 'N02BA', nombre: 'ACIDO SALICILICO', nivel: 4 }] })).toBe(
      'Ácido salicilico',
    );
    expect(categoriaDe({ atcs: [{ codigo: 'N02B' }] })).toBeNull();
    expect(categoriaDe({ atcs: [] })).toBeNull();
  });
});
