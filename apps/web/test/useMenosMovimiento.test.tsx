import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useMenosMovimiento } from '../src/useMenosMovimiento';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('aplica y escucha la preferencia de movimiento reducido sin recargar la escena', () => {
  const cambios = new EventTarget();
  const medio = {
    matches: false,
    addEventListener: cambios.addEventListener.bind(cambios),
    removeEventListener: cambios.removeEventListener.bind(cambios),
  };
  const quitar = vi.spyOn(medio, 'removeEventListener');
  vi.stubGlobal('matchMedia', () => medio);
  const { result, unmount } = renderHook(useMenosMovimiento);
  expect(result.current).toBe(false);
  act(() => {
    medio.matches = true;
    cambios.dispatchEvent(new Event('change'));
  });
  expect(result.current).toBe(true);
  act(() => {
    medio.matches = false;
    cambios.dispatchEvent(new Event('change'));
  });
  expect(result.current).toBe(false);
  unmount();
  expect(quitar).toHaveBeenCalledWith('change', expect.any(Function));
});
