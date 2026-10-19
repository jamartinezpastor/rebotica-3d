import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BaldaEscena } from '../src/escena/Pasillo';
import type * as ModuloCapacidad from '../src/escena/capacidad';
import { App } from '../src/App';

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
  window.history.replaceState(null, '', '/');
  window.localStorage.clear();
});

describe('exploración agrupada', () => {
  it('mantiene el criterio y todos los productos al cambiar entre lista y estantería', async () => {
    window.history.replaceState(null, '', '/escena?vitrina=1&vista=lista');
    render(<App />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Agrupar por' }), {
      target: { value: 'laboratorio' },
    });
    expect(screen.getAllByRole('heading', { name: /Laboratorio ficticio/ }).length).toBeGreaterThan(
      0,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ver en 3D' }));
    const escena = await screen.findByTestId('escena-3d');
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
