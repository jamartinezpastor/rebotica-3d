import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
describe('exploración por grupos y posición conservada', () => {
  it('salta al inicio de un grupo en otra página y llega al mismo producto en 3D', async () => {
    preparar();
    render(<App />);
    await screen.findByText('1–36 de 80');
    fireEvent.click(screen.getByText('Grupos', { selector: 'summary' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Ir a grupo' }), {
      target: { value: 'demo-76' },
    });
    expect(screen.getByText('73–80 de 80')).toBeTruthy();
    expect(document.activeElement?.getAttribute('data-registro')).toBe('demo-76');
    vi.spyOn(document.activeElement!, 'getBoundingClientRect').mockReturnValue({
      top: 300,
      bottom: 400,
    } as DOMRect);
    fireEvent.click(screen.getByRole('button', { name: 'Ver en 3D' }));
    expect((await screen.findByTestId('escena-prueba')).dataset.inicial).toBe('demo-76');
  });
  it('muestra todos los productos al agrupar, sin buscador ni filtros que oculten resultados', async () => {
    const { peticiones } = preparar();
    const { container } = render(<App />);
    await screen.findByText('1–36 de 80');
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByText('Filtros')).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Agrupar por' }), {
      target: { value: 'forma' },
    });
    const registros = new Set<string>();
    for (let pagina = 0; pagina < 3; pagina++) {
      for (const el of container.querySelectorAll<HTMLElement>('[data-registro]'))
        registros.add(el.dataset.registro!);
      if (pagina < 2) fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    }
    expect(registros.size).toBe(80);
    expect(registros.has('demo-80')).toBe(true);
    expect(screen.getAllByText(/Requiere receta/).length).toBeGreaterThan(0);
    expect(peticiones).toHaveBeenCalledTimes(1);
    expect(window.localStorage.length).toBe(0);
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
  it('vuelve al nuevo producto recorrido en 3D y mantiene la agrupación elegida', async () => {
    const { productos } = preparar(true);
    const { container } = render(<App />);
    await screen.findByRole('heading', { name: 'Catálogo de prueba' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Agrupar por' }), {
      target: { value: 'forma' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ver en 3D' }));
    const escena = await screen.findByTestId('escena-prueba');
    const destino = within(escena).getAllByRole('button').at(-1)!;
    const registro = productos.find((p) => `Mirar ${p.nombre}` === destino.textContent)!.nregistro;
    fireEvent.click(destino);
    fireEvent.click(screen.getByRole('button', { name: 'Ver como lista' }));
    expect(document.activeElement?.getAttribute('data-registro')).toBe(registro);
    expect(screen.getByRole('combobox', { name: 'Agrupar por' })).toHaveProperty('value', 'forma');
    expect(container.querySelectorAll('[data-registro]')).toHaveLength(80);
  });
  it('abrir y cerrar una ficha conserva la página, el foco y el desplazamiento', async () => {
    preparar();
    let scroll = 500;
    vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scroll);
    vi.spyOn(window, 'scrollTo').mockImplementation((opciones: ScrollToOptions | number) => {
      if (typeof opciones === 'object') scroll = opciones.top ?? 0;
    });
    const { container } = render(<App />);
    await screen.findByText('1–36 de 80');
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
  });
});
