import { z } from 'zod';
import { EstadoCatalogoPublico } from './catalogo';
import { VERSION_CORRESPONDENCIAS } from './indicaciones';

/** Solo metadatos públicos del despliegue, sin configuración privada ni datos de consultas. */
export const InformacionPublica = z.strictObject({
  versionApp: z.string().min(1),
  versionMotorDosis: z.string().min(1),
  versionCorrespondencias: z.literal(VERSION_CORRESPONDENCIAS),
  interpretacionConfigurada: z.boolean(),
  catalogo: EstadoCatalogoPublico.nullable(),
});
export type InformacionPublica = z.infer<typeof InformacionPublica>;
