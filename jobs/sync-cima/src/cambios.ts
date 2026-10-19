import { medicamento, syncEstado, type Db } from '@rebotica/db';
import { eq, inArray } from 'drizzle-orm';
import type { ClienteCima } from './cliente';
import { urlFichaTecnica, urlMedicamento, urlRegistroCambios } from './cima';
import { Detalle, PaginaCambios, SeccionesFT } from './esquemas';
import { guardarMedicamento, sincronizar, type BaseDatos, type Informe } from './sync';

const CLAVE_ULTIMA = 'cima.ultima_sincronizacion';
const DIA_MS = 24 * 60 * 60 * 1000;
const MAX_ERRORES_INFORME = 50;

/** Cambios de CIMA que obligan a releer un medicamento que ya tenemos. */
const CAMBIOS_RELEVANTES = new Set(['ft', 'estado', 'comerc', 'psum']);

export interface InformeCambios {
  desde: string;
  cambiosListados: number;
  conocidos: number;
  releidos: number;
  nuevos: number;
  retirados: number;
  ahoraConReceta: number;
  reglasARevisar: number;
  errores: { contexto: string; mensaje: string }[];
  peticiones: number;
  duracionMs: number;
}

export async function leerUltimaSincronizacion(db: BaseDatos): Promise<Date | null> {
  const conexion = db as unknown as Db;
  const [fila] = await conexion
    .select({ valor: syncEstado.valor })
    .from(syncEstado)
    .where(eq(syncEstado.clave, CLAVE_ULTIMA));
  if (!fila) return null;
  const fecha = new Date(fila.valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export async function guardarUltimaSincronizacion(db: BaseDatos, fecha: Date): Promise<void> {
  const conexion = db as unknown as Db;
  const valor = fecha.toISOString();
  await conexion
    .insert(syncEstado)
    .values({ clave: CLAVE_ULTIMA, valor })
    .onConflictDoUpdate({
      target: syncEstado.clave,
      set: { valor, actualizadoEn: new Date() },
    });
}

/**
 * Sincronización incremental: relee solo los medicamentos que el registro de cambios de CIMA
 * marca como modificados desde `desde`. Si cambia la sección 4.2, las reglas de dosis de ese
 * medicamento pasan a `revisar` (lo hace `guardarMedicamento`).
 */
export async function sincronizarCambios(
  db: BaseDatos,
  cliente: ClienteCima,
  desde: Date,
  opciones: { log?: (mensaje: string) => void } = {},
): Promise<InformeCambios> {
  const inicio = Date.now();
  const log = opciones.log ?? (() => {});
  const conexion = db as unknown as Db;
  const informe: InformeCambios = {
    desde: desde.toISOString().slice(0, 10),
    cambiosListados: 0,
    conocidos: 0,
    releidos: 0,
    nuevos: 0,
    retirados: 0,
    ahoraConReceta: 0,
    reglasARevisar: 0,
    errores: [],
    peticiones: 0,
    duracionMs: 0,
  };
  const registrarError = (contexto: string, err: unknown) => {
    const mensaje = err instanceof Error ? err.message : String(err);
    if (informe.errores.length < MAX_ERRORES_INFORME) informe.errores.push({ contexto, mensaje });
    log(`error en ${contexto}: ${mensaje}`);
  };

  // 1. Todo el registro de cambios, agrupado por medicamento (puede repetirse).
  const cambios = new Map<string, { alta: boolean; baja: boolean; campos: Set<string> }>();
  for (let pagina = 1; ; pagina++) {
    const datos = await cliente.obtener(urlRegistroCambios(desde, pagina), PaginaCambios);
    if (!datos || datos.resultados.length === 0) break;
    for (const c of datos.resultados) {
      informe.cambiosListados++;
      const previo = cambios.get(c.nregistro) ?? {
        alta: false,
        baja: false,
        campos: new Set<string>(),
      };
      previo.alta ||= c.tipoCambio === 1;
      previo.baja ||= c.tipoCambio === 2;
      for (const campo of c.cambio) previo.campos.add(campo);
      cambios.set(c.nregistro, previo);
    }
    if (pagina * datos.tamanioPagina >= datos.totalFilas) break;
  }

  // 2. Releer los conocidos y las altas o cambios de estado de ambos catálogos.
  const ids = [...cambios.keys()];
  const conocidos = new Set<string>();
  for (let i = 0; i < ids.length; i += 500) {
    const filas = await conexion
      .select({ nregistro: medicamento.nregistro })
      .from(medicamento)
      .where(inArray(medicamento.nregistro, ids.slice(i, i + 500)));
    for (const f of filas) conocidos.add(f.nregistro);
  }
  informe.conocidos = conocidos.size;

  for (const [nregistro, cambio] of cambios) {
    const esConocido = conocidos.has(nregistro);
    const relevante =
      cambio.baja ||
      cambio.alta ||
      [...cambio.campos].some((campo) => CAMBIOS_RELEVANTES.has(campo));
    if (!relevante) continue;
    // Un desconocido solo puede interesar si es nuevo o ha cambiado de situación.
    if (
      !esConocido &&
      !cambio.alta &&
      !cambio.campos.has('estado') &&
      !cambio.campos.has('comerc')
    ) {
      continue;
    }

    try {
      const detalle = await cliente.obtener(urlMedicamento(nregistro), Detalle);
      if (!detalle) {
        // Sin detalle: CIMA ya no lo sirve. Se conserva, pero fuera de las baldas.
        if (esConocido) await retirar(conexion, nregistro, informe);
        continue;
      }
      if (!detalle.comerc) {
        if (esConocido) {
          await retirar(conexion, nregistro, informe);
        }
        continue;
      }
      if (esConocido && detalle.receta) {
        const [anterior] = await conexion
          .select({ receta: medicamento.receta })
          .from(medicamento)
          .where(eq(medicamento.nregistro, nregistro));
        if (anterior && !anterior.receta) informe.ahoraConReceta++;
      }
      const secciones = (await cliente.obtener(urlFichaTecnica(nregistro), SeccionesFT)) ?? [];
      const resultado = await guardarMedicamento(conexion, detalle, secciones);
      informe.reglasARevisar += resultado.reglasARevisar;
      if (esConocido) informe.releidos++;
      else informe.nuevos++;
    } catch (err) {
      registrarError(`medicamento ${nregistro}`, err);
    }
  }

  informe.peticiones = cliente.peticiones;
  informe.duracionMs = Date.now() - inicio;
  return informe;
}

async function retirar(db: Db, nregistro: string, informe: InformeCambios): Promise<void> {
  const filas = await db
    .update(medicamento)
    .set({ comerc: false, actualizadoEn: new Date() })
    .where(eq(medicamento.nregistro, nregistro))
    .returning({ nregistro: medicamento.nregistro });
  informe.retirados += filas.length;
}

export type ResultadoDiario =
  { modo: 'completo'; informe: Informe } | { modo: 'cambios'; informe: InformeCambios };

/**
 * Pasada nocturna: sincronización completa la primera vez y, después, solo los cambios desde la
 * última pasada correcta (con un día de solape, porque el registro de CIMA trabaja por días).
 * La marca de agua solo avanza si no hubo errores.
 */
export async function sincronizacionDiaria(
  db: BaseDatos,
  cliente: ClienteCima,
  opciones: { forzarCompleto?: boolean; log?: (mensaje: string) => void; ahora?: () => Date } = {},
): Promise<ResultadoDiario> {
  const ahora = opciones.ahora ?? (() => new Date());
  const arranque = ahora();
  const ultima = opciones.forzarCompleto ? null : await leerUltimaSincronizacion(db);

  if (!ultima) {
    const informe = await sincronizar(db, cliente, { log: opciones.log });
    if (informe.errores.length === 0) await guardarUltimaSincronizacion(db, arranque);
    return { modo: 'completo', informe };
  }

  const informe = await sincronizarCambios(db, cliente, new Date(ultima.getTime() - DIA_MS), {
    log: opciones.log,
  });
  if (informe.errores.length === 0) await guardarUltimaSincronizacion(db, arranque);
  return { modo: 'cambios', informe };
}
