const PULSABLE = [
  'button',
  'a[href]',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="radio"]',
  '[role="option"]',
  '[role="slider"]',
  '[tabindex]:not([tabindex="-1"])',
  '.cursor-pointer',
  '[data-cursor="pulsable"]',
  '[data-cursor="medicamento"]',
].join(',');

function esPulsable(elemento: Element | null): boolean {
  if (!elemento || elemento.closest(':disabled, [aria-disabled="true"], [inert]')) return false;
  if (elemento.closest(PULSABLE)) return true;
  const etiqueta = elemento.closest('label');
  return (
    etiqueta instanceof HTMLLabelElement &&
    !!etiqueta.control &&
    !etiqueta.control.matches(':disabled')
  );
}

/** Un único nodo y posiciones por fotograma; no provoca renders de React al mover el ratón. */
export function instalarCursorPunto(punto: HTMLElement): () => void {
  const precision = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
  const contraste = window.matchMedia('(forced-colors: active)');
  let frame: number | null = null;
  let x = 0;
  let y = 0;
  let objetivo: Element | null = null;
  punto.hidden = true;
  const ocultar = () => {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    punto.hidden = true;
    punto.classList.remove('cursor-punto-pulsable');
    punto.classList.remove('cursor-punto-ojo');
    document.documentElement.classList.remove('cursor-punto-activo');
  };
  const dibujar = () => {
    frame = null;
    const debajo = document.elementFromPoint?.(x, y) ?? objetivo;
    const pulsable = esPulsable(debajo);
    punto.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    punto.classList.toggle('cursor-punto-pulsable', pulsable);
    punto.classList.toggle(
      'cursor-punto-ojo',
      pulsable && !!debajo?.closest('[data-cursor="medicamento"]'),
    );
    punto.hidden = false;
    document.documentElement.classList.add('cursor-punto-activo');
  };
  const mover = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || !precision.matches || contraste.matches) {
      ocultar();
      return;
    }
    x = e.clientX;
    y = e.clientY;
    objetivo = e.target instanceof Element ? e.target : null;
    if (frame === null) frame = window.requestAnimationFrame(dibujar);
  };
  const salir = (e: PointerEvent) => {
    if (e.relatedTarget === null) ocultar();
  };
  const preferencias = () => {
    if (!precision.matches || contraste.matches) ocultar();
  };
  const visibilidad = () => {
    if (document.hidden) ocultar();
  };

  document.addEventListener('pointermove', mover, { passive: true, capture: true });
  document.addEventListener('pointerover', mover, { passive: true, capture: true });
  document.addEventListener('pointerdown', mover, { passive: true, capture: true });
  document.addEventListener('pointerup', mover, { passive: true, capture: true });
  document.addEventListener('pointerout', salir, true);
  document.addEventListener('pointercancel', ocultar, true);
  document.addEventListener('visibilitychange', visibilidad);
  window.addEventListener('blur', ocultar);
  precision.addEventListener('change', preferencias);
  contraste.addEventListener('change', preferencias);
  return () => {
    ocultar();
    document.removeEventListener('pointermove', mover, true);
    document.removeEventListener('pointerover', mover, true);
    document.removeEventListener('pointerdown', mover, true);
    document.removeEventListener('pointerup', mover, true);
    document.removeEventListener('pointerout', salir, true);
    document.removeEventListener('pointercancel', ocultar, true);
    document.removeEventListener('visibilitychange', visibilidad);
    window.removeEventListener('blur', ocultar);
    precision.removeEventListener('change', preferencias);
    contraste.removeEventListener('change', preferencias);
  };
}
