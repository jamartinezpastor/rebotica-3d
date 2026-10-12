/**
 * Color por grupo terapéutico (primera letra del código ATC). Se usa en el frontal generado
 * cuando CIMA no tiene foto del embalaje. Todos dan contraste AA con texto blanco.
 */
const COLORES: Record<string, string> = {
  A: '#2b6b5e',
  B: '#9a3445',
  C: '#a8402f',
  D: '#a85a1f',
  G: '#80447f',
  H: '#5f6320',
  J: '#33618f',
  L: '#6e3560',
  M: '#46618a',
  N: '#53479a',
  P: '#6f5f2e',
  R: '#1f6f8f',
  S: '#2f7a4d',
  V: '#4f5963',
};
export const COLOR_GRUPO_DEFECTO = '#4f5963';

/** Color del grupo a partir de los códigos ATC del medicamento (el más específico manda). */
export function colorGrupo(atcs: readonly string[]): string {
  const codigo = [...atcs].sort((a, b) => b.length - a.length)[0];
  const letra = codigo?.[0]?.toUpperCase();
  return (letra && COLORES[letra]) || COLOR_GRUPO_DEFECTO;
}

export const COLORES_GRUPO: readonly string[] = [...Object.values(COLORES), COLOR_GRUPO_DEFECTO];
