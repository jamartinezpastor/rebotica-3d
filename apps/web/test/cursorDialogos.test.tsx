import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CursorPunto } from '../src/CursorPunto';
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((consulta: string) => ({
      matches: !consulta.includes('forced-colors'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});
afterEach(() => {
  cleanup();
  document.querySelectorAll('dialog').forEach((el) => el.remove());
  vi.unstubAllGlobals();
});
describe('cursor en diálogos de la capa superior', () => {
  it('acompaña a la comparación y a su foto y vuelve al catálogo al cerrar o desmontar el diálogo', async () => {
    const comparacion = document.createElement('dialog');
    const foto = document.createElement('dialog');
    comparacion.append(foto);
    document.body.append(comparacion);
    const { container } = render(<CursorPunto />);
    expect(container.querySelector('.cursor-punto')).toBeTruthy();
    act(() => {
      comparacion.open = true;
    });
    await waitFor(() =>
      expect(document.querySelector('.cursor-punto')?.parentElement).toBe(comparacion),
    );
    act(() => {
      foto.open = true;
    });
    await waitFor(() => expect(document.querySelector('.cursor-punto')?.parentElement).toBe(foto));
    act(() => {
      foto.open = false;
    });
    await waitFor(() =>
      expect(document.querySelector('.cursor-punto')?.parentElement).toBe(comparacion),
    );
    act(() => {
      comparacion.remove();
    });
    await waitFor(() => expect(container.querySelector('.cursor-punto')).toBeTruthy());
    expect(document.querySelectorAll('.cursor-punto')).toHaveLength(1);
  });
  it('retira el cursor y sus efectos al desmontar mientras hay un diálogo abierto', async () => {
    const dialogo = document.createElement('dialog');
    dialogo.open = true;
    document.body.append(dialogo);
    const { unmount } = render(<CursorPunto />);
    await waitFor(() => expect(dialogo.querySelector('.cursor-punto')).toBeTruthy());
    unmount();
    expect(document.querySelector('.cursor-punto')).toBeNull();
    expect(document.documentElement.classList.contains('cursor-punto-activo')).toBe(false);
  });
});
