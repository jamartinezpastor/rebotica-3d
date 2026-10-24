/**
 * Transición de selección: la caja sale de la balda, vuela hacia la cámara y aterriza en la
 * ficha; volver la reproduce al revés (plan §Cámara y gestos). Lógica pura, sin three.
 */

/** Duración (s) del vuelo de ida o de vuelta. */
export const DURACION_SELECCION = 0.55;
/** Distancia (m) delante de la cámara a la que aterriza la caja. */
export const DISTANCIA_FICHA = 0.62;
/** Distancia (m) del velo que apaga el resto de la escena; siempre detrás de la caja. */
export const DISTANCIA_VELO = DISTANCIA_FICHA + 0.3;
/** Altura que ocupa la caja en la ficha (m): ~un tercio del encuadre, sobre la hoja de la ficha. */
export const ALTO_EN_FICHA = 0.14;
/** Coordenada vertical normalizada (−1 abajo, +1 arriba) donde aterriza el centro de la caja. */
export const POSICION_FICHA_Y = 0.4;
/** Velocidad de giro en la ficha (rad/s). */
export const VELOCIDAD_GIRO = 0.55;
/** Un toque que se mueve más de esto (px) es un arrastre, no una selección. */
export const UMBRAL_TOQUE = 8;

/** Aceleración y frenada suaves (easeInOutCubic). */
export function suavizado(u: number): number {
  const x = Math.min(1, Math.max(0, u));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/**
 * Avanza el progreso `u` (0 = en la balda, 1 = en la ficha) hacia `objetivo` a velocidad
 * constante: `duracion` segundos para recorrerlo entero, de ida o de vuelta.
 */
export function avanzarTransicion(
  u: number,
  dt: number,
  objetivo: 0 | 1,
  duracion = DURACION_SELECCION,
): number {
  const paso = duracion > 0 ? Math.max(0, dt) / duracion : 1;
  if (objetivo === 1) return Math.min(1, u + paso);
  return Math.max(0, u - paso);
}

/** Escala con la que la caja llena su sitio en la ficha, según su altura real. */
export function escalaEnFicha(altoCaja: number, altoFicha = ALTO_EN_FICHA): number {
  if (!(altoCaja > 0)) return 1;
  return Math.min(4, Math.max(1, altoFicha / altoCaja));
}

/** Encaja el volumen durante todo el giro, incluida la perspectiva de su cara más próxima. */
export function escalaSegunEncuadre(
  d: { ancho: number; alto: number; fondo: number },
  fov: number,
  aspecto: number,
): number {
  const diametro = Math.hypot(d.ancho, d.fondo);
  if (!(diametro > 0 && d.alto > 0 && aspecto > 0 && fov > 0 && fov < 180)) return 1;
  const tangente = Math.tan((fov * Math.PI) / 360);
  const horizontal = tangente * aspecto * 0.8;
  const vertical = tangente * 0.3;
  return Math.min(
    4,
    ALTO_EN_FICHA / d.alto,
    (2 * horizontal * DISTANCIA_FICHA) / (diametro * (1 + horizontal)),
    (2 * vertical * DISTANCIA_FICHA) / (d.alto + vertical * diametro),
  );
}

export interface CajaUbicada {
  /** Balda (0 = la más baja) y posición x absoluta de la caja en el pasillo. */
  balda: number;
  x: number;
}

/**
 * Índice de la caja más cercana a `x` en la balda indicada (para elegir con el teclado el
 * producto que tiene la cámara delante). `-1` si esa balda no tiene cajas.
 */
export function cajaMasCercana(cajas: readonly CajaUbicada[], x: number, balda: number): number {
  let mejor = -1;
  let distancia = Infinity;
  cajas.forEach((c, i) => {
    if (c.balda !== balda) return;
    const d = Math.abs(c.x - x);
    if (d < distancia) {
      distancia = d;
      mejor = i;
    }
  });
  return mejor;
}
