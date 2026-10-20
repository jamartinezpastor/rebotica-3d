import { z } from 'zod';

/** Etiquetas de entrada, no protocolos clínicos ni asociaciones con medicamentos. */
export const CONSULTAS_FRECUENTES = [
  { id: 'dolor-cabeza', etiqueta: 'Dolor de cabeza' },
  { id: 'fiebre', etiqueta: 'Fiebre' },
  { id: 'resfriado-congestion', etiqueta: 'Resfriado y congestión' },
  { id: 'dolor-garganta', etiqueta: 'Dolor de garganta' },
  { id: 'tos', etiqueta: 'Tos' },
  { id: 'acidez', etiqueta: 'Acidez' },
  { id: 'diarrea', etiqueta: 'Diarrea' },
  { id: 'estrenimiento', etiqueta: 'Estreñimiento' },
  { id: 'alergia-estacional', etiqueta: 'Alergia estacional' },
  { id: 'picaduras', etiqueta: 'Picaduras' },
  { id: 'quemadura-solar', etiqueta: 'Quemadura solar' },
  { id: 'herpes-labial', etiqueta: 'Herpes labial' },
  { id: 'dolor-muscular', etiqueta: 'Dolor muscular' },
  { id: 'piojos', etiqueta: 'Piojos' },
] as const;

export const ProtocoloConsulta = z.enum(CONSULTAS_FRECUENTES.map((c) => c.id));
export const LIMITE_CONSULTA = 2000;
export const TextoConsulta = z.string().max(LIMITE_CONSULTA).trim().min(1);

/** Contrato de salida del mostrador para la futura interpretación y el triaje. */
export const ConsultaMostrador = z.discriminatedUnion('origen', [
  z.strictObject({ origen: z.literal('chip'), protocoloId: ProtocoloConsulta }),
  z.strictObject({ origen: z.literal('texto'), texto: TextoConsulta }),
]);
export type ConsultaMostrador = z.infer<typeof ConsultaMostrador>;
