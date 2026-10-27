import { z } from 'zod';
import { GrupoPaciente } from './dominio';
import { ProtocoloConsulta, TextoConsulta } from './consulta';

export const InterpretarEntrada = z.strictObject({
  texto: TextoConsulta,
  modo: z.literal('catalogo').optional(),
});

/** Tema documental y sinónimos de indicación; nunca productos, activos ni dosis. */
export const BusquedaIndicaciones = z.strictObject({
  tema: z.string().trim().min(3).max(100),
  terminos: z
    .array(
      z
        .string()
        .trim()
        .min(3)
        .max(80)
        .refine((t) => /^[\p{L}\p{N} -]+$/u.test(t)),
    )
    .min(1)
    .max(6),
});
export type BusquedaIndicaciones = z.infer<typeof BusquedaIndicaciones>;

/** Identificadores cerrados: el modelo nunca redacta consejos, tratamientos ni dosis. */
export const AlarmaConsulta = z.enum([
  'dolor-toracico',
  'dificultad-respiratoria',
  'convulsion',
  'sangrado',
  'fiebre-bebe',
  'conducta-suicida',
  'otra-urgencia',
  'valoracion-medica',
]);
export type AlarmaConsulta = z.infer<typeof AlarmaConsulta>;

export const DatosConsulta = z.strictObject({
  paraQuien: z.enum(['yo', 'otra-persona', 'desconocido']),
  grupo: GrupoPaciente.nullable(),
  edad: z
    .strictObject({
      valor: z.number().min(0).max(50000),
      unidad: z.enum(['dias', 'meses', 'anos']),
    })
    .nullable(),
  duracion: z
    .strictObject({
      valor: z.number().min(0).max(50000),
      unidad: z.enum(['horas', 'dias', 'semanas', 'meses']),
    })
    .nullable(),
});

/** Se valida otra vez en el servidor, aunque el proveedor aplique JSON Schema. */
export const ClasificacionConsulta = z.strictObject({
  protocoloId: ProtocoloConsulta.nullable(),
  confianza: z.number().min(0).max(1),
  alarmasDetectadas: z.array(AlarmaConsulta).max(8),
  datosExtraidos: DatosConsulta,
  necesitaAclarar: z.boolean(),
  alternativas: z.array(ProtocoloConsulta).max(3),
});
export type ClasificacionConsulta = z.infer<typeof ClasificacionConsulta>;

/** En el catálogo el motivo puede estar fuera de los chips; la IA solo formula la búsqueda. */
export const ClasificacionCatalogo = ClasificacionConsulta.extend({
  busqueda: BusquedaIndicaciones.nullable(),
});

export const UMBRAL_CONFIANZA = 0.8;
export const DerivacionConsulta = z.strictObject({
  tipo: z.literal('derivacion'),
  destino: z.enum(['112', 'urgencias', '024', 'medico']),
  alarmasDetectadas: z.array(AlarmaConsulta).min(1).max(8),
});
export type DerivacionConsulta = z.infer<typeof DerivacionConsulta>;

/** Clasificar no autoriza tratamientos. Permite navegar al catálogo informativo por tema. */
export const InterpretarRespuesta = z.discriminatedUnion('tipo', [
  DerivacionConsulta,
  z.strictObject({
    tipo: z.literal('clasificacion'),
    protocoloId: ProtocoloConsulta,
    confianza: z.number().min(UMBRAL_CONFIANZA).max(1),
    datosExtraidos: DatosConsulta,
  }),
  z.strictObject({
    tipo: z.literal('aclaracion'),
    confianza: z.number().min(0).max(1),
    alternativas: z.array(ProtocoloConsulta).max(3),
    datosExtraidos: DatosConsulta,
  }),
]);
export type InterpretarRespuesta = z.infer<typeof InterpretarRespuesta>;
