import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { PerspectiveCamera } from 'three';
import { ControlRiel, distanciaRiel, metrosPorPixel, puntoMasCercano } from './riel';
import { marcoEnRiel, type EsquinaRiel } from './trayectoPasillo';

/** Cuánto por encima del centro de la balda se coloca el ojo de la cámara. */
const ELEVACION_OJO = 0.05;

/** Interpola linealmente la altura de la cámara entre baldas según la fila (real) actual. */
export function alturaEnFila(alturas: readonly number[], fila: number): number {
  if (alturas.length === 0) return 0;
  const f = Math.min(Math.max(fila, 0), alturas.length - 1);
  const i = Math.floor(f);
  const a = alturas[i] ?? 0;
  const b = alturas[Math.min(i + 1, alturas.length - 1)] ?? a;
  return a + (b - a) * (f - i);
}

/** Configura el lienzo para gestos (sin desplazamiento del navegador) y para el teclado. */
function prepararLienzo(el: HTMLCanvasElement): void {
  el.style.touchAction = 'none';
  el.style.cursor = 'grab';
  el.tabIndex = 0;
  el.setAttribute('role', 'application');
  el.setAttribute(
    'aria-label',
    'Estanterías en 3D. Flechas izquierda y derecha: cambiar de producto. Flechas arriba y abajo: cambiar de balda.',
  );
}

function cursorLienzo(el: HTMLCanvasElement, cursor: 'grab' | 'grabbing'): void {
  el.style.cursor = cursor;
}

export interface RielCamaraProps {
  /** Posiciones x de los productos de cada balda (0 = la más baja). */
  puntos: readonly (readonly number[])[];
  /** Altura del centro de cada balda. */
  alturas: readonly number[];
  esquina?: EsquinaRiel;
  /** Menos movimiento: la cámara salta al destino sin muelle. */
  instantaneo?: boolean;
  /** Con `false` el raíl ignora gestos y teclas (p. ej. mientras hay una ficha abierta). */
  activo?: boolean;
  /** Enter o espacio: el producto que la cámara tiene delante (posición x y balda). */
  onActivar?: (x: number, fila: number) => void;
  inicio?: { x: number; fila: number };
  onMirar?: (x: number, fila: number) => void;
}

/**
 * Cámara sobre raíl: el gesto horizontal la desplaza con inercia y se ajusta a cada producto, el
 * vertical cambia de balda y en escritorio funcionan las flechas y la rueda. No hay cámara libre.
 * Conecta los eventos del lienzo con `ControlRiel` y lo aplica a la cámara en cada fotograma.
 */
export function RielCamara({
  puntos,
  alturas,
  esquina,
  instantaneo = false,
  activo = true,
  onActivar,
  inicio,
  onMirar,
}: RielCamaraProps) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const invalidar = useThree((s) => s.invalidate);

  const control = useMemo(
    () =>
      new ControlRiel({
        puntos,
        instantaneo,
        // Se empieza a la altura de los ojos: la balda del medio si hay tres.
        filaInicial: inicio?.fila ?? Math.min(1, Math.max(0, puntos.length - 1)),
        xInicial: inicio?.x,
      }),
    [puntos, instantaneo, inicio],
  );
  const ultimaMirada = useRef<{ control: ControlRiel; x: number; fila: number } | null>(null);

  useLayoutEffect(() => {
    invalidar();
  }, [control, invalidar]);

  useEffect(() => {
    const el = gl.domElement;
    prepararLienzo(el);

    let puntero: number | null = null;
    let ultimo = { x: 0, y: 0, t: 0 };

    const abajo = (e: PointerEvent) => {
      if (!activo || !e.isPrimary || puntero !== null) return;
      puntero = e.pointerId;
      el.setPointerCapture(e.pointerId);
      cursorLienzo(el, 'grabbing');
      ultimo = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      control.empezarArrastre();
      invalidar();
    };
    const mover = (e: PointerEvent) => {
      if (e.pointerId !== puntero) return;
      const dt = (e.timeStamp - ultimo.t) / 1000;
      control.moverArrastre(e.clientX - ultimo.x, e.clientY - ultimo.y, dt);
      ultimo = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      invalidar();
    };
    const soltar = (e: PointerEvent) => {
      if (e.pointerId !== puntero) return;
      puntero = null;
      cursorLienzo(el, 'grab');
      control.terminarArrastre();
      invalidar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (!activo || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivar?.(control.destinoActual(), control.filaObjetivo);
        return;
      }
      if (control.teclado(e.key)) {
        e.preventDefault();
        invalidar();
      }
    };
    const rueda = (e: WheelEvent) => {
      if (!activo) return;
      e.preventDefault();
      control.rueda(e.deltaX, e.deltaY, e.timeStamp);
      invalidar();
    };

    el.addEventListener('pointerdown', abajo);
    el.addEventListener('pointermove', mover);
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
    el.addEventListener('keydown', tecla);
    // No pasivo: la rueda no debe desplazar la página mientras se recorre el pasillo.
    el.addEventListener('wheel', rueda, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', abajo);
      el.removeEventListener('pointermove', mover);
      el.removeEventListener('pointerup', soltar);
      el.removeEventListener('pointercancel', soltar);
      el.removeEventListener('keydown', tecla);
      el.removeEventListener('wheel', rueda);
    };
  }, [gl, control, invalidar, activo, onActivar]);

  useFrame((_, delta) => {
    const perspectiva = camera as PerspectiveCamera;
    const distancia = distanciaRiel(perspectiva.fov, size.width / size.height);
    control.encuadrar(metrosPorPixel(perspectiva.fov, distancia, size.height));
    control.actualizar(delta);

    const y = alturaEnFila(alturas, control.fila);
    const marco = marcoEnRiel(control.x, esquina);
    camera.position.set(
      marco.x + Math.sin(marco.giro) * distancia,
      y + ELEVACION_OJO,
      marco.z + Math.cos(marco.giro) * distancia,
    );
    camera.lookAt(marco.x, y, marco.z);
    if (control.enMovimiento()) invalidar();
    const fila = Math.round(control.fila);
    const x = puntoMasCercano(control.puntosDe(fila), control.x);
    if (
      activo &&
      (ultimaMirada.current?.control !== control ||
        ultimaMirada.current.x !== x ||
        ultimaMirada.current.fila !== fila)
    ) {
      ultimaMirada.current = { control, x, fila };
      onMirar?.(x, fila);
    }
  });

  return null;
}
