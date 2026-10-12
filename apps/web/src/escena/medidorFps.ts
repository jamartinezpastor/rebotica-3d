/**
 * Medición de fotogramas por segundo. La escena se dibuja bajo demanda, así que entre
 * interacciones no hay fotogramas: las pausas largas no cuentan como lentitud.
 */

export interface EstadisticasFps {
  /** Fotogramas por segundo medios de la ventana. */
  fps: number;
  /** Percentil 95 del tiempo de fotograma (ms): lo que ven los peores 1 de cada 20. */
  p95Ms: number;
  /** Fotograma más largo de la ventana (ms). */
  maxMs: number;
  muestras: number;
}

export interface OpcionesMedidor {
  /** Cuántos fotogramas consecutivos forman la ventana. */
  ventana?: number;
  /** Un intervalo mayor que esto (ms) es una pausa, no un fotograma lento. */
  pausaMs?: number;
}

export class MedidorFps {
  private readonly tiempos: number[] = [];
  private fotogramas = 0;
  private avisoDado = false;
  private readonly ventana: number;
  private readonly pausaMs: number;

  constructor({ ventana = 60, pausaMs = 250 }: OpcionesMedidor = {}) {
    this.ventana = ventana;
    this.pausaMs = pausaMs;
  }

  /** Fotogramas registrados desde el principio (las pausas y valores no válidos no cuentan). */
  get total(): number {
    return this.fotogramas;
  }

  /** Devuelve true solo la primera vez: para dar un aviso único de lentitud. */
  primerAviso(): boolean {
    if (this.avisoDado) return false;
    this.avisoDado = true;
    return true;
  }

  /** Registra un fotograma con su duración en segundos (el `delta` de `useFrame`). */
  registrar(deltaSegundos: number): void {
    const ms = deltaSegundos * 1000;
    if (!(ms > 0)) return;
    if (ms > this.pausaMs) {
      // Tras una pausa el primer intervalo es la espera, no el coste de dibujar.
      this.tiempos.length = 0;
      return;
    }
    this.fotogramas++;
    this.tiempos.push(ms);
    if (this.tiempos.length > this.ventana) this.tiempos.shift();
  }

  get llena(): boolean {
    return this.tiempos.length >= this.ventana;
  }

  estadisticas(): EstadisticasFps | null {
    const n = this.tiempos.length;
    if (n === 0) return null;
    const suma = this.tiempos.reduce((a, b) => a + b, 0);
    const orden = [...this.tiempos].sort((a, b) => a - b);
    const p95 = orden[Math.min(n - 1, Math.floor(n * 0.95))] ?? 0;
    return {
      fps: 1000 / (suma / n),
      p95Ms: p95,
      maxMs: orden[n - 1] ?? 0,
      muestras: n,
    };
  }

  reiniciar(): void {
    this.tiempos.length = 0;
  }
}

/** ¿Es la escena demasiado lenta como para recomendar la vista lista? */
export function esLento(e: EstadisticasFps | null, umbralFps = 24): boolean {
  return e !== null && e.fps < umbralFps;
}
