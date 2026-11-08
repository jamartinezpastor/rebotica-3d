import { z } from 'zod';

export const IncidenciaSuministro = z.strictObject({
  cn: z.string().min(1),
  nombre: z.string(),
  inicio: z.iso.datetime().nullable(),
  finPrevisto: z.iso.datetime().nullable(),
  observaciones: z.string(),
});

export const NotaSeguridad = z.strictObject({
  referencia: z.string(),
  asunto: z.string(),
  fecha: z.iso.datetime().nullable(),
  url: z.url(),
});

/** null significa que no se ha podido consultar; una lista vacía sí es una respuesta válida. */
export const InformacionCima = z.strictObject({
  suministro: z
    .strictObject({
      consultadoEn: z.iso.datetime(),
      incidencias: z.array(IncidenciaSuministro),
    })
    .nullable(),
  seguridad: z
    .strictObject({
      consultadoEn: z.iso.datetime(),
      notas: z.array(NotaSeguridad),
    })
    .nullable(),
});
export type InformacionCima = z.infer<typeof InformacionCima>;
