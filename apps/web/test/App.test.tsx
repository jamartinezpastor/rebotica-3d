import { AVISO_LEGAL } from '@rebotica/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubFetch(respuesta: Promise<Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => respuesta),
  );
}

describe('App', () => {
  it('muestra el nombre y el aviso legal', () => {
    stubFetch(new Promise(() => {}));
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Rebotica 3D' })).toBeTruthy();
    expect(screen.getByText(AVISO_LEGAL)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Explorar demostración 3D' }).getAttribute('href'),
    ).toBe('/escena?vitrina=1&vista=3d');
    expect(screen.getByRole('link', { name: 'Explorar como lista' }).getAttribute('href')).toBe(
      '/escena?vitrina=1&vista=lista',
    );
    expect(screen.getByText(/utiliza productos ficticios/)).toBeTruthy();
    expect(screen.queryByText(/Pronto podrás|en construcción/i)).toBeNull();
  });

  it('indica que el servidor está en marcha', async () => {
    stubFetch(
      Promise.resolve(
        Response.json({ status: 'ok', version: '0.1.0', time: new Date().toISOString() }),
      ),
    );
    render(<App />);
    expect(await screen.findByText('Servidor en marcha · v0.1.0')).toBeTruthy();
  });

  it('avisa si el servidor no responde', async () => {
    stubFetch(Promise.resolve(new Response('', { status: 503 })));
    render(<App />);
    expect(await screen.findByText('Servidor sin conexión')).toBeTruthy();
  });
});
