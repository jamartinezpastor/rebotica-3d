import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { instalarCursorPunto } from '../src/controlCursorPunto';

let punto: HTMLDivElement;
let zona: HTMLDivElement;
let debajo: Element | null;
let frames: Map<number, FrameRequestCallback>;
let quitar: (() => void) | undefined;
let precision: { matches: boolean; cambio: () => void };
let contraste: { matches: boolean; cambio: () => void };
const original = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');

function puntero(destino: Element, tipo = 'pointermove', extra: Record<string, unknown> = {}) {
  debajo = destino;
  const evento = new Event(tipo, { bubbles: true });
  Object.assign(evento, { pointerType: 'mouse', clientX: 100, clientY: 120, ...extra });
  destino.dispatchEvent(evento);
}
function dibujar() {
  const pendientes = [...frames.values()];
  frames.clear();
  for (const callback of pendientes) callback(0);
}

beforeEach(() => {
  frames = new Map();
  let id = 0;
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      frames.set(++id, callback);
      return id;
    }),
  );
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((id: number) => frames.delete(id)),
  );
  precision = { matches: true, cambio: () => {} };
  contraste = { matches: false, cambio: () => {} };
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      const media = query.includes('forced-colors') ? contraste : precision;
      return {
        get matches() {
          return media.matches;
        },
        addEventListener: (_: string, listener: () => void) => {
          media.cambio = listener;
        },
        removeEventListener: vi.fn(),
      };
    }),
  );
  zona = document.createElement('div');
  punto = document.createElement('div');
  document.body.append(zona, punto);
  debajo = zona;
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => debajo });
  quitar = instalarCursorPunto(punto);
});
afterEach(() => {
  quitar?.();
  zona.remove();
  punto.remove();
  if (original) Object.defineProperty(document, 'elementFromPoint', original);
  else Reflect.deleteProperty(document, 'elementFromPoint');
  vi.unstubAllGlobals();
});

describe('cursor de punto verde', () => {
  it('cambia a un ojo luminoso sobre medicamentos en lista y en el lienzo, y vuelve al punto al salir', () => {
    zona.innerHTML =
      '<button data-cursor="medicamento"><span>Producto</span></button><canvas data-cursor="medicamento"></canvas><button>Volver</button>';
    for (const destino of zona.querySelectorAll('span, canvas')) {
      puntero(destino);
      dibujar();
      expect(punto.classList.contains('cursor-punto-ojo')).toBe(true);
      expect(punto.classList.contains('cursor-punto-pulsable')).toBe(true);
    }
    puntero(zona.querySelector('button:last-child')!);
    dibujar();
    expect(punto.classList.contains('cursor-punto-ojo')).toBe(false);
    expect(punto.classList.contains('cursor-punto-pulsable')).toBe(true);
    puntero(zona);
    dibujar();
    expect(punto.classList.contains('cursor-punto-ojo')).toBe(false);
    expect(punto.classList.contains('cursor-punto-pulsable')).toBe(false);
  });

  it('no muestra un ojo para un medicamento deshabilitado y lo retira con entrada táctil', () => {
    zona.innerHTML = '<button data-cursor="medicamento" disabled>Producto</button>';
    const boton = zona.querySelector('button')!;
    puntero(boton);
    dibujar();
    expect(punto.classList.contains('cursor-punto-ojo')).toBe(false);
    boton.disabled = false;
    puntero(boton);
    dibujar();
    expect(punto.classList.contains('cursor-punto-ojo')).toBe(true);
    puntero(boton, 'pointerdown', { pointerType: 'touch' });
    expect(punto.hidden).toBe(true);
    expect(punto.classList.contains('cursor-punto-ojo')).toBe(false);
  });
  it('sigue al ratón una vez por fotograma sin interceptar clics ni animar en reposo', () => {
    expect(punto.hidden).toBe(true);
    puntero(zona);
    puntero(zona, 'pointermove', { clientX: 160, clientY: 180 });
    expect(frames.size).toBe(1);
    dibujar();
    expect(punto.hidden).toBe(false);
    expect(punto.style.transform).toBe('translate3d(160px, 180px, 0)');
    expect(document.documentElement.classList.contains('cursor-punto-activo')).toBe(true);
    expect(punto.classList.contains('cursor-punto-pulsable')).toBe(false);
    expect(frames.size).toBe(0);
    const pulsar = vi.fn();
    zona.addEventListener('click', pulsar);
    zona.click();
    expect(pulsar).toHaveBeenCalledTimes(1);
  });

  it('enciende los destellos en controles, enlaces y sus hijos, y los apaga al salir', () => {
    for (const html of [
      '<button><span>Botón</span></button>',
      '<a href="/">Enlace</a>',
      '<details><summary>Abrir</summary></details>',
      '<input type="range">',
      '<div role="tab" tabindex="0">Pestaña</div>',
      '<div data-cursor="pulsable">Acción</div>',
      '<label for="edad-cursor">Edad</label><input id="edad-cursor">',
    ]) {
      zona.innerHTML = html;
      const destino = zona.querySelector('span, a, summary, label, [role], [data-cursor], input')!;
      puntero(destino, 'pointerover');
      dibujar();
      expect(punto.classList.contains('cursor-punto-pulsable'), html).toBe(true);
    }
    puntero(zona);
    dibujar();
    expect(punto.classList.contains('cursor-punto-pulsable')).toBe(false);
  });

  it('no ilumina controles deshabilitados, enlaces sin destino ni regiones no interactivas', () => {
    for (const html of [
      '<button disabled><span>No disponible</span></button>',
      '<div aria-disabled="true"><button>No disponible</button></div>',
      '<a>Sin destino</a>',
      '<section tabindex="-1">Ficha</section>',
    ]) {
      zona.innerHTML = html;
      puntero(zona.querySelector('span, button, a, section')!);
      dibujar();
      expect(punto.classList.contains('cursor-punto-pulsable'), html).toBe(false);
    }
  });

  it('comprueba el elemento real bajo el ratón incluso con captura de puntero', () => {
    const lienzo = document.createElement('canvas');
    const boton = document.createElement('button');
    zona.append(lienzo, boton);
    puntero(lienzo);
    debajo = boton;
    dibujar();
    expect(punto.classList.contains('cursor-punto-pulsable')).toBe(true);
  });

  it('con tacto o colores forzados restaura el cursor nativo y cancela actualizaciones pendientes', () => {
    puntero(zona);
    puntero(zona, 'pointerdown', { pointerType: 'touch' });
    expect(frames.size).toBe(0);
    expect(punto.hidden).toBe(true);
    puntero(zona);
    dibujar();
    contraste.matches = true;
    contraste.cambio();
    expect(punto.hidden).toBe(true);
    expect(document.documentElement.classList.contains('cursor-punto-activo')).toBe(false);
    puntero(zona);
    expect(frames.size).toBe(0);
    contraste.matches = false;
    precision.matches = false;
    puntero(zona);
    expect(frames.size).toBe(0);
  });

  it('desaparece al salir o perder el foco y libera eventos al desmontar', () => {
    puntero(zona);
    dibujar();
    puntero(zona, 'pointerout', { relatedTarget: null });
    expect(punto.hidden).toBe(true);
    puntero(zona);
    window.dispatchEvent(new Event('blur'));
    expect(frames.size).toBe(0);
    expect(punto.hidden).toBe(true);
    quitar?.();
    puntero(zona);
    expect(frames.size).toBe(0);
    expect(document.documentElement.classList.contains('cursor-punto-activo')).toBe(false);
  });
});
