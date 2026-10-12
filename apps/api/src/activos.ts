const sinAcentos = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Clave comparable de un principio activo o de una asociación: CIMA escribe «ACETILSALICILICO
 * ACIDO» y los protocolos «ácido acetilsalicílico». Se normalizan acentos y mayúsculas, se
 * ignora el orden de las palabras y se separan los componentes por coma, «+», «/» o « y ».
 */
export function claveActivo(texto: string): string {
  return sinAcentos(texto)
    .split(/\s*(?:,|\+|\/|\by\b)\s*/)
    .map((componente) =>
      componente
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .sort()
        .join(' '),
    )
    .filter(Boolean)
    .sort()
    .join('|');
}
