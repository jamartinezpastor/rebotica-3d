import { StrictMode } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CacheRecursos } from '../src/escena/cacheRecursos';
import { RecursosEscena, useRecurso } from '../src/escena/RecursosEscena';
afterEach(cleanup);
describe('vida de los recursos gráficos compartidos', () => {
  it('comparte recursos y solo libera al salir su último usuario', async () => {
    const cache = new CacheRecursos();
    const liberar = vi.fn();
    const crear = vi.fn(() => ({ liberar }));
    const primero = cache.obtener('caja', crear);
    cache.retener('caja');
    expect(cache.obtener('caja', crear)).toBe(primero);
    cache.retener('caja');
    cache.soltar('caja');
    await Promise.resolve();
    expect(liberar).not.toHaveBeenCalled();
    cache.soltar('caja');
    await Promise.resolve();
    expect(liberar).toHaveBeenCalledTimes(1);
    expect(cache.obtener('caja', crear)).not.toBe(primero);
    expect(crear).toHaveBeenCalledTimes(2);
  });
  it('recuperar el mismo recurso antes del siguiente microtask no usa un recurso liberado', async () => {
    const cache = new CacheRecursos();
    const liberar = vi.fn();
    const crear = () => ({ liberar });
    const original = cache.obtener('forma', crear);
    cache.retener('forma');
    cache.soltar('forma');
    expect(cache.obtener('forma', crear)).toBe(original);
    cache.retener('forma');
    await Promise.resolve();
    expect(liberar).not.toHaveBeenCalled();
    cache.liberar();
    expect(liberar).toHaveBeenCalledTimes(1);
  });
  it('libera también recursos de un render abandonado y no vuelve a liberar en limpiezas tardías', async () => {
    const cache = new CacheRecursos();
    const liberar = vi.fn();
    cache.obtener('pendiente', () => ({ liberar }));
    cache.liberar();
    cache.soltar('pendiente');
    cache.liberar();
    await Promise.resolve();
    expect(liberar).toHaveBeenCalledTimes(1);
  });
  it('StrictMode mantiene recursos válidos entre sus dos montajes y limpia al salir', async () => {
    const liberar = vi.fn();
    const crear = vi.fn(() => ({ liberar }));
    function Pieza() {
      useRecurso('compartida', crear);
      return null;
    }
    const { unmount, rerender } = render(
      <StrictMode>
        <RecursosEscena>
          <Pieza />
          <Pieza />
        </RecursosEscena>
      </StrictMode>,
    );
    await Promise.resolve();
    expect(crear).toHaveBeenCalledTimes(1);
    expect(liberar).not.toHaveBeenCalled();
    rerender(
      <StrictMode>
        <RecursosEscena>
          <Pieza />
        </RecursosEscena>
      </StrictMode>,
    );
    await Promise.resolve();
    expect(liberar).not.toHaveBeenCalled();
    unmount();
    await Promise.resolve();
    expect(liberar).toHaveBeenCalledTimes(1);
  });
});
