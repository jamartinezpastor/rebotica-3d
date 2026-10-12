import { z } from 'zod';

/** Para quién es la consulta (pantalla de triaje). */
export const GrupoPaciente = z.enum(['adulto', 'nino', 'bebe', 'embarazo', 'lactancia']);
export type GrupoPaciente = z.infer<typeof GrupoPaciente>;

/** Forma de la caja 3D, derivada de la forma farmacéutica de CIMA. */
export const FormaCaja = z.enum(['caja-plana', 'caja-alta', 'caja-cuadrada', 'tubo', 'cilindro']);
export type FormaCaja = z.infer<typeof FormaCaja>;

/** Nivel de urgencia de una derivación. */
export const Urgencia = z.enum(['112', 'urgencias', 'medico', 'farmaceutico']);
export type Urgencia = z.infer<typeof Urgencia>;

const sinAcentos = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Forma de la caja 3D según la forma farmacéutica de CIMA (plan §3D): caja plana para
 * comprimidos y similares, alta para líquidos orales, cuadrada para sobres y polvos, tubo para
 * cremas y geles, cilindro para sprays e inhaladores. Lo desconocido va a caja plana.
 */
export function formaCajaDesde(formaFarmaceutica: string | null | undefined): FormaCaja {
  const forma = sinAcentos(formaFarmaceutica ?? '');
  if (/aerosol|spray|nebuliz|inhal|pulveriz/.test(forma)) return 'cilindro';
  if (/crema|pomada|gel\b|unguento|pasta|emulsion cutanea|locion/.test(forma)) return 'tubo';
  if (/sobre|granulado|polvo/.test(forma)) return 'caja-cuadrada';
  if (/jarabe|solucion|suspension|emulsion|gotas|elixir|colirio|liquido/.test(forma)) {
    return 'caja-alta';
  }
  return 'caja-plana';
}

/** Grupos anatómicos principales de la clasificación ATC (primer nivel), en el idioma de CIMA. */
const GRUPOS_ATC: Record<string, string> = {
  A: 'Aparato digestivo y metabolismo',
  B: 'Sangre y órganos hematopoyéticos',
  C: 'Sistema cardiovascular',
  D: 'Dermatológicos',
  G: 'Sistema genitourinario y hormonas sexuales',
  H: 'Hormonas de uso sistémico',
  J: 'Antiinfecciosos de uso sistémico',
  L: 'Antineoplásicos e inmunomoduladores',
  M: 'Sistema musculoesquelético',
  N: 'Sistema nervioso',
  P: 'Antiparasitarios y repelentes',
  R: 'Sistema respiratorio',
  S: 'Órganos de los sentidos',
  V: 'Varios',
};

/**
 * Nombre del grupo anatómico ATC a partir de los códigos del medicamento (el más específico
 * manda). Sirve de categoría cuando CIMA no ha dado el nombre del nivel 3.
 */
export function grupoAtc(atcs: readonly string[]): string | null {
  const codigo = [...atcs].sort((a, b) => b.length - a.length)[0];
  const letra = codigo?.[0]?.toUpperCase();
  return (letra && GRUPOS_ATC[letra]) || null;
}
