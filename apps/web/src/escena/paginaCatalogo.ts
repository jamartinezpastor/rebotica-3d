import type { BaldaEscena } from './Pasillo';

export const PRODUCTOS_POR_PAGINA = 36;

/** Ventana del catálogo general; no cambia el orden, los grupos ni la condición de receta. */
export function paginaCatalogo(baldas: readonly BaldaEscena[], pagina: number): BaldaEscena[] {
  const inicio = pagina * PRODUCTOS_POR_PAGINA;
  const fin = inicio + PRODUCTOS_POR_PAGINA;
  let cursor = 0;
  return baldas.flatMap((balda) => {
    const desde = Math.max(0, inicio - cursor);
    const hasta = Math.max(0, fin - cursor);
    cursor += balda.productos.length;
    const productos = balda.productos.slice(desde, hasta);
    return productos.length ? [{ ...balda, productos }] : [];
  });
}
