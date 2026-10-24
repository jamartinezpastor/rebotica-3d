import { z } from 'zod';

/**
 * Aviso permanente que se muestra en toda la app (principios de producto, plan §1).
 * Cualquier cambio de texto debe revisarlo el farmacéutico responsable.
 */
export const AVISO_LEGAL =
  'Información orientativa. No sustituye la valoración de un médico o farmacéutico; ante cualquier duda, consulta presencial.';

export const AVISO_RECETA =
  'Requiere receta médica. Consulta su información con precaución: no inicies ni cambies el tratamiento sin indicación de tu médico.';

/** Teléfonos que la pantalla de derivación puede ofrecer. */
export const TELEFONOS = {
  emergencias: '112',
  conductaSuicida: '024',
} as const;

/** Respuesta de GET /api/health. */
export const HealthResponse = z.object({
  status: z.literal('ok'),
  version: z.string().min(1),
  time: z.iso.datetime(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

export * from './dominio';
export * from './api';
export * from './consulta';
export * from './interpretacion';
export * from './triaje';
export * from './exploracion';
export * from './catalogo';
export * from './indicaciones';
