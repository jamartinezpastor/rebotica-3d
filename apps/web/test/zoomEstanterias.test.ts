import { describe, expect, it, vi } from 'vitest';
import {
  DISTANCIA_ZOOM_MAX,
  DISTANCIA_ZOOM_MIN,
  instalarPellizco,
  ZoomEstanterias,
} from '../src/escena/zoomEstanterias';

describe('zoom moderado de las estanterías', () => {
  it('la rueda acerca y aleja sin sobrepasar los límites', () => {
    const zoom = new ZoomEstanterias();
    zoom.rueda(-120, 0, 800);
    zoom.actualizar(1, true);
    expect(zoom.factor).toBeLessThan(1);
    zoom.rueda(10000, 0, 800);
    zoom.actualizar(1, true);
    expect(zoom.factor).toBe(DISTANCIA_ZOOM_MAX);
    zoom.rueda(-10000, 0, 800);
    zoom.actualizar(1, true);
    expect(zoom.factor).toBe(DISTANCIA_ZOOM_MIN);
    zoom.restablecer();
    zoom.actualizar(1, true);
    expect(zoom.factor).toBe(1);
  });

  it('normaliza ruedas en píxeles, líneas y páginas', () => {
    const factores = [
      [32, 0],
      [2, 1],
      [0.04, 2],
    ].map(([delta, modo]) => {
      const zoom = new ZoomEstanterias();
      zoom.rueda(delta!, modo!, 800);
      zoom.actualizar(1, true);
      return zoom.factor;
    });
    expect(factores[0]).toBeCloseTo(factores[1]!);
    expect(factores[0]).toBeCloseTo(factores[2]!);
  });

  it('suaviza el movimiento hasta detenerse y descarta proporciones inválidas', () => {
    const zoom = new ZoomEstanterias();
    zoom.ajustar(1.2);
    expect(zoom.actualizar(1 / 60, false)).toBe(true);
    expect(zoom.factor).toBeGreaterThan(1);
    expect(zoom.factor).toBeLessThan(1.2);
    for (let i = 0; i < 120; i++) zoom.actualizar(1 / 60, false);
    expect(zoom.actualizar(1 / 60, false)).toBe(false);
    expect(zoom.factor).toBe(1.2);
    for (const n of [NaN, Infinity, 0, -1]) zoom.ajustar(n);
    zoom.actualizar(1, true);
    expect(zoom.factor).toBe(1.2);
  });
});

function lienzo() {
  const el = document.createElement('canvas');
  el.setPointerCapture = vi.fn();
  el.hasPointerCapture = vi.fn(() => false);
  el.releasePointerCapture = vi.fn();
  return el;
}
function dedo(el: HTMLCanvasElement, tipo: string, id: number, x: number, pointerType = 'touch') {
  const evento = new Event(tipo, { bubbles: true, cancelable: true });
  Object.assign(evento, { pointerType, pointerId: id, clientX: x, clientY: 100 });
  el.dispatchEvent(evento);
  return evento;
}

describe('pellizco con dos dedos', () => {
  it('separa zoom y arrastre, bloquea el clic residual y permite un toque nuevo', () => {
    const el = lienzo();
    const empezar = vi.fn();
    const cambiar = vi.fn();
    const mover = vi.fn();
    const clic = vi.fn();
    el.addEventListener('pointermove', mover);
    el.addEventListener('click', clic);
    const quitar = instalarPellizco(el, empezar, cambiar);
    dedo(el, 'pointerdown', 1, 100);
    dedo(el, 'pointermove', 1, 110);
    expect(mover).toHaveBeenCalledOnce();
    dedo(el, 'pointerdown', 2, 210);
    expect(empezar).toHaveBeenCalledOnce();
    expect(dedo(el, 'pointermove', 2, 310).defaultPrevented).toBe(true);
    expect(cambiar).toHaveBeenLastCalledWith(0.5);
    expect(mover).toHaveBeenCalledOnce();
    dedo(el, 'pointerup', 2, 310);
    dedo(el, 'pointermove', 1, 120);
    expect(mover).toHaveBeenCalledOnce();
    dedo(el, 'pointerup', 1, 120);
    el.click();
    expect(clic).not.toHaveBeenCalled();
    dedo(el, 'pointerdown', 3, 120);
    dedo(el, 'pointerup', 3, 120);
    el.click();
    expect(clic).toHaveBeenCalledOnce();
    quitar();
  });

  it('recupera el ratón tras cancelar un pellizco y elimina los listeners', () => {
    const el = lienzo();
    const cambiar = vi.fn();
    const quitar = instalarPellizco(el, vi.fn(), cambiar);
    dedo(el, 'pointerdown', 1, 100);
    dedo(el, 'pointerdown', 2, 200);
    dedo(el, 'pointercancel', 1, 100);
    dedo(el, 'pointercancel', 2, 200);
    dedo(el, 'pointerdown', 4, 100, 'mouse');
    const clic = new MouseEvent('click', { cancelable: true });
    el.dispatchEvent(clic);
    expect(clic.defaultPrevented).toBe(false);
    quitar();
    dedo(el, 'pointerdown', 1, 100);
    dedo(el, 'pointerdown', 2, 200);
    dedo(el, 'pointermove', 2, 300);
    expect(cambiar).not.toHaveBeenCalled();
  });
});
