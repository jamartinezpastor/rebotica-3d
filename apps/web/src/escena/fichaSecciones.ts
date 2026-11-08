import type { ProductoResponse } from '@rebotica/shared';

/**
 * Cómo se reparten las secciones 4.x de la ficha técnica entre las pestañas de la ficha
 * (plan §Ficha 3D: Uso, Precauciones y Dosis). Lógica pura.
 */

export type IdPestana = 'uso' | 'precauciones' | 'dosis';

export interface SeccionMostrada {
  seccion: string;
  /** Título pensado para el usuario; el de la ficha técnica es muy técnico. */
  titulo: string;
  /** Párrafos del texto oficial de la ficha técnica. */
  parrafos: string[];
  /** Resumen en lenguaje llano ya revisado por un farmacéutico, si existe. */
  resumenLlano: string | null;
}

export interface Pestana {
  id: IdPestana;
  etiqueta: string;
  secciones: SeccionMostrada[];
}

const TITULOS: Record<string, string> = {
  '4.1': 'Para qué se usa',
  '4.2': 'Posología según la ficha técnica',
  '4.3': 'Contraindicaciones',
  '4.4': 'Advertencias y precauciones',
  '4.5': 'Interacciones con otros medicamentos',
  '4.6': 'Embarazo y lactancia',
  '4.7': 'Conducción y manejo de máquinas',
};

const REPARTO: { id: IdPestana; etiqueta: string; secciones: string[] }[] = [
  { id: 'uso', etiqueta: 'Uso', secciones: ['4.1'] },
  { id: 'precauciones', etiqueta: 'Precauciones', secciones: ['4.3', '4.4', '4.5', '4.6', '4.7'] },
  { id: 'dosis', etiqueta: 'Dosis', secciones: ['4.2'] },
];

/** Divide el texto plano de una sección en párrafos no vacíos. */
export function parrafos(texto: string): string[] {
  return texto
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Las tres pestañas de la ficha con las secciones que tiene el producto, en orden. */
export function pestanasDe(ficha: Pick<ProductoResponse, 'secciones'>): Pestana[] {
  const porSeccion = new Map(ficha.secciones.map((s) => [s.seccion, s]));
  return REPARTO.map(({ id, etiqueta, secciones }) => ({
    id,
    etiqueta,
    secciones: secciones.flatMap((codigo) => {
      const s = porSeccion.get(codigo);
      if (!s) return [];
      const lista = parrafos(s.texto);
      // Sin texto ni resumen no hay nada que enseñar en esa sección.
      if (lista.length === 0 && !s.resumenLlano) return [];
      return [
        {
          seccion: codigo,
          titulo: TITULOS[codigo] ?? s.titulo,
          parrafos: lista,
          resumenLlano: s.resumenLlano,
        },
      ];
    }),
  }));
}

/** Enlace seguro: solo `https` a CIMA (la API ya lo construye así; se vuelve a comprobar). */
export function esEnlaceCima(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'cima.aemps.es';
  } catch {
    return false;
  }
}

export function esEnlaceAemps(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      (u.hostname === 'aemps.gob.es' ||
        u.hostname.endsWith('.aemps.gob.es') ||
        u.hostname === 'cima.aemps.es')
    );
  } catch {
    return false;
  }
}
