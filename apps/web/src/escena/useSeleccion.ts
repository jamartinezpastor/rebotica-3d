import type { ProductoResumen } from '@rebotica/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface Seleccion {
  producto: ProductoResumen | null;
  seleccionar: (producto: ProductoResumen) => void;
  volver: () => void;
}

/**
 * Producto abierto en la ficha. Abrirlo añade una entrada al historial, de modo que el botón
 * «atrás» del navegador (o del móvil) cierra la ficha y no abandona la página; Escape también.
 */
export function useSeleccion(): Seleccion {
  const [producto, setProducto] = useState<ProductoResumen | null>(null);
  const origen = useRef<HTMLElement | null>(null);
  const desplazamiento = useRef(0);

  useLayoutEffect(() => {
    // Tras retirar `inert` del fondo, vuelve al producto que abrió la ficha.
    if (!producto) {
      if (origen.current?.isConnected) {
        origen.current.focus({ preventScroll: true });
        if (window.scrollY !== desplazamiento.current)
          window.scrollTo({ top: desplazamiento.current, behavior: 'instant' });
      }
      origen.current = null;
    }
  }, [producto]);

  const seleccionar = useCallback((p: ProductoResumen) => {
    if (!origen.current) desplazamiento.current = window.scrollY;
    if (!origen.current && document.activeElement instanceof HTMLElement)
      origen.current = document.activeElement;
    setProducto((actual) => {
      if (actual) return actual;
      window.history.pushState({ ficha: p.nregistro }, '');
      return p;
    });
  }, []);

  const volver = useCallback(() => {
    const state: unknown = window.history.state;
    const hayEntrada = typeof state === 'object' && state !== null && 'ficha' in state;
    // Con entrada propia, `popstate` cierra la ficha; sin ella (p. ej. recarga) se cierra aquí.
    if (hayEntrada) window.history.back();
    else setProducto(null);
  }, []);

  useEffect(() => {
    const alAtras = () => setProducto(null);
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && producto) volver();
    };
    window.addEventListener('popstate', alAtras);
    window.addEventListener('keydown', alTeclear);
    return () => {
      window.removeEventListener('popstate', alAtras);
      window.removeEventListener('keydown', alTeclear);
    };
  }, [volver, producto]);

  return { producto, seleccionar, volver };
}
