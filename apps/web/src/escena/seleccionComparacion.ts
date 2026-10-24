import type { ProductoResumen } from '@rebotica/shared';

/** Selección explícita y ordenada, en memoria. No deduce sustituciones ni equivalencias. */
export function alternarComparado(
  actuales: readonly ProductoResumen[],
  producto: ProductoResumen,
): ProductoResumen[] {
  if (actuales.some((p) => p.nregistro === producto.nregistro))
    return actuales.filter((p) => p.nregistro !== producto.nregistro);
  return actuales.length < 2 ? [...actuales, producto] : [...actuales];
}
