import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { instalarCursor3D, type EstadoCursorMano } from '../src/escena/cursorMano';

let lienzo: HTMLCanvasElement;
let quitar: (() => void) | undefined;
let menosMovimiento = false;
let contrasteForzado = false;
let frames: Map<number, FrameRequestCallback>;
let estado: EstadoCursorMano;
const actualizar = (nuevo: EstadoCursorMano) => {
  estado = nuevo;
};
const originalElementFromPoint = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');

function puntero(tipo: string, extra: Record<string, unknown> = {}) {
  const evento = new Event(tipo, { bubbles: true });
  Object.assign(evento, {
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    clientX: 100,
    clientY: 100,
    ...extra,
  });
  lienzo.dispatchEvent(evento);
}

beforeEach(() => {
  menosMovimiento = false;
  contrasteForzado = false;
  frames = new Map();
  let id = 0;
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('reduced-motion')
        ? menosMovimiento
        : query.includes('forced-colors')
          ? contrasteForzado
          : true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      const siguiente = ++id;
      frames.set(siguiente, callback);
      return siguiente;
    }),
  );
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((id: number) => frames.delete(id)),
  );
  lienzo = document.createElement('canvas');
  lienzo.style.cursor = 'grab';
  document.body.append(lienzo);
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => lienzo });
});

afterEach(() => {
  quitar?.();
  quitar = undefined;
  lienzo.remove();
  if (originalElementFromPoint)
    Object.defineProperty(document, 'elementFromPoint', originalElementFromPoint);
  else Reflect.deleteProperty(document, 'elementFromPoint');
  vi.unstubAllGlobals();
});

describe('cursor de mano con profundidad', () => {
  it('abre y cierra con el arrastre, sin interceptar los eventos, y restaura el cursor al salir', () => {
    quitar = instalarCursor3D(lienzo, actualizar);
    const gesto = vi.fn();
    lienzo.addEventListener('pointerdown', gesto);
    puntero('pointerenter');
    expect(lienzo.classList.contains('cursor-mano-3d-activo')).toBe(true);
    puntero('pointerdown');
    expect(estado.cerrada).toBe(true);
    expect(gesto).toHaveBeenCalledTimes(1);
    puntero('pointerup');
    expect(estado.cerrada).toBe(false);
    puntero('pointerleave');
    expect(lienzo.classList.contains('cursor-mano-3d-activo')).toBe(false);
    expect(lienzo.style.cursor).toBe('grab');
  });

  it('cancela la mano cerrada y los fotogramas pendientes al perder el foco o desmontar', () => {
    quitar = instalarCursor3D(lienzo, actualizar);
    puntero('pointerenter');
    puntero('pointerdown');
    puntero('pointermove', { clientX: 120 });
    expect(frames.size).toBe(1);
    window.dispatchEvent(new Event('blur'));
    expect(frames.size).toBe(0);
    expect(estado.visible).toBe(false);
    quitar();
    expect(estado.visible).toBe(false);
    puntero('pointerenter');
    expect(lienzo.classList.contains('cursor-mano-3d-activo')).toBe(false);
  });

  it('con tacto o colores forzados mantiene el cursor nativo', () => {
    quitar = instalarCursor3D(lienzo, actualizar);
    puntero('pointerenter', { pointerType: 'touch' });
    expect(lienzo.classList.contains('cursor-mano-3d-activo')).toBe(false);
    quitar();
    contrasteForzado = true;
    quitar = instalarCursor3D(lienzo, actualizar);
    puntero('pointerenter');
    expect(lienzo.classList.contains('cursor-mano-3d-activo')).toBe(false);
  });

  it('inclina la mano al moverse y deja de solicitar fotogramas cuando vuelve a reposo', () => {
    quitar = instalarCursor3D(lienzo, actualizar);
    puntero('pointerenter');
    const reposo = estado.giroY;
    puntero('pointermove', { clientX: 120 });
    let t = performance.now();
    const avanzar = () => {
      const pendientes = [...frames.values()];
      frames.clear();
      t += 16;
      for (const callback of pendientes) callback(t);
    };
    avanzar();
    expect(estado.giroY).not.toBe(reposo);
    for (let i = 0; i < 150; i++) avanzar();
    expect(frames.size).toBe(0);
    expect(estado.giroY).toBe(reposo);
  });

  it('respeta menos movimiento sin perder el cambio de mano al pulsar', () => {
    menosMovimiento = true;
    quitar = instalarCursor3D(lienzo, actualizar);
    puntero('pointerenter');
    puntero('pointermove', { clientX: 120 });
    expect(frames.size).toBe(0);
    puntero('pointerdown');
    expect(estado.cierre).toBe(1);
  });
});
