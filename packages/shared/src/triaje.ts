import { z } from 'zod';
import { GrupoPaciente, Urgencia } from './dominio';
import { PasilloResponse } from './api';
import { ProtocoloConsulta } from './consulta';

const slug = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
export const PreguntaTriaje = z
  .strictObject({
    id: slug,
    texto: z.string().min(1).max(500),
    /** Edad en meses y duración en horas; no se deducen unidades del texto. */
    tipo: z.enum(['grupo', 'edad', 'duracion', 'siNo', 'opciones']),
    opciones: z
      .array(
        z.strictObject({ valor: z.string().min(1).max(80), etiqueta: z.string().min(1).max(200) }),
      )
      .min(2)
      .max(20)
      .optional(),
  })
  .superRefine((p, ctx) => {
    if (p.tipo === 'opciones' && !p.opciones)
      ctx.addIssue({ code: 'custom', message: 'faltan opciones' });
    if (
      p.opciones &&
      (p.tipo !== 'opciones' || new Set(p.opciones.map((o) => o.valor)).size !== p.opciones.length)
    ) {
      ctx.addIssue({ code: 'custom', message: 'opciones duplicadas o incompatibles' });
    }
  });
export type PreguntaTriaje = z.infer<typeof PreguntaTriaje>;

export const CondicionTriaje = z.discriminatedUnion('operador', [
  z.strictObject({
    preguntaId: slug,
    operador: z.literal('igual'),
    valor: z.union([z.boolean(), z.number(), z.string().max(80)]),
  }),
  z.strictObject({
    preguntaId: slug,
    operador: z.enum(['menor', 'menorIgual', 'mayor', 'mayorIgual']),
    valor: z.number(),
  }),
]);
export const CuandoTriaje = z.union([
  z.strictObject({ todas: z.array(CondicionTriaje).min(1).max(20) }),
  z.strictObject({ alguna: z.array(CondicionTriaje).min(1).max(20) }),
]);
export type CuandoTriaje = z.infer<typeof CuandoTriaje>;

export const RespuestasTriaje = z
  .record(slug, z.union([z.boolean(), z.number(), z.string().max(80)]))
  .refine((r) => Object.keys(r).length <= 30);
export type RespuestasTriaje = z.infer<typeof RespuestasTriaje>;
export const TriajeEntrada = z.strictObject({
  protocoloId: ProtocoloConsulta,
  version: z.number().int().positive(),
  respuestas: RespuestasTriaje,
});
export const ProtocoloTriajeRespuesta = z.strictObject({
  id: ProtocoloConsulta,
  version: z.number().int().positive(),
  titulo: z.string().min(1),
  preguntas: z.array(PreguntaTriaje).min(1).max(30),
});
export type ProtocoloTriajeRespuesta = z.infer<typeof ProtocoloTriajeRespuesta>;

/** Motivos públicos de indisponibilidad; nunca incluyen datos de la consulta o excepciones. */
export const ErrorTriaje = z.strictObject({
  error: z.string(),
  codigo: z.enum([
    'CATALOGO_NO_CONFIGURADO',
    'CATALOGO_NO_SINCRONIZADO',
    'CATALOGO_SIN_INDICACIONES',
    'PROTOCOLO_NO_VALIDADO',
    'TRIAJE_NO_DISPONIBLE',
  ]),
});

export const DerivacionTriaje = z.strictObject({
  tipo: z.literal('derivar'),
  urgencia: Urgencia,
  motivos: z
    .array(z.strictObject({ id: slug, descripcion: z.string().min(1), urgencia: Urgencia }))
    .min(1),
});
export type DerivacionTriaje = z.infer<typeof DerivacionTriaje>;
export const TriajeRespuesta = z.discriminatedUnion('tipo', [
  DerivacionTriaje,
  z.strictObject({ tipo: z.literal('preguntas'), pendientes: z.array(slug).min(1) }),
  z.strictObject({
    tipo: z.literal('recomendar'),
    pasilloId: ProtocoloConsulta,
    version: z.number().int().positive(),
    pasillo: PasilloResponse,
  }),
]);
export type TriajeRespuesta = z.infer<typeof TriajeRespuesta>;

/** Validación de cada respuesta sin coerción ni valores preseleccionados. */
export function respuestaValida(p: PreguntaTriaje, valor: unknown): boolean {
  if (p.tipo === 'siNo') return typeof valor === 'boolean';
  if (p.tipo === 'grupo') return GrupoPaciente.safeParse(valor).success;
  if (p.tipo === 'opciones')
    return typeof valor === 'string' && !!p.opciones?.some((o) => o.valor === valor);
  return (
    typeof valor === 'number' &&
    Number.isFinite(valor) &&
    valor >= 0 &&
    (p.tipo === 'edad' ? valor <= 1560 : valor <= 876000)
  );
}
