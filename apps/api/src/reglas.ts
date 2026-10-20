import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { medicamento, reglaDosis, seccionFt, type Db } from '@rebotica/db';
import { ReglaDosis } from '@rebotica/dosis';
import { and, eq } from 'drizzle-orm';
import type { BaseDatos } from './catalogo';

/** Lee exclusivamente borradores sin firma; no admite publicar reglas desde esta carpeta. */
export async function leerReglasBorrador(
  directorio: string,
  log: (mensaje: string) => void = () => {},
): Promise<ReglaDosis[]> {
  const reglas: ReglaDosis[] = [];
  for (const archivo of (await readdir(directorio)).filter((a) => a.endsWith('.json')).sort()) {
    let datos: unknown;
    try {
      datos = JSON.parse(await readFile(join(directorio, archivo), 'utf8'));
    } catch {
      log(`regla ${archivo}: JSON ilegible`);
      continue;
    }
    const analizada = ReglaDosis.safeParse(datos);
    if (!analizada.success) {
      log(`regla ${archivo}: no cumple el esquema`);
      continue;
    }
    const r = analizada.data;
    if (
      r.estado !== 'borrador' ||
      r.fuente.validadoPor !== null ||
      r.fuente.fecha !== null ||
      !r.fuente.cita
    ) {
      log(`regla ${archivo}: solo se importan borradores sin firma y con cita`);
      continue;
    }
    reglas.push(r);
  }
  return reglas;
}

/** Importación local de semillas sin publicar ni sustituir versiones ya revisadas. Sin red. */
export async function cargarReglasBorrador(
  db: BaseDatos,
  directorio: string,
  log: (mensaje: string) => void = () => {},
): Promise<number> {
  const conexion = db as unknown as Db;
  let cargadas = 0;
  for (const r of await leerReglasBorrador(directorio, log)) {
    const [fuente] = await conexion
      .select({ receta: medicamento.receta, hash: seccionFt.hash, texto: seccionFt.texto })
      .from(medicamento)
      .innerJoin(
        seccionFt,
        and(eq(seccionFt.nregistro, medicamento.nregistro), eq(seccionFt.seccion, '4.2')),
      )
      .where(and(eq(medicamento.nregistro, r.fuente.nregistro), eq(medicamento.comerc, true)));
    if (
      !fuente ||
      fuente.hash !== r.fuente.hashSeccion ||
      createHash('sha256').update(fuente.texto, 'utf8').digest('hex') !== fuente.hash ||
      !r.fuente.cita ||
      !fuente.texto.includes(r.fuente.cita)
    ) {
      log(`regla ${r.id}: falta la sección 4.2 local vigente o no coincide la cita`);
      continue;
    }
    const insertadas = await conexion
      .insert(reglaDosis)
      .values({
        nregistro: r.fuente.nregistro,
        receta: fuente.receta,
        version: r.version,
        json: r,
        hashSeccion: r.fuente.hashSeccion,
        estado: 'borrador',
      })
      .onConflictDoNothing({ target: [reglaDosis.nregistro, reglaDosis.version] })
      .returning({ id: reglaDosis.id });
    cargadas += insertadas.length;
  }
  return cargadas;
}
