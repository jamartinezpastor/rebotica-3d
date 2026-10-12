/**
 * Geometría paramétrica de una estantería (metros). Es una función pura: la escena la convierte
 * en instancias y F2-02 usa los huecos para colocar las cajas.
 */

export interface ParametrosEstanteria {
  ancho: number;
  alto: number;
  fondo: number;
  /** Número de baldas con hueco útil (el plan usa tres por estantería). */
  baldas: number;
  /** Grosor de tableros y laterales. */
  grosor: number;
  /** Altura del zócalo bajo la primera balda. */
  zocalo: number;
}

export const ESTANTERIA_POR_DEFECTO: ParametrosEstanteria = {
  ancho: 1.2,
  alto: 1.25,
  fondo: 0.34,
  baldas: 3,
  grosor: 0.03,
  zocalo: 0.1,
};

/** Un paralelepípedo centrado en `posicion` con las dimensiones de `tamano`. */
export interface Pieza {
  posicion: [number, number, number];
  tamano: [number, number, number];
}

/** Espacio libre sobre una balda donde se colocan las cajas. */
export interface Hueco {
  /** Centro de la base del hueco. */
  centro: [number, number, number];
  ancho: number;
  alto: number;
  fondo: number;
}

export interface GeometriaEstanteria {
  /** Laterales, tableros y panel trasero: estructura de madera clara. */
  estructura: Pieza[];
  /** Friso verde en el canto delantero de cada balda: el único acento de color. */
  frisos: Pieza[];
  huecos: Hueco[];
}

const GROSOR_FONDO = 0.012;
const ALTO_FRISO = 0.018;
const SALIENTE_FRISO = 0.004;

export function geometriaEstanteria(
  parametros: Partial<ParametrosEstanteria> = {},
): GeometriaEstanteria {
  const p = { ...ESTANTERIA_POR_DEFECTO, ...parametros };
  const { ancho, alto, fondo, baldas, grosor, zocalo } = p;

  if (!Number.isInteger(baldas) || baldas < 1)
    throw new RangeError('baldas debe ser un entero ≥ 1');
  if ([ancho, alto, fondo, grosor, zocalo].some((n) => !(n > 0))) {
    throw new RangeError('las dimensiones deben ser positivas');
  }
  // Tableros: uno bajo cada balda y la tapa superior; el hueco se reparte entre ellos.
  const tableros = baldas + 1;
  const hueco = (alto - zocalo - tableros * grosor) / baldas;
  if (hueco <= 0.05) throw new RangeError('la estantería es demasiado baja para tantas baldas');
  if (ancho <= 2 * grosor + 0.05) throw new RangeError('la estantería es demasiado estrecha');

  const anchoInterior = ancho - 2 * grosor;
  const estructura: Pieza[] = [];
  const frisos: Pieza[] = [];
  const huecos: Hueco[] = [];

  // Laterales (de suelo a tapa).
  for (const lado of [-1, 1]) {
    estructura.push({
      posicion: [lado * (ancho / 2 - grosor / 2), alto / 2, 0],
      tamano: [grosor, alto, fondo],
    });
  }
  // Panel trasero, entre los laterales y detrás de los tableros.
  estructura.push({
    posicion: [0, alto / 2, -fondo / 2 + GROSOR_FONDO / 2],
    tamano: [anchoInterior, alto, GROSOR_FONDO],
  });

  for (let i = 0; i < tableros; i++) {
    const yInferior = zocalo + i * (hueco + grosor);
    const y = yInferior + grosor / 2;
    estructura.push({ posicion: [0, y, 0], tamano: [anchoInterior, grosor, fondo] });

    if (i < baldas) {
      frisos.push({
        posicion: [0, y, fondo / 2 + SALIENTE_FRISO / 2],
        tamano: [anchoInterior, ALTO_FRISO, SALIENTE_FRISO],
      });
      huecos.push({
        centro: [0, yInferior + grosor, GROSOR_FONDO / 2],
        ancho: anchoInterior,
        alto: hueco,
        fondo: fondo - GROSOR_FONDO,
      });
    }
  }

  return { estructura, frisos, huecos };
}
