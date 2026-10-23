import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import type { ProductoResumen } from '@rebotica/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { useSeleccion } from '../src/escena/useSeleccion';

const producto = (n: string): ProductoResumen => ({
  receta: false,
  nregistro: n,
  nombre: `Producto ${n}`,
  principioActivo: 'principio ficticio',
  forma: null,
  formaCaja: 'caja-plana',
  dosis: null,
  categoria: 'Categoría ficticia',
  laboratorio: 'Laboratorio ficticio',
  generico: false,
  conduccion: false,
  asset: null,
  calculadora: false,
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '');
});

describe('useSeleccion', () => {
  it('restaura el producto al volver aunque el fondo inerte haya perdido el foco', () => {
    render(<button type="button">Producto de origen</button>);
    const origen = screen.getByRole('button');
    const { result } = renderHook(useSeleccion);
    origen.focus();
    act(() => result.current.seleccionar(producto('1')));
    origen.blur();
    expect(document.activeElement).not.toBe(origen);
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(document.activeElement).toBe(origen);
  });

  it('seleccionar abre la ficha y añade una entrada al historial', () => {
    const { result } = renderHook(() => useSeleccion());
    const antes = window.history.length;
    act(() => result.current.seleccionar(producto('1')));
    expect(result.current.producto?.nregistro).toBe('1');
    expect(window.history.length).toBe(antes + 1);
    expect(window.history.state).toEqual({ ficha: '1' });
  });

  it('con la ficha abierta, otro toque no cambia de producto', () => {
    const { result } = renderHook(() => useSeleccion());
    act(() => result.current.seleccionar(producto('1')));
    act(() => result.current.seleccionar(producto('2')));
    expect(result.current.producto?.nregistro).toBe('1');
  });

  it('el botón atrás del navegador cierra la ficha', () => {
    const { result } = renderHook(() => useSeleccion());
    act(() => result.current.seleccionar(producto('1')));
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current.producto).toBeNull();
  });

  it('Escape cierra la ficha', () => {
    const { result } = renderHook(() => useSeleccion());
    act(() => result.current.seleccionar(producto('1')));
    // Sin entrada de historial propia (p. ej. tras recargar) se cierra directamente.
    window.history.replaceState(null, '');
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.producto).toBeNull();
  });

  it('volver sin entrada de historial cierra la ficha', () => {
    const { result } = renderHook(() => useSeleccion());
    act(() => result.current.seleccionar(producto('1')));
    window.history.replaceState(null, '');
    act(() => result.current.volver());
    expect(result.current.producto).toBeNull();
  });

  it('otras teclas no cierran la ficha', () => {
    const { result } = renderHook(() => useSeleccion());
    act(() => result.current.seleccionar(producto('1')));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });
    expect(result.current.producto?.nregistro).toBe('1');
  });
});
