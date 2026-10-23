import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BaldaEscena } from '../src/escena/Pasillo';
import type * as ModuloCapacidad from '../src/escena/capacidad';
import { App } from '../src/App';
import { productosDemo } from '../src/escena/demo';

vi.mock('../src/escena/capacidad', async (original) => ({
  ...(await original<typeof ModuloCapacidad>()),
  detectarDispositivo: () => ({ webgl: true }),
  evaluarCapacidad: () => ({ nivel: 'alto', motivos: [] }),
}));
vi.mock('../src/escena/Escena', () => ({
  default: ({ baldas }: { baldas: BaldaEscena[] }) => (
    <div data-testid="escena-3d">
      {baldas.map((b, i) => (
        <section key={i}>
          <h2>{b.titulo}</h2>
          {b.productos.map((p) => (
            <p key={p.nregistro} data-testid="caja-3d">
              {p.nombre}
            </p>
          ))}
        </section>
      ))}
    </div>
  ),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
  window.localStorage.clear();
});

describe('exploración agrupada', () => {
  it('el catálogo general limita las cajas simultáneas y permite recorrer todos los registros', async () => {
    window.history.replaceState(null, '', '/escena?vista=3d');
    const productos = productosDemo(80);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          id: 'catalogo',
          version: 1,
          titulo: 'Catálogo de medicamentos',
          estado: 'informativo',
          baldas: [
            { titulo: 'Grupo de prueba', principioActivo: 'Activo de prueba', orden: 1, productos },
          ],
          vitrina: [],
          ocultasPorPerfil: 0,
          consejos: [],
          parafarmacia: [],
        }),
      ),
    );
    render(<App />);
    await screen.findByRole('button', { name: 'Siguiente' });
    const escena = await screen.findByTestId('escena-3d');
    expect(within(escena).getAllByTestId('caja-3d')).toHaveLength(36);
    expect(screen.getByText('1–36 de 80')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('37–72 de 80')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('73–80 de 80')).toBeTruthy();
    expect(screen.getAllByTestId('caja-3d')).toHaveLength(8);
    expect((screen.getByRole('button', { name: 'Siguiente' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ver como lista' }));
    expect(screen.getAllByRole('button', { name: /PRODUCTO/ })).toHaveLength(8);
    fireEvent.change(screen.getByRole('combobox', { name: 'Agrupar por' }), {
      target: { value: 'laboratorio' },
    });
    expect(screen.getByText('1–36 de 80')).toBeTruthy();
  });

  it('la entrada pública y su URL anterior cargan el catálogo de API y no la demo', async () => {
    window.history.replaceState(null, '', '/escena?vitrina=1&vista=lista');
    const producto = {
      receta: false,
      nregistro: 'CIMA123',
      nombre: 'Medicamento importado de prueba',
      principioActivo: 'Activo de prueba',
      forma: null,
      formaCaja: 'caja-plana',
      dosis: null,
      categoria: null,
      laboratorio: null,
      generico: false,
      conduccion: false,
      asset: null,
      calculadora: false,
    };
    const peticiones = vi.fn(async () =>
      Response.json({
        id: 'catalogo',
        version: 1,
        titulo: 'Catálogo de medicamentos',
        estado: 'informativo',
        baldas: [
          {
            titulo: 'Activo de prueba',
            principioActivo: 'Activo de prueba',
            orden: 1,
            productos: [producto],
          },
        ],
        vitrina: [],
        ocultasPorPerfil: 0,
        consejos: [],
        parafarmacia: [],
      }),
    );
    vi.stubGlobal('fetch', peticiones);
    render(<App />);
    expect(screen.queryByText(/PRODUCTO FICTICIO/)).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Catálogo de medicamentos' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Medicamento importado de prueba/ })).toBeTruthy();
    expect(peticiones).toHaveBeenCalledWith(
      '/api/catalogo',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.queryByText(/Demostración: pendiente/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver en 3D' }));
    expect(await screen.findByTestId('caja-3d')).toHaveProperty('textContent', producto.nombre);
  });

  it('un fallo del catálogo real muestra error y no lo sustituye por productos ficticios', async () => {
    window.history.replaceState(null, '', '/escena?vista=lista');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 503 })),
    );
    render(<App />);
    expect(await screen.findByText(/No se pudo cargar el catálogo real/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /PRODUCTO/ })).toBeNull();
    expect(screen.queryByText(/Demostración: pendiente/)).toBeNull();
  });

  it('mantiene el criterio y todos los productos al cambiar entre lista y estantería', async () => {
    window.history.replaceState(null, '', '/escena?demo=1&vitrina=1&vista=lista');
    render(<App />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Agrupar por' }), {
      target: { value: 'laboratorio' },
    });
    expect(screen.getAllByRole('heading', { name: /Laboratorio ficticio/ }).length).toBeGreaterThan(
      0,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ver en 3D' }));
    const escena = await screen.findByTestId('escena-3d');
    expect(screen.queryByText(/Al final del pasillo: vitrina con receta/)).toBeNull();
    expect(within(escena).getAllByTestId('caja-3d')).toHaveLength(41);
    expect((screen.getByRole('combobox', { name: 'Agrupar por' }) as HTMLSelectElement).value).toBe(
      'laboratorio',
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Agrupar por' }), {
      target: { value: 'tipo' },
    });
    expect(
      within(escena).getAllByRole('heading', { name: /Tipo ficticio/ }).length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Ver como lista' }));
    expect(screen.getAllByRole('heading', { name: /Tipo ficticio/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /PRODUCTO/ })).toHaveLength(41);
  });
});
