import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assetCaja, medicamento, syncEstado, type Db } from '@rebotica/db';
import { formaCajaDesde } from '@rebotica/shared';
import { eq, notInArray } from 'drizzle-orm';
import sharp from 'sharp';
import type { ClienteCima } from '../cliente';
import type { BaseDatos } from '../sync';
import { colorGrupo } from './grupo';
import { extraerPaleta, paletaDeCaja } from './paleta';

const CLAVE_HUELLA = 'assets.huella';
/** Súbela si cambia la paleta o la miniatura: fuerza a regenerar todo. */
const VERSION_GENERADOR = 'v2';
/** Lado largo de la miniatura que se sirve (CIMA no publica fotos mayores de 200 px). */
const LADO_MINIATURA = 200;

export interface OpcionesAssets {
  /** Carpeta persistente (volumen en Coolify): `fotos/` como caché y `miniaturas/` como salida. */
  directorio: string;
  cliente: ClienteCima;
  forzar?: boolean;
  log?: (mensaje: string) => void;
}

export interface InformeAssets {
  omitido: boolean;
  productos: number;
  conFoto: number;
  sinFoto: number;
  fotosDescargadas: number;
  fotosFallidas: number;
  miniaturas: number;
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

/** Escribe a un temporal y renombra: nunca se sirve un archivo a medias. */
async function escribirAtomico(ruta: string, datos: Uint8Array): Promise<void> {
  const temporal = `${ruta}.tmp`;
  await writeFile(temporal, datos);
  await rename(temporal, ruta);
}

/**
 * Para cada medicamento comercializado: descarga la miniatura de CIMA (si existe), extrae la
 * paleta de colores del envase, guarda una miniatura servible y rellena `asset_caja`. La caja 3D
 * se dibuja en el navegador con esa paleta y los datos del producto, también en la vitrina.
 */
export async function construirAssets(
  db: BaseDatos,
  opciones: OpcionesAssets,
): Promise<InformeAssets> {
  const inicio = Date.now();
  const conexion = db as unknown as Db;
  const log = opciones.log ?? (() => {});
  const carpetaFotos = join(opciones.directorio, 'fotos');
  const carpetaMiniaturas = join(opciones.directorio, 'miniaturas');

  const informe: InformeAssets = {
    omitido: false,
    productos: 0,
    conFoto: 0,
    sinFoto: 0,
    fotosDescargadas: 0,
    fotosFallidas: 0,
    miniaturas: 0,
    duracionMs: 0,
  };

  const productos = await conexion
    .select({
      nregistro: medicamento.nregistro,
      forma: medicamento.forma,
      atcs: medicamento.atcs,
      fotoUrl: medicamento.fotoUrl,
    })
    .from(medicamento)
    .where(eq(medicamento.comerc, true))
    .orderBy(medicamento.nregistro);
  informe.productos = productos.length;

  const huella = sha(JSON.stringify([VERSION_GENERADOR, productos])).slice(0, 16);
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

  await mkdir(carpetaFotos, { recursive: true });
  await mkdir(carpetaMiniaturas, { recursive: true });

  const filas: {
    nregistro: string;
    colorDominante: string;
    paleta: string[];
    forma: string;
    foto: string | null;
  }[] = [];
  const miniaturasVigentes = new Set<string>();

  for (const p of productos) {
    const respaldo = colorGrupo(p.atcs);
    let coloresFoto: string[] = [];
    let foto: string | null = null;

    if (p.fotoUrl) {
      try {
        const cache = join(carpetaFotos, `${p.nregistro}-${sha(p.fotoUrl).slice(0, 8)}.img`);
        let bytes = await leerSiExiste(cache);
        const descargada = !bytes;
        if (!bytes) bytes = await opciones.cliente.obtenerBinario(new URL(p.fotoUrl));
        if (bytes) {
          const imagen = sharp(bytes).flatten({ background: '#ffffff' });
          // Paleta: se reduce la foto y se cuentan los colores con presencia.
          const { data } = await imagen
            .clone()
            .resize(48, 48, { fit: 'inside' })
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
          coloresFoto = extraerPaleta(data);

          // Miniatura: sin márgenes blancos y con el nombre ligado al contenido.
          let recortada = imagen.clone();
          try {
            recortada = sharp(await imagen.clone().trim({ threshold: 18 }).toBuffer());
          } catch {
            // Imagen uniforme: no hay márgenes que recortar.
          }
          const webp = await recortada
            .resize(LADO_MINIATURA, LADO_MINIATURA, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 85 })
            .toBuffer();
          const nombre = `${p.nregistro}-${sha(webp).slice(0, 8)}.webp`;
          await escribirAtomico(join(carpetaMiniaturas, nombre), webp);
          miniaturasVigentes.add(nombre);
          foto = `/media/miniaturas/${nombre}`;

          // Solo se guarda en caché una foto que se ha podido decodificar.
          if (descargada) {
            await writeFile(cache, bytes);
            informe.fotosDescargadas++;
          }
          informe.conFoto++;
          informe.miniaturas++;
        }
      } catch (err) {
        // Una foto ausente o corrupta no debe tumbar el catálogo: la caja usa los colores del grupo.
        informe.fotosFallidas++;
        coloresFoto = [];
        foto = null;
        log(`foto de ${p.nregistro}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (!foto) informe.sinFoto++;

    const paleta = paletaDeCaja(coloresFoto, respaldo);
    filas.push({
      nregistro: p.nregistro,
      colorDominante: paleta[0] ?? respaldo,
      paleta,
      forma: formaCajaDesde(p.forma),
      foto,
    });
  }

  await conexion.transaction(async (tx) => {
    for (const f of filas) {
      await tx.insert(assetCaja).values(f).onConflictDoUpdate({
        target: assetCaja.nregistro,
        set: f,
      });
    }
    const ids = filas.map((f) => f.nregistro);
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

  // Limpieza: miniaturas de versiones anteriores y el antiguo directorio de atlas KTX2.
  for (const archivo of await readdir(carpetaMiniaturas)) {
    if (!miniaturasVigentes.has(archivo))
      await rm(join(carpetaMiniaturas, archivo), { force: true });
  }
  await rm(join(opciones.directorio, 'atlas'), { recursive: true, force: true });

  informe.duracionMs = Date.now() - inicio;
  return informe;
}
