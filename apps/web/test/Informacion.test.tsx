import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import type { InformacionPublica } from '@rebotica/shared';
const datos: InformacionPublica = {
  versionApp: 'prueba-1',
  versionMotorDosis: 'motor-prueba',
  versionCorrespondencias: 1,
  interpretacionConfigurada: true,
  catalogo: {
    estado: 'parcial',
    total: 4,
    sinReceta: 3,
    conReceta: 1,
    conIndicaciones: 3,
    sinIndicaciones: 1,
    cargaPendiente: true,
    cargaPendienteDesde: '2026-01-01T00:00:00.000Z',
    sincronizadoHasta: null,
  },
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});
it('accede directamente a privacidad sin enviar consultas y muestra versiones y estado verificados', async () => {
  window.history.replaceState(null, '', '/informacion');
  const peticiones = vi.fn(async () => Response.json(datos));
  vi.stubGlobal('fetch', peticiones);
  render(<App />);
  const titulo = await screen.findByRole('heading', { name: 'Privacidad y fuentes' });
  expect(document.activeElement).toBe(titulo);
  expect(await screen.findByText('motor-prueba')).toBeTruthy();
  expect(screen.getByText('Versión 1')).toBeTruthy();
  expect(screen.getByText('Copia parcial · resultados provisionales')).toBeTruthy();
  expect(screen.getByText(/solo su identificador/)).toBeTruthy();
  expect(screen.getByText(/no significa que Google lo borre inmediatamente/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'condiciones de Gemini API' }).getAttribute('href')).toBe(
    'https://ai.google.dev/gemini-api/terms',
  );
  expect(peticiones).toHaveBeenCalledTimes(1);
  expect(peticiones).toHaveBeenCalledWith(
    '/api/informacion',
    expect.objectContaining({ cache: 'no-store' }),
  );
  expect(screen.queryByRole('textbox')).toBeNull();
});
it('un fallo de metadatos no impide leer la información ni inventa versiones', async () => {
  window.history.replaceState(null, '', '/informacion');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('', { status: 503 })),
  );
  render(<App />);
  expect(await screen.findByText(/No se pueden consultar ahora las versiones/)).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Datos y almacenamiento' })).toBeTruthy();
  expect(screen.queryByText('motor-prueba')).toBeNull();
});
it('un contrato incorrecto se trata como información no disponible', async () => {
  window.history.replaceState(null, '', '/informacion');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({ ...datos, versionCorrespondencias: 900, apiKey: 'NO_PUBLICAR' }),
    ),
  );
  render(<App />);
  await screen.findByText(/No se pueden consultar ahora las versiones/);
  expect(screen.queryByText('NO_PUBLICAR')).toBeNull();
});
it('la portada mantiene solo un enlace discreto sin reintroducir avisos sobre el input', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({ status: 'ok', version: 'prueba', time: new Date().toISOString() }),
    ),
  );
  render(<App />);
  await screen.findByText(/Servidor en marcha/);
  expect(screen.getByRole('link', { name: 'Privacidad y fuentes' }).getAttribute('href')).toBe(
    '/informacion',
  );
  expect(screen.queryByText(/Al realizar la consulta, el texto se envía/)).toBeNull();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Texto ficticio' } });
  expect(screen.getByRole('button', { name: 'Realizar consulta' })).toBeTruthy();
});
