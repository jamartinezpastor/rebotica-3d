/**
 * Control de la cámara sobre raíl (plan §Cámara y gestos). La cámara no es libre: viaja por un
 * raíl a lo largo del pasillo y se ajusta a cada producto; el gesto vertical cambia de balda.
 * Todo es lógica pura (sin three ni DOM) para poder probarla con gestos simulados.
 */

/** Frecuencia natural (rad/s) del muelle críticamente amortiguado de la posición. */
export const OMEGA_POSICION = 14;
export const OMEGA_FILA = 12;
/** Tiempo (s) de inercia con el que se proyecta un lanzamiento antes de ajustar. */
export const TAU_INERCIA = 0.22;
/** Píxeles de arrastre vertical que equivalen a una balda. */
export const PX_POR_FILA = 170;
/** Arrastre mínimo (px) para decidir si el gesto es horizontal o vertical. */
export const UMBRAL_EJE = 8;
/** Un gesto vertical cambia de balda si recorre más de esto (px) o va más rápido (px/s). */
export const UMBRAL_CAMBIO_FILA = 48;
export const UMBRAL_VELOCIDAD_FILA = 450;

/** Integra un muelle críticamente amortiguado de forma exacta (estable para cualquier `dt`). */
export function pasoMuelle(
  pos: number,
  vel: number,
  objetivo: number,
  dt: number,
  omega: number,
): { pos: number; vel: number } {
  const x = pos - objetivo;
  const e = Math.exp(-omega * dt);
  const c = vel + omega * x;
  return {
    pos: objetivo + (x + c * dt) * e,
    vel: (vel - omega * c * dt) * e,
  };
}

/** Punto del raíl más cercano a `x` (o `x` si no hay puntos). */
export function puntoMasCercano(puntos: readonly number[], x: number): number {
  let mejor = x;
  let distancia = Infinity;
  for (const p of puntos) {
    const d = Math.abs(p - x);
    if (d < distancia) {
      distancia = d;
      mejor = p;
    }
  }
  return mejor;
}

/** Siguiente punto en la dirección dada (+1 derecha, −1 izquierda); se queda si no hay más. */
export function puntoSiguiente(puntos: readonly number[], x: number, direccion: 1 | -1): number {
  const orden = [...puntos].sort((a, b) => a - b);
  const margen = 1e-6;
  if (direccion === 1) return orden.find((p) => p > x + margen) ?? orden.at(-1) ?? x;
  return [...orden].reverse().find((p) => p < x - margen) ?? orden[0] ?? x;
}

/** Dónde acabaría un lanzamiento con velocidad `v` y a qué punto del raíl se ajusta. */
export function ajusteTrasLanzamiento(
  x: number,
  v: number,
  puntos: readonly number[],
  tau = TAU_INERCIA,
): number {
  return puntoMasCercano(puntos, x + v * tau);
}

export function acotar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor));
}

export interface ConfiguracionRiel {
  /** Posiciones x de los productos de cada balda (índice 0 = la más baja). */
  puntos: readonly (readonly number[])[];
  /** Con `true` no hay muelles: los cambios son instantáneos (menos movimiento). */
  instantaneo?: boolean;
  filaInicial?: number;
  xInicial?: number;
}

type Eje = 'x' | 'y' | null;

/**
 * Estado del raíl. La vista (R3F) le pasa gestos y pide la posición en cada fotograma; no sabe
 * nada de píxeles salvo `metrosPorPixel`, que actualiza la vista cuando cambia el encuadre.
 */
export class ControlRiel {
  x: number;
  vx = 0;
  objetivoX: number;
  /** Fila actual como número real mientras se anima (0 = la más baja). */
  fila: number;
  vFila = 0;
  filaObjetivo: number;
  private metrosPorPixel = 0.001;
  private ultimaRueda = -Infinity;

  private puntos: readonly (readonly number[])[];
  private instantaneo: boolean;
  private arrastrando = false;
  private eje: Eje = null;
  private acumX = 0;
  private acumY = 0;
  private filaAlEmpezar = 0;
  private vy = 0;

  constructor({ puntos, instantaneo = false, filaInicial = 0, xInicial }: ConfiguracionRiel) {
    this.puntos = puntos;
    this.instantaneo = instantaneo;
    this.filaObjetivo = acotar(Math.round(filaInicial), 0, Math.max(0, puntos.length - 1));
    this.fila = this.filaObjetivo;
    this.x =
      xInicial !== undefined && Number.isFinite(xInicial)
        ? puntoMasCercano(this.puntosDe(this.filaObjetivo), xInicial)
        : (this.puntosDe(this.filaObjetivo)[0] ?? 0);
    this.objetivoX = this.x;
  }

  get filas(): number {
    return Math.max(1, this.puntos.length);
  }

  /** Puntos de una balda; si está vacía, la unión de todas (el raíl nunca queda sin destinos). */
  puntosDe(fila: number): readonly number[] {
    const propios = this.puntos[fila];
    if (propios && propios.length > 0) return propios;
    return this.puntos.flat();
  }

  /** Límites del raíl con un pequeño margen para el rebote elástico. */
  private limites(): [number, number] {
    const todos = this.puntos.flat();
    if (todos.length === 0) return [this.x, this.x];
    return [Math.min(...todos), Math.max(...todos)];
  }

  /** Escala del encuadre actual (metros por píxel en el plano de las cajas). */
  encuadrar(metrosPorPixel: number): void {
    this.metrosPorPixel = metrosPorPixel;
  }

  /**
   * Rueda del ratón o trackpad: cada «golpe» (con una pausa mínima entre ellos, para no saltar
   * varios productos con un solo giro) pasa al producto contiguo o a la balda contigua.
   */
  rueda(dx: number, dy: number, ahoraMs: number): void {
    const pausa = Math.abs(dx) > Math.abs(dy) ? 140 : 320;
    if (ahoraMs - this.ultimaRueda < pausa) return;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
    this.ultimaRueda = ahoraMs;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.teclado(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    } else {
      // Rueda hacia abajo = desplazar hacia abajo = la cámara baja de balda.
      this.teclado(dy > 0 ? 'ArrowDown' : 'ArrowUp');
    }
  }

  // ---- Gestos de puntero -------------------------------------------------------------------

  empezarArrastre(): void {
    this.arrastrando = true;
    // Tocar el raíl lo detiene: la cámara se queda donde está hasta decidir el gesto.
    this.objetivoX = this.x;
    this.filaObjetivo = Math.round(this.fila);
    this.vFila = 0;
    this.eje = null;
    this.acumX = 0;
    this.acumY = 0;
    this.vx = 0;
    this.vy = 0;
    this.filaAlEmpezar = this.fila;
  }

  /** `dx`/`dy` en píxeles desde el último evento y `dt` en segundos. */
  moverArrastre(dx: number, dy: number, dt: number): void {
    if (!this.arrastrando) return;
    this.acumX += dx;
    this.acumY += dy;
    if (!this.eje) {
      if (Math.hypot(this.acumX, this.acumY) < UMBRAL_EJE) return;
      this.eje = Math.abs(this.acumX) >= Math.abs(this.acumY) ? 'x' : 'y';
      // Lo acumulado hasta decidir el eje cuenta como arrastre (sin saltos).
      dx = this.eje === 'x' ? this.acumX : 0;
      dy = this.eje === 'y' ? this.acumY : 0;
    }
    const seg = Math.max(dt, 1e-3);
    if (this.eje === 'x') {
      const [min, max] = this.limites();
      // El contenido sigue al dedo: dedo a la derecha → la cámara va a la izquierda.
      let paso = -dx * this.metrosPorPixel;
      const fueraPorIzq = this.x < min && paso < 0;
      const fueraPorDer = this.x > max && paso > 0;
      if (fueraPorIzq || fueraPorDer) paso *= 0.35; // resistencia elástica en los extremos
      this.x += paso;
      this.objetivoX = this.x;
      this.vx = 0.6 * this.vx + 0.4 * (paso / seg);
    } else {
      // Dedo arriba → la cámara baja (como al desplazar una página).
      const filas = this.filaAlEmpezar - this.acumY / PX_POR_FILA;
      this.fila = acotar(filas, -0.25, this.filas - 1 + 0.25);
      this.vy = 0.6 * this.vy + 0.4 * (dy / seg);
    }
  }

  terminarArrastre(): void {
    if (!this.arrastrando) return;
    this.arrastrando = false;
    if (this.eje === 'x') {
      const puntos = this.puntosDe(this.filaObjetivo);
      this.objetivoX = ajusteTrasLanzamiento(this.x, this.vx, puntos);
    } else if (this.eje === 'y') {
      const rapido = Math.abs(this.vy) > UMBRAL_VELOCIDAD_FILA;
      const largo = Math.abs(this.acumY) > UMBRAL_CAMBIO_FILA;
      let destino = this.filaAlEmpezar;
      if (rapido || largo) {
        // Dedo arriba (dy < 0) → fila inferior.
        const sentido = (rapido ? this.vy : this.acumY) < 0 ? -1 : 1;
        destino = this.filaAlEmpezar + sentido;
      }
      this.irAFila(destino);
    } else {
      // Un toque sin movimiento: nada que ajustar.
      this.objetivoX = this.x;
    }
    this.eje = null;
  }

  // ---- Teclado y rueda ---------------------------------------------------------------------

  /** Devuelve true si la tecla se ha usado (para evitar el desplazamiento de la página). */
  teclado(tecla: string): boolean {
    switch (tecla) {
      case 'ArrowRight':
        this.objetivoX = puntoSiguiente(this.puntosDe(this.filaObjetivo), this.objetivoX, 1);
        return true;
      case 'ArrowLeft':
        this.objetivoX = puntoSiguiente(this.puntosDe(this.filaObjetivo), this.objetivoX, -1);
        return true;
      case 'ArrowUp':
        this.irAFila(this.filaObjetivo + 1);
        return true;
      case 'ArrowDown':
        this.irAFila(this.filaObjetivo - 1);
        return true;
      case 'Home':
        this.objetivoX = this.limites()[0];
        this.objetivoX = puntoMasCercano(this.puntosDe(this.filaObjetivo), this.objetivoX);
        return true;
      case 'End':
        this.objetivoX = puntoMasCercano(this.puntosDe(this.filaObjetivo), this.limites()[1]);
        return true;
      default:
        return false;
    }
  }

  /** Cambia de balda y reajusta la posición al producto más cercano de la nueva balda. */
  irAFila(fila: number): void {
    this.filaObjetivo = acotar(Math.round(fila), 0, this.filas - 1);
    this.objetivoX = puntoMasCercano(this.puntosDe(this.filaObjetivo), this.objetivoX);
  }

  // ---- Simulación --------------------------------------------------------------------------

  actualizar(dt: number): void {
    const paso = Math.min(dt, 0.05);
    if (this.instantaneo && !this.arrastrando) {
      this.x = this.objetivoX;
      this.vx = 0;
      this.fila = this.filaObjetivo;
      this.vFila = 0;
      return;
    }
    if (!this.arrastrando || this.eje === 'y') {
      const m = pasoMuelle(this.x, this.vx, this.objetivoX, paso, OMEGA_POSICION);
      if (!this.arrastrando) {
        this.x = m.pos;
        this.vx = m.vel;
      }
    }
    if (!this.arrastrando) {
      const f = pasoMuelle(this.fila, this.vFila, this.filaObjetivo, paso, OMEGA_FILA);
      this.fila = f.pos;
      this.vFila = f.vel;
    }
  }

  /** ¿Hace falta seguir dibujando fotogramas? */
  enMovimiento(): boolean {
    return (
      this.arrastrando ||
      Math.abs(this.vx) > 1e-3 ||
      Math.abs(this.x - this.objetivoX) > 5e-4 ||
      Math.abs(this.vFila) > 1e-3 ||
      Math.abs(this.fila - this.filaObjetivo) > 1e-3
    );
  }

  /** Productos del raíl en la fila actual: útil para tests y para anunciar el destino. */
  destinoActual(): number {
    return this.objetivoX;
  }
}

/** Distancia de la cámara al plano de las cajas para que quepan `semiancho` metros a cada lado. */
export function distanciaRiel(
  fovVerticalGrados: number,
  aspecto: number,
  semiancho = 0.3,
  minima = 1.2,
): number {
  const mitadFov = (fovVerticalGrados * Math.PI) / 360;
  return Math.max(minima, semiancho / (Math.tan(mitadFov) * aspecto));
}

/** Metros que ocupa un píxel en el plano de las cajas a esa distancia. */
export function metrosPorPixel(
  fovVerticalGrados: number,
  distancia: number,
  altoPx: number,
): number {
  const mitadFov = (fovVerticalGrados * Math.PI) / 360;
  return (2 * distancia * Math.tan(mitadFov)) / Math.max(altoPx, 1);
}
