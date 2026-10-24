import { z } from 'zod';
import { CONSULTAS_FRECUENTES, ProtocoloConsulta } from './consulta';
import { VERSION_CORRESPONDENCIAS } from './indicaciones';

/** Describe la copia local, no la idoneidad clínica ni que todas las fichas sean consultables. */
export const EstadoCatalogoPublico = z
  .strictObject({
    estado: z.enum(['vacio', 'parcial', 'completo']),
    total: z.number().int().nonnegative(),
    sinReceta: z.number().int().nonnegative(),
    conReceta: z.number().int().nonnegative(),
    conIndicaciones: z.number().int().nonnegative(),
    sinIndicaciones: z.number().int().nonnegative(),
    cargaPendiente: z.boolean(),
    cargaPendienteDesde: z.iso.datetime().nullable(),
    sincronizadoHasta: z.iso.datetime().nullable(),
  })
  .refine(
    (s) =>
      s.total === s.sinReceta + s.conReceta && s.total === s.conIndicaciones + s.sinIndicaciones,
    { message: 'Recuentos de catálogo incoherentes' },
  );
export type EstadoCatalogoPublico = z.infer<typeof EstadoCatalogoPublico>;

export const CoberturaCatalogo = z.strictObject({
  evaluadoEn: z.iso.datetime(),
  versionCorrespondencias: z.literal(VERSION_CORRESPONDENCIAS),
  catalogo: EstadoCatalogoPublico,
  consultas: z
    .array(
      z.strictObject({
        id: ProtocoloConsulta,
        etiqueta: z.string().min(1),
        terminos: z.array(z.string().min(1)).min(1),
        sinReceta: z.number().int().nonnegative(),
        conReceta: z.number().int().nonnegative(),
      }),
    )
    .length(CONSULTAS_FRECUENTES.length),
});
export type CoberturaCatalogo = z.infer<typeof CoberturaCatalogo>;
