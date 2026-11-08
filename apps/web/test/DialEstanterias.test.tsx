import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DialEstanterias } from '../src/escena/DialEstanterias';
import { destinosEstanterias } from '../src/escena/estanterias';
import { baldasDemo, vitrinaDemo } from '../src/escena/demo';
import { modeloPasillo } from '../src/escena/Pasillo';
import { geometriaEstanteria } from '../src/escena/geometria';

afterEach(cleanup);

describe('dial de estanterías', () => {
  it('coincide con las estanterías reales, incluida la última incompleta y la vitrina', () => {
    const baldas = [...baldasDemo(25), ...vitrinaDemo()];
    const destinos = destinosEstanterias(baldas);
    const modelo = modeloPasillo(baldas, geometriaEstanteria());
    expect(destinos).toHaveLength(3);
    expect(destinos.map((d) => d.receta)).toEqual([false, false, true]);
    destinos.forEach((destino, i) => {
      expect(destino.registros).toEqual(modelo[i]!.cajas.map((c) => c.item.nregistro));
      expect(destino.registros).toContain(destino.registro);
    });
  });

  it('permite saltar con el dial y por nombre y anuncia la posición y la receta', () => {
    const estanterias = destinosEstanterias([...baldasDemo(25), ...vitrinaDemo()]);
    const onIr = vi.fn();
    const { rerender } = render(
      <DialEstanterias estanterias={estanterias} actual={0} onIr={onIr} />,
    );
    fireEvent.change(screen.getByRole('slider', { name: 'Ir a estantería' }), {
      target: { value: '2' },
    });
    expect(onIr).toHaveBeenLastCalledWith(2);
    rerender(<DialEstanterias estanterias={estanterias} actual={2} onIr={onIr} />);
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toContain(
      'Estantería 3 de 3. Con receta',
    );
    expect(screen.getByRole('combobox')).toHaveProperty('value', '2');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
    expect(onIr).toHaveBeenLastCalledWith(1);
  });

  it('conserva todos los destinos cuando hay miles de estanterías y limita las marcas dibujadas', () => {
    const estanterias = Array.from({ length: 3000 }, (_, i) => ({
      titulo: `Grupo ${i}`,
      receta: i > 500,
      registro: String(i),
    }));
    const { container } = render(
      <DialEstanterias estanterias={estanterias} actual={2999} onIr={() => {}} />,
    );
    expect(screen.getByRole('slider')).toHaveProperty('max', '2999');
    expect(container.querySelectorAll('option')).toHaveLength(3000);
    expect(container.querySelectorAll('span').length).toBeLessThan(150);
  });
});
