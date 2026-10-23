import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ProductoResumen } from '@rebotica/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baldasDemo, vitrinaDemo } from '../src/escena/demo';
import { VistaLista } from '../src/escena/VistaLista';

afterEach(cleanup);

describe('VistaLista', () => {
  it('la vitrina muestra aviso y permite seleccionar sus productos como las demás baldas', () => {
    const onSeleccionar = vi.fn();
    const baldas = vitrinaDemo();
    render(<VistaLista titulo="Pasillo" baldas={baldas} onSeleccionar={onSeleccionar} />);
    expect(screen.getByRole('heading', { name: /Vitrina con receta/ })).toBeTruthy();
    expect(screen.getByText(/no inicies ni cambies/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button')[0] as HTMLElement);
    expect(onSeleccionar).toHaveBeenCalledWith(baldas[0]?.productos[0]);
  });

  it('muestra una sección por balda con todos sus productos como botones', () => {
    const baldas = baldasDemo(12);
    render(<VistaLista titulo="Dolor" baldas={baldas} onSeleccionar={() => {}} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Dolor' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Dolor' }));
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(baldas.length);
    expect(screen.getAllByRole('button')).toHaveLength(12);
    expect(
      screen.getAllByRole('button').every((b) => b.getAttribute('data-cursor') === 'medicamento'),
    ).toBe(true);
    const seccion = screen.getByRole('region', { name: baldas[0]?.titulo ?? '' });
    expect(within(seccion).getAllByRole('button')).toHaveLength(baldas[0]?.productos.length ?? -1);
  });

  it('elegir un producto llama a onSeleccionar con él (misma acción que en 3D)', () => {
    const onSeleccionar = vi.fn();
    const baldas = baldasDemo(6);
    render(<VistaLista titulo="Dolor" baldas={baldas} onSeleccionar={onSeleccionar} />);
    fireEvent.click(screen.getAllByRole('button')[2] as HTMLElement);
    expect(onSeleccionar).toHaveBeenCalledTimes(1);
    const elegido = onSeleccionar.mock.calls[0]?.[0] as ProductoResumen;
    expect(elegido.nregistro).toBe(baldas[0]?.productos[2]?.nregistro);
  });

  it('indica genérico y conducción, y avisa cuando una balda no tiene productos', () => {
    const base = baldasDemo(2)[0]?.productos ?? [];
    const [uno, dos] = base as [ProductoResumen, ProductoResumen];
    render(
      <VistaLista
        titulo="Pasillo"
        baldas={[
          {
            titulo: 'Con etiquetas',
            productos: [{ ...uno, generico: true, conduccion: true }, dos],
          },
          { titulo: 'Vacía', productos: [] },
        ]}
        onSeleccionar={() => {}}
      />,
    );
    expect(screen.getByText('Genérico')).toBeTruthy();
    expect(screen.getByText('Puede afectar a la conducción')).toBeTruthy();
    expect(screen.getByText('No hay productos disponibles para este grupo.')).toBeTruthy();
  });

  it('muestra la foto del medicamento en lugar de un cuadro de color cuando existe', () => {
    const [uno, dos] = baldasDemo(2)[0]?.productos as [ProductoResumen, ProductoResumen];
    const conFoto: ProductoResumen = {
      ...uno,
      asset: {
        colorDominante: '#336699',
        paleta: ['#336699'],
        foto: '/media/miniaturas/1-abcd1234.webp',
      },
    };
    const { container } = render(
      <VistaLista
        titulo="Pasillo"
        baldas={[{ titulo: 'Con foto', productos: [conFoto, dos] }]}
        onSeleccionar={() => {}}
      />,
    );
    const imagenes = container.querySelectorAll('img');
    expect(imagenes).toHaveLength(1);
    expect(imagenes[0]?.getAttribute('src')).toBe('/media/miniaturas/1-abcd1234.webp');
    // Es decorativa: el nombre del producto ya está en el botón.
    expect(imagenes[0]?.getAttribute('alt')).toBe('');
    // El producto sin foto conserva el cuadro con su color, para no dejar un hueco.
    expect(container.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(1);
  });

  it('no muestra dosis ni pautas, solo nombre, principio activo y forma', () => {
    const [p] = baldasDemo(1)[0]?.productos ?? [];
    render(
      <VistaLista
        titulo="Pasillo"
        baldas={[{ titulo: 'B', productos: [{ ...(p as ProductoResumen), dosis: '500 mg' }] }]}
        onSeleccionar={() => {}}
      />,
    );
    expect(screen.queryByText(/500 mg/)).toBeNull();
  });
});
