import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assetCaja, medicamento, syncEstado, type Db } from '@rebotica/db';
import { formaCajaDesde } from '@rebotica/shared';
import { eq, notInArray } from 'drizzle-orm';
import type { ClienteCima } from '../cliente';
import type { BaseDatos } from '../sync';
import { codificarKtx2, empaquetar, type TileEntrada } from './atlas';
import { frontalDesdeFoto, generarFrontal, orientacionDe } from './frontal';
import { colorGrupo } from './grupo';

const CLAVE_HUELLA = 'assets.huella';
/** Súbela si cambia el diseño del frontal o del atlas: fuerza a regenerar todo. */
const VERSION_GENERADOR = 'v1';

export interface OpcionesAssets {
  /** Carpeta persistente (volumen en Coolify): `fotos/` como caché y `atlas/` como salida. */
  directorio: string;
  cliente: ClienteCima;
  /** Prefijo público de los atlas guardado en `asset_caja.atlas_url`. */
  urlBase?: string;
  /** Sustituible en tests; por defecto, KTX2 (Basis ETC1S). */
  codificar?: (png: Buffer) => Promise<Uint8Array>;
  extension?: string;
  forzar?: boolean;
  log?: (mensaje: string) => void;
}

export interface InformeAssets {
  omitido: boolean;
  productos: number;
  conFoto: number;
  generados: number;
  fotosDescargadas: number;
  fotosFallidas: number;
  paginas: number;
  bytesAtlas: number;
  duracionMs: number;
}

const sha = (datos: string | Uint8Array) => createHash('sha256').update(datos).digest('hex');

async function leerSiExiste(ruta: string): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await readFile(ruta));
  } catch {
    return null;
  }
}

/**
 * Genera la cara frontal de cada medicamento comercializado (foto de CIMA o textura generada),
 * la empaqueta en atlas KTX2 y rellena `asset_caja`. Los medicamentos con receta nunca llegan
 * aquí: la tabla `medicamento` solo contiene los de las baldas.
 */
export async function construirAssets(
  db: BaseDatos,
  opciones: OpcionesAssets,
): Promise<InformeAssets> {
  const inicio = Date.now();
  const conexion = db as unknown as Db;
  const log = opciones.log ?? (() => {});
  const urlBase = (opciones.urlBase ?? '/media').replace(/\/$/, '');
  const codificar = opciones.codificar ?? codificarKtx2;
  const extension = opciones.extension ?? 'ktx2';
  const carpetaAtlas = join(opciones.directorio, 'atlas');
  const carpetaFotos = join(opciones.directorio, 'fotos');

  const informe: InformeAssets = {
    omitido: false,
    productos: 0,
    conFoto: 0,
    generados: 0,
    fotosDescargadas: 0,
    fotosFallidas: 0,
    paginas: 0,
    bytesAtlas: 0,
    duracionMs: 0,
  };

  const filas = await conexion
    .select({
      nregistro: medicamento.nregistro,
      nombre: medicamento.nombre,
      pactivos: medicamento.pactivos,
      dosis: medicamento.dosis,
      forma: medicamento.forma,
      atcs: medicamento.atcs,
      fotoUrl: medicamento.fotoUrl,
    })
    .from(medicamento)
    .where(eq(medicamento.comerc, true));
  // Por grupo ATC, para que una balda caiga en pocas páginas del atlas.
  const productos = filas.sort((a, b) => {
    const ka = [...a.atcs].sort((x, y) => y.length - x.length)[0] ?? 'ZZZ';
    const kb = [...b.atcs].sort((x, y) => y.length - x.length)[0] ?? 'ZZZ';
    return ka.localeCompare(kb) || a.nregistro.localeCompare(b.nregistro);
  });
  informe.productos = productos.length;

  const huella = sha(JSON.stringify([VERSION_GENERADOR, extension, productos])).slice(0, 16);
  const [guardada] = await conexion
    .select({ valor: syncEstado.valor })
    .from(syncEstado)
    .where(eq(syncEstado.clave, CLAVE_HUELLA));
  if (!opciones.forzar && guardada?.valor === huella) {
    const existentes = await conexion.select({ n: assetCaja.nregistro }).from(assetCaja);
    if (existentes.length === productos.length) {
      informe.omitido = true;
      informe.duracionMs = Date.now() - inicio;
      return informe;
    }
  }

  await mkdir(carpetaAtlas, { recursive: true });
  await mkdir(carpetaFotos, { recursive: true });

  // 1. Una cara frontal por producto.
  const tiles: TileEntrada[] = [];
  const colores = new Map<string, string>();
  for (const p of productos) {
    const colorGrupoProducto = colorGrupo(p.atcs);
    const orientacion = orientacionDe(formaCajaDesde(p.forma));
    let tile: Buffer | null = null;
    let dominante = colorGrupoProducto;

    if (p.fotoUrl) {
      try {
        const cache = join(carpetaFotos, `${p.nregistro}-${sha(p.fotoUrl).slice(0, 8)}.img`);
        let foto = await leerSiExiste(cache);
        const descargada = !foto;
        if (!foto) foto = await opciones.cliente.obtenerBinario(new URL(p.fotoUrl));
        if (foto) {
          const frontal = await frontalDesdeFoto(foto, orientacion, colorGrupoProducto);
          // Solo se guarda en caché una foto que se ha podido decodificar.
          if (descargada) {
            await writeFile(cache, foto);
            informe.fotosDescargadas++;
          }
          tile = frontal.png;
          dominante = frontal.colorDominante;
          informe.conFoto++;
        }
      } catch (err) {
        // Una foto ausente o corrupta no debe tumbar el catálogo: se genera la textura.
        informe.fotosFallidas++;
        log(`foto de ${p.nregistro}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (!tile) {
      tile = await generarFrontal(
        { nombre: p.nombre, pactivos: p.pactivos, dosis: p.dosis, color: colorGrupoProducto },
        orientacion,
      );
      informe.generados++;
    }
    tiles.push({ id: p.nregistro, png: tile, orientacion });
    colores.set(p.nregistro, dominante);
  }

  // 2. Atlas comprimidos; se escribe a un temporal y se renombra, para no servir archivos a medias.
  const { paginas, entradas } = await empaquetar(tiles);
  const nombres: string[] = [];
  for (const [i, pagina] of paginas.entries()) {
    const nombre = `${huella}-${i}.${extension}`;
    const datos = await codificar(pagina.png);
    const temporal = join(carpetaAtlas, `${nombre}.tmp`);
    await writeFile(temporal, datos);
    await rename(temporal, join(carpetaAtlas, nombre));
    nombres.push(nombre);
    informe.bytesAtlas += datos.length;
  }
  informe.paginas = paginas.length;

  // 3. Filas de asset_caja: una por producto.
  const formas = new Map(productos.map((p) => [p.nregistro, formaCajaDesde(p.forma)]));
  await conexion.transaction(async (tx) => {
    for (const e of entradas) {
      const valores = {
        nregistro: e.id,
        atlasUrl: `${urlBase}/atlas/${nombres[e.pagina]}`,
        uv: e.uv,
        colorDominante: colores.get(e.id) ?? '#4f5963',
        forma: formas.get(e.id) ?? 'caja-plana',
      };
      await tx
        .insert(assetCaja)
        .values(valores)
        .onConflictDoUpdate({ target: assetCaja.nregistro, set: valores });
    }
    const ids = entradas.map((e) => e.id);
    if (ids.length > 0) await tx.delete(assetCaja).where(notInArray(assetCaja.nregistro, ids));
    else await tx.delete(assetCaja);
    await tx
      .insert(syncEstado)
      .values({ clave: CLAVE_HUELLA, valor: huella })
      .onConflictDoUpdate({
        target: syncEstado.clave,
        set: { valor: huella, actualizadoEn: new Date() },
      });
  });

  // 4. Limpieza de atlas de versiones anteriores, ya sin referencias en la base.
  for (const archivo of await readdir(carpetaAtlas)) {
    if (!nombres.includes(archivo)) await rm(join(carpetaAtlas, archivo), { force: true });
  }
  await stat(carpetaAtlas);

  informe.duracionMs = Date.now() - inicio;
  return informe;
}
