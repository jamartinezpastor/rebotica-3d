export interface EstadoCursorMano {
  visible: boolean;
  x: number;
  y: number;
  giroX: number;
  giroY: number;
  giroZ: number;
  cerrada: boolean;
  cierre: number;
}

/** Eventos y animación bajo demanda; el dibujo lo realiza Three.js, sin SVG ni DOM. */
export function instalarCursor3D(
  lienzo: HTMLCanvasElement,
  actualizar: (estado: EstadoCursorMano) => void,
): () => void {
  const precision = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
  const reducir = window.matchMedia('(prefers-reduced-motion: reduce)');
  const contraste = window.matchMedia('(forced-colors: active)');
  let visible = false;
  let pulsado = false;
  let cierre = 0;
  let puntero: number | null = null;
  let anterior: { x: number; y: number; t: number } | null = null;
  let frame: number | null = null;
  let giroX = 0;
  let giroY = 0;
  let giroZ = 0;
  let destinoX = 0;
  let destinoY = 0;
  let destinoZ = 0;
  let tiempo = 0;
  let x = 0;
  let y = 0;
  const dibujar = () =>
    actualizar({ visible, x, y, giroX, giroY, giroZ, cerrada: pulsado, cierre });
  const cancelar = () => {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    giroX = giroY = giroZ = destinoX = destinoY = destinoZ = 0;
    cierre = pulsado ? 1 : 0;
    dibujar();
  };
  const ocultar = () => {
    visible = false;
    pulsado = false;
    puntero = null;
    anterior = null;
    lienzo.classList.remove('cursor-mano-3d-activo');
    lienzo.classList.remove('cursor-mano-3d-arrastrando');
    if (lienzo.dataset.cursor === 'medicamento') {
      delete lienzo.dataset.cursor;
      delete lienzo.dataset.cursorMedicamento;
    }
    cancelar();
  };
  const permitido = () => precision.matches && !contraste.matches;
  const animar = (ahora: number) => {
    frame = null;
    if (!visible || reducir.matches) return;
    const dt = Math.min((ahora - tiempo) / 1000, 0.05);
    tiempo = ahora;
    const avance = 1 - Math.exp(-18 * dt);
    giroX += (destinoX - giroX) * avance;
    giroY += (destinoY - giroY) * avance;
    giroZ += (destinoZ - giroZ) * avance;
    cierre += ((pulsado ? 1 : 0) - cierre) * avance;
    const reposo = Math.exp(-9 * dt);
    destinoX *= reposo;
    destinoY *= reposo;
    destinoZ *= reposo;
    dibujar();
    if (
      Math.max(
        Math.abs(giroX),
        Math.abs(giroY),
        Math.abs(giroZ),
        Math.abs(destinoX),
        Math.abs(destinoY),
      ) > 0.03 ||
      Math.abs((pulsado ? 1 : 0) - cierre) > 0.002
    ) {
      frame = window.requestAnimationFrame(animar);
    } else cancelar();
  };
  const solicitar = () => {
    if (reducir.matches) {
      cancelar();
      return;
    }
    if (frame === null) {
      tiempo = performance.now();
      frame = window.requestAnimationFrame(animar);
    }
  };
  const situar = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || !permitido()) {
      ocultar();
      return;
    }
    x = e.clientX;
    y = e.clientY;
    visible = true;
    if (!reducir.matches && anterior) {
      const dt = Math.max(8, e.timeStamp - anterior.t);
      const vx = (x - anterior.x) / dt;
      const vy = (y - anterior.y) / dt;
      destinoX = Math.max(-10, Math.min(10, -vy * 9));
      destinoY = Math.max(-16, Math.min(16, vx * 12));
      destinoZ = Math.max(-7, Math.min(7, vx * 5));
      solicitar();
    }
    anterior = { x, y, t: e.timeStamp };
    lienzo.classList.add('cursor-mano-3d-activo');
    dibujar();
  };
  const abajo = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !e.isPrimary || !permitido()) return;
    situar(e);
    pulsado = true;
    lienzo.classList.add('cursor-mano-3d-arrastrando');
    puntero = e.pointerId;
    dibujar();
    solicitar();
  };
  const soltar = (e: PointerEvent) => {
    if (e.pointerId !== puntero) return;
    pulsado = false;
    lienzo.classList.remove('cursor-mano-3d-arrastrando');
    puntero = null;
    dibujar();
    if (document.elementFromPoint(x, y) !== lienzo) ocultar();
    else solicitar();
  };
  const salir = () => {
    if (!pulsado) ocultar();
  };
  const preferencias = () => {
    if (!permitido()) ocultar();
    else if (reducir.matches) cancelar();
  };
  const visibilidad = () => {
    if (document.hidden) ocultar();
  };
  lienzo.addEventListener('pointerenter', situar);
  lienzo.addEventListener('pointermove', situar);
  lienzo.addEventListener('pointerdown', abajo);
  lienzo.addEventListener('pointerleave', salir);
  lienzo.addEventListener('pointercancel', ocultar);
  lienzo.addEventListener('lostpointercapture', soltar);
  window.addEventListener('pointerup', soltar);
  window.addEventListener('blur', ocultar);
  document.addEventListener('visibilitychange', visibilidad);
  precision.addEventListener('change', preferencias);
  reducir.addEventListener('change', preferencias);
  contraste.addEventListener('change', preferencias);
  dibujar();
  return () => {
    ocultar();
    lienzo.removeEventListener('pointerenter', situar);
    lienzo.removeEventListener('pointermove', situar);
    lienzo.removeEventListener('pointerdown', abajo);
    lienzo.removeEventListener('pointerleave', salir);
    lienzo.removeEventListener('pointercancel', ocultar);
    lienzo.removeEventListener('lostpointercapture', soltar);
    window.removeEventListener('pointerup', soltar);
    window.removeEventListener('blur', ocultar);
    document.removeEventListener('visibilitychange', visibilidad);
    precision.removeEventListener('change', preferencias);
    reducir.removeEventListener('change', preferencias);
    contraste.removeEventListener('change', preferencias);
  };
}
