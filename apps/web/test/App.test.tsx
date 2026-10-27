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
    expect(screen.getByRole('heading', { name: 'REBOTICA' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Cuéntanos qué te pasa' })).toBeTruthy();
    expect(screen.getByText(AVISO_LEGAL)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Explorar medicamentos' }).getAttribute('href')).toBe(
      '/escena?vista=3d',
    );
    expect(screen.queryByRole('link', { name: 'Explorar como lista' })).toBeNull();
    expect(screen.queryByText(/utiliza productos ficticios/)).toBeNull();
    expect(screen.queryByText('Hola, ¿qué te pasa?')).toBeNull();
    expect(screen.queryByText('Explora la demostración')).toBeNull();
    expect(screen.queryByText(/Al realizar la consulta, el texto se envía a Gemini/)).toBeNull();
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
