import type { FormaCaja } from '@rebotica/shared';
import type { Hueco } from './geometria';

/** Medidas reales aproximadas de cada tipo de envase, en metros. */
export interface DimensionesCaja {
  ancho: number;
  alto: number;
  fondo: number;
}

const DIMENSIONES: Record<FormaCaja, DimensionesCaja> = {
  'caja-plana': { ancho: 0.13, alto: 0.075, fondo: 0.04 },
  'caja-alta': { ancho: 0.065, alto: 0.14, fondo: 0.065 },
  'caja-cuadrada': { ancho: 0.12, alto: 0.09, fondo: 0.035 },
  tubo: { ancho: 0.045, alto: 0.16, fondo: 0.03 },
  cilindro: { ancho: 0.055, alto: 0.15, fondo: 0.055 },
};

export function dimensionesCaja(forma: FormaCaja): DimensionesCaja {
  return DIMENSIONES[forma];
}

export interface CajaColocada<T> {
  item: T;
  forma: FormaCaja;
  /** Centro de la caja respecto al origen de la estantería. */
  posicion: [number, number, number];
  dimensiones: DimensionesCaja;
  /** Índice del hueco (balda) donde queda. */
  balda: number;
}

export interface OpcionesColocacion {
  /** Separación entre cajas contiguas. */
  separacion?: number;
  /** Margen libre en los extremos de cada balda. */
  margen?: number;
  /** Distancia que queda entre el frente de la caja y el canto de la balda. */
  retranqueo?: number;
}

/**
 * Coloca las cajas de izquierda a derecha, rellenando una balda tras otra y pasando a la
 * siguiente cuando no caben. Las que no entran en ninguna balda quedan en `omitidas`.
 */
export function colocarCajas<T extends { formaCaja: FormaCaja }>(
  huecos: readonly Hueco[],
  items: readonly T[],
  { separacion = 0.012, margen = 0.03, retranqueo = 0.012 }: OpcionesColocacion = {},
): { colocadas: CajaColocada<T>[]; omitidas: T[] } {
  const colocadas: CajaColocada<T>[] = [];
  const omitidas: T[] = [];
  let balda = 0;
  let cursor = huecos[0] ? -huecos[0].ancho / 2 + margen : 0;

  for (const item of items) {
    const dimensiones = dimensionesCaja(item.formaCaja);
    let hueco = huecos[balda];
    // Pasa a la siguiente balda si ya no cabe a lo ancho (y la caja cabe en alto).
    while (hueco && cursor + dimensiones.ancho > hueco.ancho / 2 - margen + 1e-9) {
      balda++;
      hueco = huecos[balda];
      cursor = hueco ? -hueco.ancho / 2 + margen : 0;
    }
    if (!hueco || dimensiones.alto > hueco.alto || dimensiones.fondo > hueco.fondo) {
      omitidas.push(item);
      continue;
    }
    const frente = hueco.centro[2] + hueco.fondo / 2;
    colocadas.push({
      item,
      forma: item.formaCaja,
      dimensiones,
      balda,
      posicion: [
        hueco.centro[0] + cursor + dimensiones.ancho / 2,
        hueco.centro[1] + dimensiones.alto / 2,
        frente - dimensiones.fondo / 2 - retranqueo,
      ],
    });
    cursor += dimensiones.ancho + separacion;
  }
  return { colocadas, omitidas };
}
