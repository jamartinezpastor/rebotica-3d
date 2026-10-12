import sharp from 'sharp';
import { dimensiones, type Orientacion } from './frontal';

export const ATLAS_LADO = 1024;

export function tilesPorPagina(orientacion: Orientacion): number {
  const { ancho, alto } = dimensiones(orientacion);
  return Math.floor(ATLAS_LADO / ancho) * Math.floor(ATLAS_LADO / alto);
}

export interface TileEntrada {
  id: string;
  png: Buffer;
  orientacion: Orientacion;
}

export interface EntradaAtlas {
  id: string;
  pagina: number;
  /** [u0, v0, u1, v1] normalizados; el origen (0,0) es la esquina superior izquierda. */
  uv: [number, number, number, number];
}

export interface PaginaAtlas {
  png: Buffer;
  orientacion: Orientacion;
}

/**
 * Coloca los tiles en páginas de 1024×1024, de izquierda a derecha y de arriba abajo. Cada
 * página contiene una sola orientación, para no desperdiciar espacio.
 */
export async function empaquetar(
  tiles: readonly TileEntrada[],
): Promise<{ paginas: PaginaAtlas[]; entradas: EntradaAtlas[] }> {
  const paginas: PaginaAtlas[] = [];
  const entradas: EntradaAtlas[] = [];
  for (const orientacion of ['apaisada', 'vertical'] as const) {
    const delGrupo = tiles.filter((t) => t.orientacion === orientacion);
    const { ancho, alto } = dimensiones(orientacion);
    const columnas = Math.floor(ATLAS_LADO / ancho);
    const porPagina = tilesPorPagina(orientacion);
    for (let inicio = 0; inicio < delGrupo.length; inicio += porPagina) {
      const grupo = delGrupo.slice(inicio, inicio + porPagina);
      const pagina = paginas.length;
      const composicion = grupo.map((tile, i) => {
        const left = (i % columnas) * ancho;
        const top = Math.floor(i / columnas) * alto;
        entradas.push({
          id: tile.id,
          pagina,
          uv: [
            left / ATLAS_LADO,
            top / ATLAS_LADO,
            (left + ancho) / ATLAS_LADO,
            (top + alto) / ATLAS_LADO,
          ],
        });
        return { input: tile.png, left, top };
      });
      const png = await sharp({
        create: { width: ATLAS_LADO, height: ATLAS_LADO, channels: 4, background: '#ffffff' },
      })
        .composite(composicion)
        .png()
        .toBuffer();
      paginas.push({ png, orientacion });
    }
  }
  return { paginas, entradas };
}

/** Comprime una página PNG a KTX2 (Basis ETC1S, con mipmaps) para texturas ligeras en móvil. */
export async function codificarKtx2(png: Buffer): Promise<Uint8Array> {
  const { encodeToKTX2 } = await import('ktx2-encoder');
  const imageDecoder = async (datos: Uint8Array) => {
    const { data, info } = await sharp(datos)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { width: info.width, height: info.height, data: new Uint8Array(data) };
  };
  return encodeToKTX2(new Uint8Array(png), {
    imageDecoder,
    isUASTC: false,
    isKTX2File: true,
    generateMipmap: true,
    qualityLevel: 128,
    enableDebug: false,
  });
}
