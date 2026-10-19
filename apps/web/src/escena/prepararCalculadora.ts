import { ReglaDosis } from '@rebotica/dosis';
import type { ProductoResponse } from '@rebotica/shared';

export function prepararCalculadora(ficha: ProductoResponse) {
  const analizada = ReglaDosis.safeParse(ficha.reglaDosis);
  const seccion = ficha.secciones.find((s) => s.seccion === '4.2');
  if (!analizada.success || !seccion?.hash) return null;
  const regla = analizada.data;
  if (
    regla.estado !== 'validada' ||
    regla.fuente.nregistro !== ficha.nregistro ||
    regla.fuente.hashSeccion !== seccion.hash ||
    !regla.fuente.cita ||
    !seccion.texto.includes(regla.fuente.cita) ||
    Object.keys(regla.diasMaxSinConsultar).length === 0
  )
    return null;
  return {
    regla,
    fuenteActual: { nregistro: ficha.nregistro, hashSeccion: seccion.hash, texto: seccion.texto },
  };
}
