/**
 * Constructores de URL de la API REST pública de CIMA (AEMPS).
 * Documentación: https://sede.aemps.gob.es/docs/CIMA-REST-API_1_19.pdf (versión vigente 1.23).
 *
 * Solo construyen URLs; las peticiones, reintentos y límite de ritmo están en `cliente.ts`.
 */

export const CIMA_BASE = 'https://cima.aemps.es/cima/rest/';

/** Secciones de la ficha técnica que usa la app (plan §Fuentes de datos). */
export const SECCIONES_FT = ['4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7'] as const;
export type SeccionFT = (typeof SECCIONES_FT)[number];

export interface FiltrosMedicamentos {
  /** true: solo con receta; false: solo sin receta. */
  receta?: boolean;
  comercializados?: boolean;
  autorizados?: boolean;
  atc?: string;
  principioActivo?: string;
  nombre?: string;
  pagina?: number;
}

const bit = (valor: boolean) => (valor ? '1' : '0');

export function urlMedicamentos(filtros: FiltrosMedicamentos = {}): URL {
  const url = new URL('medicamentos', CIMA_BASE);
  const p = url.searchParams;
  if (filtros.receta !== undefined) p.set('receta', bit(filtros.receta));
  if (filtros.comercializados !== undefined) p.set('comerc', bit(filtros.comercializados));
  if (filtros.autorizados !== undefined) p.set('autorizados', bit(filtros.autorizados));
  if (filtros.atc) p.set('atc', filtros.atc);
  if (filtros.principioActivo) p.set('practiv1', filtros.principioActivo);
  if (filtros.nombre) p.set('nombre', filtros.nombre);
  if (filtros.pagina !== undefined) p.set('pagina', String(filtros.pagina));
  return url;
}

export function urlMedicamento(nregistro: string): URL {
  const url = new URL('medicamento', CIMA_BASE);
  url.searchParams.set('nregistro', nregistro);
  return url;
}

/** Una sección de la ficha técnica (tipoDoc 1). Pedir con `Accept: application/json`. */
export function urlSeccionFichaTecnica(nregistro: string, seccion: SeccionFT): URL {
  const url = new URL('docSegmentado/contenido/1', CIMA_BASE);
  url.searchParams.set('nregistro', nregistro);
  url.searchParams.set('seccion', seccion);
  return url;
}

/** Todas las secciones de la ficha técnica en una sola petición (se filtran las 4.x al guardar). */
export function urlFichaTecnica(nregistro: string): URL {
  const url = new URL('docSegmentado/contenido/1', CIMA_BASE);
  url.searchParams.set('nregistro', nregistro);
  return url;
}

/** Cambios desde una fecha (dd/mm/aaaa en la API). */
export function urlRegistroCambios(desde: Date, pagina?: number): URL {
  const dd = String(desde.getUTCDate()).padStart(2, '0');
  const mm = String(desde.getUTCMonth() + 1).padStart(2, '0');
  const url = new URL('registroCambios', CIMA_BASE);
  url.searchParams.set('fecha', `${dd}/${mm}/${desde.getUTCFullYear()}`);
  if (pagina !== undefined) url.searchParams.set('pagina', String(pagina));
  return url;
}

export function urlProblemasSuministro(codigoNacional: string): URL {
  return new URL(`psuministro/${encodeURIComponent(codigoNacional)}`, CIMA_BASE);
}
