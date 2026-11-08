import { InformacionCima } from '@rebotica/shared';
import { z } from 'zod';
import type { ClienteCima } from './cliente';
import { urlNotasSeguridad, urlProblemasSuministro } from './cima';
import type { Detalle } from './esquemas';
import { htmlATexto } from './texto';

const fechaCima = z
  .number()
  .int()
  .refine((n) => Number.isFinite(new Date(n).getTime()));
const PaginaSuministro = z.object({
  totalFilas: z.number().int().nonnegative(),
  pagina: z.number().int().positive(),
  tamanioPagina: z.number().int().positive(),
  resultados: z.array(
    z.object({
      cn: z.string().min(1),
      nombre: z.string(),
      activo: z.boolean(),
      fini: fechaCima.nullish(),
      ffin: fechaCima.nullish(),
      observ: z.string().nullish(),
    }),
  ),
});
const Notas = z.array(
  z.object({
    tipo: z.number().int(),
    num: z.string().nullish(),
    ref: z.string().nullish(),
    referencia: z.string().nullish(),
    asunto: z.string(),
    fecha: fechaCima.nullish(),
    url: z.url(),
  }),
);
const fecha = (n: number | null | undefined) => (n == null ? null : new Date(n).toISOString());

/** Solo se llama desde la sincronización, nunca al abrir una ficha. */
export async function obtenerInformacionCima(
  cliente: ClienteCima,
  detalle: Detalle,
  onError: (contexto: string, error: unknown) => void,
): Promise<InformacionCima> {
  const consultadoEn = new Date().toISOString();
  const informacion: InformacionCima = { suministro: null, seguridad: null };
  try {
    const incidencias: NonNullable<InformacionCima['suministro']>['incidencias'] = [];
    const afectadas = detalle.presentaciones.filter((p) => p.comerc && p.psum);
    if (detalle.psum && afectadas.length === 0)
      throw new Error('Incidencia sin presentación identificada');
    for (const presentacion of afectadas) {
      const anteriores = incidencias.length;
      for (let pagina = 1; ; pagina++) {
        const url = urlProblemasSuministro(presentacion.cn);
        url.searchParams.set('pagina', String(pagina));
        const respuesta = await cliente.obtener(url, PaginaSuministro);
        if (!respuesta || respuesta.pagina !== pagina) throw new Error('Suministro no disponible');
        for (const item of respuesta.resultados) {
          if (item.cn !== presentacion.cn)
            throw new Error('Código nacional de suministro inesperado');
          if (item.activo)
            incidencias.push({
              cn: item.cn,
              nombre: item.nombre,
              inicio: fecha(item.fini),
              finPrevisto: fecha(item.ffin),
              observaciones: htmlATexto(item.observ ?? ''),
            });
        }
        if (pagina * respuesta.tamanioPagina >= respuesta.totalFilas) break;
        if (respuesta.resultados.length === 0) throw new Error('Listado de suministro incompleto');
      }
      if (incidencias.length === anteriores)
        throw new Error('La incidencia no tiene detalle activo');
    }
    informacion.suministro = { consultadoEn, incidencias };
  } catch (error) {
    onError(`suministro ${detalle.nregistro}`, error);
  }
  try {
    // La ausencia del campo en una respuesta antigua no equivale a no tener notas.
    if (detalle.notas === undefined) return InformacionCima.parse(informacion);
    const notas = detalle.notas
      ? await cliente.obtener(urlNotasSeguridad(detalle.nregistro), Notas)
      : [];
    if (!notas || (detalle.notas && notas.length === 0))
      throw new Error('Notas de seguridad no disponibles');
    informacion.seguridad = {
      consultadoEn,
      notas: notas
        .filter((n) => n.tipo === 1)
        .map((n) => ({
          referencia: n.referencia ?? n.ref ?? n.num ?? '',
          asunto: htmlATexto(n.asunto),
          fecha: fecha(n.fecha),
          url: n.url,
        }))
        .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '')),
    };
  } catch (error) {
    onError(`notas de seguridad ${detalle.nregistro}`, error);
  }
  return InformacionCima.parse(informacion);
}
