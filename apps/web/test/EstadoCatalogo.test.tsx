import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { EstadoCatalogoPublico } from '@rebotica/shared';
import { EstadoCatalogo } from '../src/escena/EstadoCatalogo';

afterEach(cleanup);
const datos: EstadoCatalogoPublico = {
  estado: 'parcial',
  total: 5,
  sinReceta: 4,
  conReceta: 1,
  conIndicaciones: 3,
  sinIndicaciones: 2,
  cargaPendiente: true,
  cargaPendienteDesde: '2026-01-01T00:00:00.000Z',
  sincronizadoHasta: null,
};
it('el detalle de una copia parcial se despliega sin añadir alertas a la portada', () => {
  const { container } = render(<EstadoCatalogo datos={datos} />);
  expect(container.querySelector('details')?.open).toBe(false);
  fireEvent.click(screen.getByText('Copia parcial · resultados provisionales'));
  expect(container.querySelector('details')?.open).toBe(true);
  expect(
    screen.getByText('3 de 5 medicamentos tienen indicaciones consultables en esta copia.'),
  ).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
});
it('una copia completa mantiene visible la fecha de cobertura y las limitaciones documentales', () => {
  render(
    <EstadoCatalogo
      datos={{
        ...datos,
        estado: 'completo',
        cargaPendiente: false,
        cargaPendienteDesde: null,
        sincronizadoHasta: '2026-01-01T00:00:00.000Z',
      }}
    />,
  );
  expect(screen.getByText('Copia sincronizada')).toBeTruthy();
  expect(screen.getByText(/Sincronizada hasta el 1\/1\/2026/)).toBeTruthy();
  expect(screen.getByText(/Las fichas sin esa sección/)).toBeTruthy();
});
