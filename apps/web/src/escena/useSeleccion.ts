import type { ProductoResumen } from '@rebotica/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

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

  useEffect(() => {
    // Tras retirar `inert` del fondo, vuelve al producto que abrió la ficha.
    if (!producto) {
      if (origen.current?.isConnected) origen.current.focus();
      origen.current = null;
    }
  }, [producto]);

  const seleccionar = useCallback((p: ProductoResumen) => {
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
      if (e.key === 'Escape') volver();
    };
    window.addEventListener('popstate', alAtras);
    window.addEventListener('keydown', alTeclear);
    return () => {
      window.removeEventListener('popstate', alAtras);
      window.removeEventListener('keydown', alTeclear);
    };
  }, [volver]);

  return { producto, seleccionar, volver };
}
