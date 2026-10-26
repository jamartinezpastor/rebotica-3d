import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import type * as ModuloCapacidad from '../src/escena/capacidad';
import type { EscenaProps } from '../src/escena/Escena';
import {
  catalogoComparacion,
  fichaComparacion,
  productosComparacion,
} from './fixtures/comparacion';
vi.mock('../src/escena/capacidad', async (original) => ({
  ...(await original<typeof ModuloCapacidad>()),
  detectarDispositivo: () => ({ webgl: true }),
  evaluarCapacidad: () => ({ nivel: 'alto', motivos: [] }),
}));
vi.mock('../src/escena/Escena', () => ({
  default: ({ baldas = [], onSeleccionar }: EscenaProps) => (
    <div data-testid="escena-comparacion">
      {baldas
        .flatMap((b) => b.productos)
        .map((p) => (
          <button key={p.nregistro} onClick={() => onSeleccionar?.(p)}>
            {p.nombre}
          </button>
        ))}
    </div>
  ),
}));
const mostrar = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const cerrar = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
      this.querySelector<HTMLButtonElement>('button')?.focus();
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
});
afterAll(() => {
  if (mostrar) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', mostrar);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (cerrar) Object.defineProperty(HTMLDialogElement.prototype, 'close', cerrar);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
  window.localStorage.clear();
});
function preparar() {
  window.history.replaceState(null, '', '/escena?vista=lista');
  const peticiones = vi.fn(async (url: RequestInfo | URL) => {
    if (url === '/api/catalogo') return Response.json(catalogoComparacion);
    const p = productosComparacion.find((p) => String(url) === `/api/productos/${p.nregistro}`);
    return p ? Response.json(fichaComparacion(p)) : new Response('', { status: 404 });
  });
  vi.stubGlobal('fetch', peticiones);
  return peticiones;
}
async function volver() {
  fireEvent.click(screen.getByRole('button', { name: 'Volver al pasillo' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}
describe('selección y comparación desde el catálogo', () => {
  it('elige dos fichas entre páginas y vistas, mantiene receta y posición, y permite quitar y sustituir sin seleccionar un tercero', async () => {
    const peticiones = preparar();
    const { container } = render(<App />);
    await screen.findByText('1–36 de 80');
    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-registro="demo-1"]')!);
    await screen.findByText('Indicación oficial ficticia de demo-1.');
    fireEvent.click(screen.getByRole('button', { name: 'Añadir a comparación' }));
    expect(
      screen.getByRole('button', { name: 'Quitar de comparación' }).getAttribute('aria-pressed'),
    ).toBe('true');
    await volver();
    expect(screen.getByRole('button', { name: 'Comparar medicamentos' })).toHaveProperty(
      'disabled',
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-registro="demo-76"]')!);
    await screen.findByText('Indicación oficial ficticia de demo-76.');
    fireEvent.click(screen.getByRole('button', { name: 'Añadir a comparación' }));
    await volver();
    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-registro="demo-75"]')!);
    await screen.findByText('Indicación oficial ficticia de demo-75.');
    expect(screen.getByRole('button', { name: 'Comparación completa' })).toHaveProperty(
      'disabled',
      true,
    );
    await volver();
    fireEvent.click(screen.getByRole('button', { name: 'Ver en 3D' }));
    await screen.findByTestId('escena-comparacion');
    const boton = screen.getByRole('button', { name: 'Comparar medicamentos' });
    boton.focus();
    fireEvent.click(boton);
    const modal = await screen.findByRole('dialog', { name: 'Comparación de medicamentos' });
    await within(modal).findByText('Laboratorio oficial ficticio demo-76');
    expect(
      within(modal).getByRole('region', {
        name: `Ficha comparada de ${productosComparacion[0]!.nombre}`,
      }),
    ).toBeTruthy();
    expect(
      within(modal).getByRole('region', {
        name: `Ficha comparada de ${productosComparacion[75]!.nombre}`,
      }),
    ).toBeTruthy();
    expect(within(modal).getByText(/Requiere receta médica/)).toBeTruthy();
    expect(within(modal).queryByText('Laboratorio oficial ficticio demo-75')).toBeNull();
    fireEvent.click(within(modal).getByRole('button', { name: 'Volver al catálogo' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(boton);
    expect(screen.getByText('73–80 de 80')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver como lista' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Agrupar por' }), {
      target: { value: 'forma' },
    });
    expect(screen.getByRole('button', { name: 'Comparar medicamentos' })).toHaveProperty(
      'disabled',
      false,
    );
    fireEvent.click(screen.getByText(/Comparación \(2\/2\)/, { selector: 'summary' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: `Quitar ${productosComparacion[0]!.nombre} de la comparación`,
      }),
    );
    expect(screen.getByRole('button', { name: 'Comparar medicamentos' })).toHaveProperty(
      'disabled',
      true,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: `Quitar ${productosComparacion[75]!.nombre} de la comparación`,
      }),
    );
    expect(screen.queryByRole('button', { name: 'Comparar medicamentos' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Agrupar por' }));
    expect(window.localStorage.length).toBe(1);
    expect(window.localStorage.key(0)).toBe('rebotica.vista');
    expect(window.location.search).not.toContain('demo-');
    expect(
      peticiones.mock.calls.every(
        ([url]) => url === '/api/catalogo' || String(url).startsWith('/api/productos/'),
      ),
    ).toBe(true);
  });
  it('borra la selección de comparación al abandonar la página, incluida la restauración de bfcache', async () => {
    preparar();
    const { container } = render(<App />);
    await screen.findByText('1–36 de 80');
    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-registro="demo-1"]')!);
    await screen.findByText('Indicación oficial ficticia de demo-1.');
    fireEvent.click(screen.getByRole('button', { name: 'Añadir a comparación' }));
    await volver();
    expect(screen.getByRole('button', { name: 'Comparar medicamentos' })).toBeTruthy();
    fireEvent(window, new Event('pagehide'));
    expect(screen.queryByRole('button', { name: 'Comparar medicamentos' })).toBeNull();
    const restaurado = new Event('pageshow');
    Object.defineProperty(restaurado, 'persisted', { value: true });
    fireEvent(window, restaurado);
    expect(screen.queryByRole('button', { name: 'Comparar medicamentos' })).toBeNull();
  });
});
