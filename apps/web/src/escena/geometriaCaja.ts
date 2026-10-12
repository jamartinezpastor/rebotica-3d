import type { FormaCaja } from '@rebotica/shared';
import { BoxGeometry, CylinderGeometry, type BufferGeometry } from 'three';
import type { Cara } from './arteEnvase';
import { dimensionesCaja } from './cajas';

/** Cada grupo de la geometría lleva una de estas caras; el cilindro tiene un lateral envolvente. */
export type RanuraCaja = Cara | 'lateral';

export interface GeometriaCaja {
  geometria: BufferGeometry;
  /** Cara de cada grupo, en el orden en que three crea los grupos (= índice de material). */
  ranuras: RanuraCaja[];
}

const LADOS_CILINDRO = 28;

/**
 * Geometría de la caja según la forma farmacéutica. La cara «frente» mira al pasillo (+z). El
 * cilindro gira media vuelta para que el centro de su lateral (donde va el frente) quede de cara.
 */
export function crearGeometriaCaja(forma: FormaCaja): GeometriaCaja {
  const d = dimensionesCaja(forma);

  if (forma === 'cilindro') {
    const geometria = new CylinderGeometry(d.ancho / 2, d.ancho / 2, d.alto, LADOS_CILINDRO, 1);
    geometria.rotateY(Math.PI);
    return { geometria, ranuras: ['lateral', 'superior', 'inferior'] };
  }

  const geometria = new BoxGeometry(d.ancho, d.alto, d.fondo);
  // Orden de BoxGeometry: +x, −x, +y, −y, +z, −z.
  return {
    geometria,
    ranuras: ['derecha', 'izquierda', 'superior', 'inferior', 'frente', 'trasera'],
  };
}

/** Medidas reales (m) de una cara: de ellas sale la proporción del lienzo donde se dibuja. */
export function medidasCara(forma: FormaCaja, ranura: RanuraCaja): { ancho: number; alto: number } {
  const d = dimensionesCaja(forma);
  if (forma === 'cilindro') {
    if (ranura === 'lateral') return { ancho: Math.PI * d.ancho, alto: d.alto };
    return { ancho: d.ancho, alto: d.ancho };
  }
  switch (ranura) {
    case 'izquierda':
    case 'derecha':
      return { ancho: d.fondo, alto: d.alto };
    case 'superior':
    case 'inferior':
      return { ancho: d.ancho, alto: d.fondo };
    default:
      return { ancho: d.ancho, alto: d.alto };
  }
}
