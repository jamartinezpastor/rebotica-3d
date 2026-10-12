import { z } from 'zod';

/**
 * Aviso permanente que se muestra en toda la app (principios de producto, plan §1).
 * Cualquier cambio de texto debe revisarlo el farmacéutico responsable.
 */
export const AVISO_LEGAL =
  'Información orientativa. No sustituye la valoración de un médico o farmacéutico; ante cualquier duda, consulta presencial.';

/** Teléfonos que la pantalla de derivación puede ofrecer. */
export const TELEFONOS = {
  emergencias: '112',
  conductaSuicida: '024',
} as const;

/** Para quién es la consulta (pantalla de triaje). */
export const GrupoPaciente = z.enum(['adulto', 'nino', 'bebe', 'embarazo', 'lactancia']);
export type GrupoPaciente = z.infer<typeof GrupoPaciente>;

/** Forma de la caja 3D, derivada de la forma farmacéutica de CIMA. */
export const FormaCaja = z.enum(['caja-plana', 'caja-alta', 'caja-cuadrada', 'tubo', 'cilindro']);
export type FormaCaja = z.infer<typeof FormaCaja>;

/** Nivel de urgencia de una derivación. */
export const Urgencia = z.enum(['112', 'urgencias', 'medico', 'farmaceutico']);
export type Urgencia = z.infer<typeof Urgencia>;

/** Respuesta de GET /api/health. */
export const HealthResponse = z.object({
  status: z.literal('ok'),
  version: z.string().min(1),
  time: z.iso.datetime(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
