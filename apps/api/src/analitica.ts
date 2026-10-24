import { consultaConteo, type Db } from '@rebotica/db';
import { ProtocoloConsulta } from '@rebotica/shared';
import { sql } from 'drizzle-orm';
import type { BaseDatos } from './catalogo';

/** Solo un identificador del catálogo y un día; no recibe peticiones, texto, IP ni perfiles. */
export async function contarConsulta(db: BaseDatos, consultaId: string, ahora = new Date()) {
  const protocoloId = ProtocoloConsulta.parse(consultaId);
  const conexion = db as unknown as Db;
  await conexion
    .insert(consultaConteo)
    .values({
      dia: ahora.toISOString().slice(0, 10),
      protocoloId,
      total: 1,
    })
    .onConflictDoUpdate({
      target: [consultaConteo.dia, consultaConteo.protocoloId],
      set: { total: sql`${consultaConteo.total} + 1` },
    });
}
