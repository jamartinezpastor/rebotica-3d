/**
 * Giro de la caja en la ficha (plan §Ficha): gira sola despacio sobre su eje vertical; se puede
 * arrastrar con inercia y, a los 3 s sin tocarla, vuelve a girar sola. Lógica pura.
 */

/** Radianes por píxel de arrastre horizontal. */
export const RAD_POR_PIXEL = 0.012;
/** Segundos sin tocarla tras los que vuelve a girar sola. */
export const REANUDAR_TRAS = 3;
/** Fricción de la inercia (1/s): a más valor, se detiene antes. */
const FRICCION = 3.2;
/** Qué tan rápido la velocidad vuelve a la del giro automático (1/s). */
const RETORNO = 1.6;

export class GiroFicha {
  /** Ángulo actual (rad). */
  angulo = 0;
  /** Velocidad angular actual (rad/s). */
  velocidad: number;

  private readonly automatica: number;
  private arrastrando = false;
  // Mientras nadie la toque, el «ocio» es infinito: gira sola desde el primer momento.
  private ocioDesde = -Infinity;

  private readonly inercia: boolean;

  /** Con `inercia: false` (menos movimiento) el giro se detiene al soltar. */
  constructor(velocidadAutomatica: number, inercia = true) {
    this.automatica = velocidadAutomatica;
    this.velocidad = velocidadAutomatica;
    this.inercia = inercia;
  }

  /** Vuelve al estado inicial (otra caja, otra apertura de la ficha). */
  reiniciar(): void {
    this.angulo = 0;
    this.velocidad = this.automatica;
    this.arrastrando = false;
    this.ocioDesde = -Infinity;
  }

  get estaArrastrando(): boolean {
    return this.arrastrando;
  }

  empezar(): void {
    this.arrastrando = true;
    this.velocidad = 0;
  }

  /** `dx` en píxeles desde el último evento y `dt` en segundos. */
  arrastrar(dx: number, dt: number): void {
    if (!this.arrastrando) return;
    const paso = dx * RAD_POR_PIXEL;
    this.angulo += paso;
    const medida = paso / Math.max(dt, 1e-3);
    // Se suaviza para que un tirón aislado no dispare la inercia.
    this.velocidad = 0.6 * this.velocidad + 0.4 * medida;
  }

  /** `ahora` en segundos (cualquier reloj monótono); marca el inicio del tiempo sin tocar. */
  soltar(ahora: number): void {
    this.arrastrando = false;
    this.ocioDesde = ahora;
    if (!this.inercia) this.velocidad = 0;
  }

  /** Avanza `dt` segundos. Devuelve true mientras el giro siga cambiando. */
  actualizar(dt: number, ahora: number): boolean {
    if (this.arrastrando) return true;
    const paso = Math.min(Math.max(dt, 0), 0.05);
    const ocio = ahora - this.ocioDesde;
    if (ocio < REANUDAR_TRAS) {
      // Inercia: la velocidad del lanzamiento se apaga.
      this.velocidad *= Math.exp(-FRICCION * paso);
    } else {
      // Pasados los 3 s la velocidad vuelve suavemente a la del giro automático.
      const k = 1 - Math.exp(-RETORNO * paso);
      this.velocidad += (this.automatica - this.velocidad) * k;
    }
    this.angulo += this.velocidad * paso;
    return true;
  }
}
