/** Distancia relativa al encuadre del raíl: acercamiento y alejamiento moderados. */
export const DISTANCIA_ZOOM_MIN = 0.8;
export const DISTANCIA_ZOOM_MAX = 1.4;

export class ZoomEstanterias {
  factor = 1;
  private destino = 1;

  ajustar(proporcion: number): void {
    if (!Number.isFinite(proporcion) || proporcion <= 0) return;
    this.destino = Math.min(
      DISTANCIA_ZOOM_MAX,
      Math.max(DISTANCIA_ZOOM_MIN, this.destino * proporcion),
    );
  }

  rueda(delta: number, modo: number, alto: number): void {
    const pixeles = delta * (modo === 1 ? 16 : modo === 2 ? alto : 1);
    this.ajustar(Math.exp(Math.max(-1000, Math.min(1000, pixeles)) * 0.0015));
  }

  restablecer(): void {
    this.destino = 1;
  }

  /** Devuelve si hay que seguir dibujando. Respeta el modo de menos movimiento. */
  actualizar(dt: number, instantaneo: boolean): boolean {
    this.factor +=
      (this.destino - this.factor) * (instantaneo ? 1 : 1 - Math.exp(-14 * Math.max(0, dt)));
    if (Math.abs(this.destino - this.factor) < 0.0001) {
      this.factor = this.destino;
      return false;
    }
    return true;
  }
}

/** Captura el pellizco antes de los manejadores de arrastre y selección de las cajas. */
export function instalarPellizco(
  el: HTMLCanvasElement,
  alEmpezar: () => void,
  alCambiar: (proporcion: number) => void,
): () => void {
  const dedos = new Map<number, { x: number; y: number }>();
  let pellizcando = false;
  let bloquearClick = false;
  let separacion = 0;
  const distancia = () => {
    const [a, b] = [...dedos.values()];
    return dedos.size === 2 && a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const bloquear = (e: Event) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const abajo = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') {
      if (dedos.size === 0) bloquearClick = false;
      return;
    }
    if (dedos.size === 0) bloquearClick = false;
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    el.setPointerCapture(e.pointerId);
    if (dedos.size < 2) return;
    if (!pellizcando) alEmpezar();
    pellizcando = true;
    bloquearClick = true;
    separacion = distancia();
    bloquear(e);
  };
  const mover = (e: PointerEvent) => {
    if (!dedos.has(e.pointerId)) return;
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!pellizcando) return;
    const nueva = distancia();
    if (separacion > 0 && nueva > 0) alCambiar(separacion / nueva);
    separacion = nueva;
    bloquear(e);
  };
  const soltar = (e: PointerEvent) => {
    if (!dedos.delete(e.pointerId)) return;
    if (pellizcando) bloquear(e);
    separacion = distancia();
    if (dedos.size === 0) pellizcando = false;
  };
  const clic = (e: MouseEvent) => {
    if (bloquearClick) bloquear(e);
  };
  el.addEventListener('pointerdown', abajo, true);
  el.addEventListener('pointermove', mover, true);
  el.addEventListener('pointerup', soltar, true);
  el.addEventListener('pointercancel', soltar, true);
  el.addEventListener('lostpointercapture', soltar, true);
  el.addEventListener('click', clic, true);
  return () => {
    el.removeEventListener('pointerdown', abajo, true);
    el.removeEventListener('pointermove', mover, true);
    el.removeEventListener('pointerup', soltar, true);
    el.removeEventListener('pointercancel', soltar, true);
    el.removeEventListener('lostpointercapture', soltar, true);
    el.removeEventListener('click', clic, true);
    for (const id of dedos.keys()) if (el.hasPointerCapture(id)) el.releasePointerCapture(id);
    dedos.clear();
  };
}
