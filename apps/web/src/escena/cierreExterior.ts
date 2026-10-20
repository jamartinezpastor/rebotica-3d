/** Cierra con un toque exterior, dejando pasar los arrastres que giran la caja en el lienzo. */
export function instalarCierreExterior(panel: HTMLElement, onCerrar: () => void): () => void {
  let gesto: { id: number; x: number; y: number; arrastre: boolean; terminado: boolean } | null =
    null;
  const fuera = (evento: Event) => evento.target instanceof Node && !panel.contains(evento.target);

  const abajo = (e: PointerEvent) => {
    gesto =
      e.isPrimary && e.button === 0 && fuera(e)
        ? { id: e.pointerId, x: e.clientX, y: e.clientY, arrastre: false, terminado: false }
        : null;
  };
  const mover = (e: PointerEvent) => {
    if (gesto?.id === e.pointerId && Math.hypot(e.clientX - gesto.x, e.clientY - gesto.y) >= 8) {
      gesto.arrastre = true;
    }
  };
  const soltar = (e: PointerEvent) => {
    if (gesto?.id !== e.pointerId) return;
    mover(e);
    if (!fuera(e)) gesto = null;
    else gesto.terminado = true;
  };
  const cancelar = () => {
    gesto = null;
  };
  const pulsar = (e: MouseEvent) => {
    const cerrar = gesto?.terminado && !gesto.arrastre && e.button === 0 && fuera(e);
    gesto = null;
    if (!cerrar) return;
    // Solo se arma tras pointerdown: el clic que acaba de abrir la ficha no la cierra.
    // Se consume antes de llegar al fondo para que no cambie de producto ni navegue.
    e.preventDefault();
    e.stopPropagation();
    onCerrar();
  };

  document.addEventListener('pointerdown', abajo, true);
  document.addEventListener('pointermove', mover, true);
  document.addEventListener('pointerup', soltar, true);
  document.addEventListener('pointercancel', cancelar, true);
  document.addEventListener('click', pulsar, true);
  window.addEventListener('blur', cancelar);
  return () => {
    document.removeEventListener('pointerdown', abajo, true);
    document.removeEventListener('pointermove', mover, true);
    document.removeEventListener('pointerup', soltar, true);
    document.removeEventListener('pointercancel', cancelar, true);
    document.removeEventListener('click', pulsar, true);
    window.removeEventListener('blur', cancelar);
  };
}
