import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as ModuloCapacidad from '../src/escena/capacidad';
import type { EscenaProps } from '../src/escena/Escena';
import type { PasilloResponse } from '@rebotica/shared';
import { App } from '../src/App';
import { productosDemo } from '../src/escena/demo';

vi.mock('../src/escena/capacidad', async (original) => ({
  ...(await original<typeof ModuloCapacidad>()),
  detectarDispositivo: () => ({ webgl: true }),
  evaluarCapacidad: () => ({ nivel: 'alto', motivos: [] }),
}));
vi.mock('../src/escena/Escena', () => ({
  default: ({ baldas = [], registroInicial, onMirar }: EscenaProps) => (
    <div data-testid="escena-prueba" data-inicial={registroInicial}>
      {baldas
        .flatMap((b) => b.productos)
        .map((p) => (
          <button key={p.nregistro} onClick={() => onMirar?.(p.nregistro)}>
            Mirar {p.nombre}
          </button>
        ))}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
  window.localStorage.clear();
});

function preparar(consulta = false) {
  window.history.replaceState(null, '', `/escena?vista=lista${consulta ? '&pasillo=prueba' : ''}`);
  const productos = productosDemo(80);
  const peticiones = vi.fn(async () =>
    Response.json({
      id: consulta ? 'prueba' : 'catalogo',
      version: 1,
      titulo: 'Catálogo de prueba',
      estado: 'informativo',
      baldas: [
        {
          titulo: 'Grupo ficticio',
          principioActivo: 'principio ficticio',
          orden: 1,
          productos: productos.slice(0, 75),
        },
      ],
      vitrina: [
        {
          principioActivo: 'principio ficticio',
          formas: ['COMPRIMIDO'],
          paraQueSeUsa: 'Indicación ficticia',
          porQueNecesitaReceta: 'Precaución ficticia',
          situacion: 'Situación ficticia',
          productos: productos.slice(75).map((p) => ({ ...p, receta: true })),
        },
      ],
      ocultasPorPerfil: 0,
      consejos: [],
      parafarmacia: [],
    } satisfies PasilloResponse),
  );
  vi.stubGlobal('fetch', peticiones);
  return { productos, peticiones };
}
const abrirFiltros = () => fireEvent.click(screen.getByText('Filtros', { selector: 'summary' }));
describe('exploración con búsqueda y posición conservada', () => {
  it('salta al inicio de un grupo en otra página, conserva la búsqueda y llega al mismo producto en 3D', async () => {
    preparar();
    render(<App />);
    await screen.findByText('1–36 de 80');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'demostracion' } });
    fireEvent.click(screen.getByText('Grupos', { selector: 'summary' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Ir a grupo' }), {
      target: { value: 'demo-76' },
    });
    expect(screen.getByText('73–80 de 80')).toBeTruthy();
    expect(document.activeElement?.getAttribute('data-registro')).toBe('demo-76');
    expect(screen.getByRole('searchbox')).toHaveProperty('value', 'demostracion');
    // En jsdom no hay geometría de layout: simulamos el producto visible tras el salto.
    vi.spyOn(document.activeElement!, 'getBoundingClientRect').mockReturnValue({
      top: 300,
      bottom: 400,
    } as DOMRect);
    fireEvent.click(screen.getByRole('button', { name: 'Ver en 3D' }));
    expect((await screen.findByTestId('escena-prueba')).dataset.inicial).toBe('demo-76');
  });
  it('busca en todas las páginas, combina filtros y quitar filtros devuelve el catálogo completo', async () => {
    const { peticiones } = preparar();
    const { container } = render(<App />);
    await screen.findByText('1–36 de 80');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    const input = screen.getByRole('searchbox', { name: 'Buscar medicamentos' });
    input.focus();
    fireEvent.change(input, { target: { value: 'demostracion 80' } });
    expect(document.activeElement).toBe(input);
    expect(screen.getByText('1 de 80 medicamentos')).toBeTruthy();
    expect(container.querySelectorAll('[data-registro]')).toHaveLength(1);
    expect(container.querySelector('[data-registro="demo-80"]')).toBeTruthy();
    expect(screen.getAllByText(/Requiere receta/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    expect(screen.getByText('1–36 de 80')).toBeTruthy();
    abrirFiltros();
    fireEvent.change(screen.getByRole('combobox', { name: 'Forma farmacéutica' }), {
      target: { value: 'JARABE' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Laboratorio' }), {
      target: { value: 'Laboratorio ficticio B' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Identificación EFG' }), {
      target: { value: 'si' },
    });
    expect(screen.getByText('1 de 80 medicamentos')).toBeTruthy();
    expect(container.querySelector('[data-registro="demo-22"]')).toBeTruthy();
    expect(peticiones).toHaveBeenCalledTimes(1);
    expect(window.location.search).not.toMatch(/filtro|texto|demostracion/);
    expect(window.localStorage.length).toBe(0);
  });
  it('mantiene el foco al escribir una búsqueda vacía y recuperar resultados', async () => {
    preparar();
    render(<App />);
    await screen.findByText('1–36 de 80');
    const input = screen.getByRole('searchbox');
    input.focus();
    fireEvent.change(input, { target: { value: 'inexistente' } });
    expect(screen.getByText('No hay medicamentos que coincidan con estos filtros.')).toBeTruthy();
    fireEvent.change(input, { target: { value: 'demostracion' } });
    expect(document.activeElement).toBe(input);
    expect(screen.getByText('80 de 80 medicamentos')).toBeTruthy();
  });
  it('lleva a 3D el producto visible de una consulta larga y restaura el desplazamiento exacto al volver', async () => {
    preparar(true);
    let scroll = 900;
    vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scroll);
    const desplazar = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation((opciones: ScrollToOptions | number) => {
        if (typeof opciones === 'object') scroll = opciones.top ?? 0;
      });
    const { container } = render(<App />);
    await screen.findByRole('heading', { name: 'Catálogo de prueba' });
    const objetivo = container.querySelector<HTMLButtonElement>('[data-registro="demo-60"]')!;
    vi.spyOn(objetivo, 'getBoundingClientRect').mockReturnValue({
      top: 350,
      bottom: 430,
    } as DOMRect);
    fireEvent.click(screen.getByRole('button', { name: 'Ver en 3D' }));
    expect((await screen.findByTestId('escena-prueba')).dataset.inicial).toBe('demo-60');
    expect(screen.getByText('37–72 de 80')).toBeTruthy();
    expect(desplazar).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
    fireEvent.click(screen.getByRole('button', { name: 'Ver como lista' }));
    expect(container.querySelectorAll('[data-registro]')).toHaveLength(80);
    expect(document.activeElement?.getAttribute('data-registro')).toBe('demo-60');
    expect(scroll).toBe(900);
  });
  it('vuelve al nuevo producto recorrido en 3D y mantiene los filtros elegidos', async () => {
    preparar();
    const { container } = render(<App />);
    await screen.findByText('1–36 de 80');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'demostracion' } });
    abrirFiltros();
    fireEvent.change(screen.getByRole('combobox', { name: 'Forma farmacéutica' }), {
      target: { value: 'JARABE' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ver en 3D' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Mirar PRODUCTO DE DEMOSTRACIÓN 62' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ver como lista' }));
    expect(document.activeElement?.getAttribute('data-registro')).toBe('demo-62');
    expect(screen.getByRole('searchbox')).toHaveProperty('value', 'demostracion');
    expect(container.querySelectorAll('[data-registro]')).toHaveLength(16);
  });
  it('abrir y cerrar una ficha conserva el filtro, la página, el foco y el desplazamiento', async () => {
    preparar();
    let scroll = 500;
    vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scroll);
    vi.spyOn(window, 'scrollTo').mockImplementation((opciones: ScrollToOptions | number) => {
      if (typeof opciones === 'object') scroll = opciones.top ?? 0;
    });
    const { container } = render(<App />);
    await screen.findByText('1–36 de 80');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'demostracion' } });
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    scroll = 800;
    const objetivo = container.querySelector<HTMLButtonElement>('[data-registro="demo-60"]')!;
    fireEvent.click(objetivo);
    await screen.findByRole('dialog');
    scroll = 0;
    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(document.activeElement).toBe(objetivo);
    expect(scroll).toBe(800);
    expect(screen.getByText('37–72 de 80')).toBeTruthy();
    expect(screen.getByRole('searchbox')).toHaveProperty('value', 'demostracion');
  });
});
