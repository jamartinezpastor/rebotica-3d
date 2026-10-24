import { medicamento, seccionFt, syncEstado, type Db } from '@rebotica/db';
import {
  CoberturaCatalogo,
  EstadoCatalogoPublico,
  CONSULTAS_FRECUENTES,
  TERMINOS_INDICACIONES,
  consultasDeIndicacion,
  VERSION_CORRESPONDENCIAS,
} from '@rebotica/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { BaseDatos } from './catalogo';

function fecha(valor: string | undefined): string | null {
  const f = z.iso.datetime({ offset: true }).safeParse(valor);
  return f.success && new Date(f.data).getTime() <= Date.now()
    ? new Date(f.data).toISOString()
    : null;
}

export async function leerEstadoCatalogo(base: BaseDatos): Promise<EstadoCatalogoPublico> {
  const db = base as unknown as Db;
  const [recuentos, marcas] = await Promise.all([
    db
      .select({
        receta: medicamento.receta,
        total: sql<number>`count(*)::int`,
        conIndicaciones: sql<number>`count(*) filter (where length(btrim(coalesce(${seccionFt.texto}, ''), ${' \t\r\n\u00a0'})) > 0)::int`,
      })
      .from(medicamento)
      .leftJoin(
        seccionFt,
        and(eq(seccionFt.nregistro, medicamento.nregistro), eq(seccionFt.seccion, '4.1')),
      )
      .where(eq(medicamento.comerc, true))
      .groupBy(medicamento.receta),
    db
      .select()
      .from(syncEstado)
      .where(
        inArray(syncEstado.clave, ['cima.carga_completa_desde', 'cima.ultima_sincronizacion']),
      ),
  ]);
  const pendiente = marcas.find((m) => m.clave === 'cima.carga_completa_desde');
  const ultima = fecha(marcas.find((m) => m.clave === 'cima.ultima_sincronizacion')?.valor);
  const total = recuentos.reduce((n, r) => n + r.total, 0);
  const conIndicaciones = recuentos.reduce((n, r) => n + r.conIndicaciones, 0);
  return EstadoCatalogoPublico.parse({
    estado: !total ? 'vacio' : pendiente || !ultima ? 'parcial' : 'completo',
    total,
    sinReceta: recuentos.find((r) => !r.receta)?.total ?? 0,
    conReceta: recuentos.find((r) => r.receta)?.total ?? 0,
    conIndicaciones,
    sinIndicaciones: total - conIndicaciones,
    cargaPendiente: !!pendiente,
    cargaPendienteDesde: fecha(pendiente?.valor),
    sincronizadoHasta: ultima,
  });
}

export async function evaluarCobertura(base: BaseDatos): Promise<CoberturaCatalogo> {
  const db = base as unknown as Db;
  const [catalogo, filas] = await Promise.all([
    leerEstadoCatalogo(base),
    db
      .select({ receta: medicamento.receta, texto: seccionFt.texto })
      .from(medicamento)
      .innerJoin(
        seccionFt,
        and(eq(seccionFt.nregistro, medicamento.nregistro), eq(seccionFt.seccion, '4.1')),
      )
      .where(eq(medicamento.comerc, true)),
  ]);
  const consultas = CONSULTAS_FRECUENTES.map((c) => ({
    id: c.id,
    etiqueta: c.etiqueta,
    terminos: [...TERMINOS_INDICACIONES[c.id]],
    sinReceta: 0,
    conReceta: 0,
  }));
  for (const fila of filas)
    for (const c of consultasDeIndicacion(fila.texto)) {
      const grupo = consultas.find((g) => g.id === c.id)!;
      if (fila.receta) grupo.conReceta++;
      else grupo.sinReceta++;
    }
  return CoberturaCatalogo.parse({
    evaluadoEn: new Date().toISOString(),
    versionCorrespondencias: VERSION_CORRESPONDENCIAS,
    catalogo,
    consultas,
  });
}
