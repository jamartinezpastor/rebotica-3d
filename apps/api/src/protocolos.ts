import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { protocolo as tablaProtocolo, type Db } from '@rebotica/db';
import { Protocolo } from '@rebotica/protocolos';
import { desc, eq } from 'drizzle-orm';
import type { BaseDatos } from './catalogo';

/** Estado en base de datos: «validada» es la única que cuenta como publicada y firmada. */
const ESTADO_BD = { borrador: 'borrador', validado: 'validada' } as const;

export interface ProtocoloPublicado {
  protocolo: Protocolo;
  estado: 'borrador' | 'validado';
}

/**
 * Protocolo vigente: la última versión validada y, si no hay ninguna, la última en borrador
 * (la UI avisa de que es una demostración). Un JSON que no cumple el esquema se ignora.
 */
export async function protocoloPublicado(
  db: BaseDatos,
  id: string,
): Promise<ProtocoloPublicado | null> {
  const conexion = db as unknown as Db;
  const filas = await conexion
    .select()
    .from(tablaProtocolo)
    .where(eq(tablaProtocolo.id, id))
    .orderBy(desc(tablaProtocolo.version));

  const validas = filas.flatMap((f) => {
    const analizado = Protocolo.safeParse(f.json);
    if (!analizado.success || analizado.data.id !== f.id || analizado.data.version !== f.version)
      return [];
    const firmado =
      f.estado === 'validada' &&
      analizado.data.estado === 'validado' &&
      !!f.validadoPor &&
      !!f.validadoEn &&
      f.validadoPor === analizado.data.validadoPor &&
      f.validadoEn.toISOString().slice(0, 10) === analizado.data.validadoEn &&
      analizado.data.validadoEn <= new Date().toISOString().slice(0, 10);
    return [{ protocolo: analizado.data, firmado }];
  });
  const elegido = validas.find((v) => v.firmado) ?? validas[0];
  if (!elegido) return null;
  return {
    protocolo: elegido.protocolo,
    estado: elegido.firmado ? 'validado' : 'borrador',
  };
}

/** Carga JSON versionados sin sustituir ninguna versión existente, incluida una firmada. */
export async function cargarProtocolos(
  db: BaseDatos,
  directorio: string,
  log: (mensaje: string) => void = () => {},
): Promise<number> {
  const conexion = db as unknown as Db;
  let cargados = 0;
  for (const archivo of (await readdir(directorio)).filter((a) => a.endsWith('.json')).sort()) {
    let datos: unknown;
    try {
      datos = JSON.parse(await readFile(join(directorio, archivo), 'utf8'));
    } catch (err) {
      log(`protocolo ${archivo}: JSON ilegible (${String(err)})`);
      continue;
    }
    const analizado = Protocolo.safeParse(datos);
    if (!analizado.success) {
      log(`protocolo ${archivo}: no cumple el esquema (${analizado.error.message})`);
      continue;
    }
    const p = analizado.data;
    const valores = {
      id: p.id,
      version: p.version,
      json: p,
      estado: ESTADO_BD[p.estado],
      validadoPor: p.validadoPor,
      validadoEn: p.validadoEn ? new Date(p.validadoEn) : null,
    };
    const insertados = await conexion
      .insert(tablaProtocolo)
      .values(valores)
      .onConflictDoNothing({ target: [tablaProtocolo.id, tablaProtocolo.version] })
      .returning({ id: tablaProtocolo.id });
    cargados += insertados.length;
  }
  return cargados;
}
