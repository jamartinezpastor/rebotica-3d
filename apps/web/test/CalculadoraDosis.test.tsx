import type { ProductoResponse } from '@rebotica/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import CalculadoraDosis from '../src/escena/CalculadoraDosis';

// FICTICIO: firma, concentración y dosis solo verifican aritmética y flujos de interfaz.
const regla = () => ({
  id: 'regla-ficticia',
  version: 1,
  estado: 'validada',
  fuente: {
    nregistro: 'FICTICIO',
    seccion: '4.2',
    hashSeccion: 'hash-ficticio',
    validadoPor: 'Firma ficticia',
    fecha: '2026-01-01',
    cita: 'Posología ficticia.',
  },
  presentacion: { concentracion: 10, unidad: 'mg/ml', unidadToma: 'ml', pasoDosificable: 0.5 },
  tramos: [
    {
      modo: 'porPeso',
      edadMinMeses: 12,
      edadMaxMeses: 120,
      mgKgToma: 2,
      maxMgToma: 90,
      maxMgKgDia: 6,
      maxMgDia: 240,
      intervaloHoras: 8,
    },
  ],
  diasMaxSinConsultar: { prueba: 2 },
  bloqueos: ['hepatopatiaGrave'],
  avisos: ['embarazo'],
});
const ficha = (): ProductoResponse => ({
  receta: false,
  nregistro: 'FICTICIO',
  nombre: 'Producto ficticio',
  principioActivo: 'Principio ficticio',
  laboratorio: null,
  categoria: null,
  forma: null,
  formaCaja: 'caja-alta',
  dosis: null,
  generico: false,
  conduccion: false,
  triangulo: false,
  problemaSuministro: false,
  asset: null,
  presentaciones: [],
  secciones: [
    {
      seccion: '4.2',
      hash: 'hash-ficticio',
      titulo: 'Posología',
      texto: 'Posología ficticia.',
      resumenLlano: null,
    },
  ],
  enlaces: { prospecto: 'https://cima.aemps.es/p', fichaTecnica: 'https://cima.aemps.es/ft' },
  reglaDosis: regla(),
});
function rellenar(peso = '20', edad = '48') {
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Edad en meses' }), {
    target: { value: edad },
  });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Peso en kg' }), {
    target: { value: peso },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Motivo de consulta' }), {
    target: { value: 'prueba' },
  });
}
afterEach(cleanup);

describe('calculadora de dosis en la ficha', () => {
  it.each(['borrador', 'revisar'])('no muestra controles con regla %s', (estado) => {
    render(<CalculadoraDosis ficha={{ ...ficha(), reglaDosis: { ...regla(), estado } }} />);
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getByText(/no está disponible/)).toBeTruthy();
  });

  it('sin hash actual, cita, firma o coincidencia de producto tampoco ofrece controles', () => {
    for (const caso of [
      { ...ficha(), secciones: [{ ...ficha().secciones[0]!, hash: undefined }] },
      { ...ficha(), nregistro: 'OTRO' },
      {
        ...ficha(),
        reglaDosis: { ...regla(), fuente: { ...regla().fuente, cita: 'No está en la ficha' } },
      },
      { ...ficha(), reglaDosis: { ...regla(), fuente: { ...regla().fuente, validadoPor: null } } },
    ]) {
      const { unmount } = render(<CalculadoraDosis ficha={caso} />);
      expect(screen.queryByRole('slider')).toBeNull();
      unmount();
    }
  });

  it('requiere datos explícitos y calcula en vivo con dibujo y fuente literal', () => {
    render(<CalculadoraDosis ficha={ficha()} />);
    expect(screen.queryByText('4 ml por toma')).toBeNull();
    rellenar();
    expect(screen.getByText('4 ml por toma')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Jeringa dosificadora: 4 ml por toma' })).toBeTruthy();
    expect(screen.getByText(/Máximo 3 tomas en 24 horas y 120 mg al día/)).toBeTruthy();
    expect(screen.getByText('Posología ficticia.')).toBeTruthy();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Peso en kg' }), {
      target: { value: '30' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar edad y peso' }));
    expect(screen.getByText('6 ml por toma')).toBeTruthy();
  });

  it('una condición bloqueante retira la pauta y un aviso se muestra junto al resultado', () => {
    render(<CalculadoraDosis ficha={ficha()} />);
    rellenar();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Embarazo' }));
    expect(screen.getByText(/Consulta con un profesional por: Embarazo/)).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enfermedad hepática grave' }));
    expect(screen.queryByText('4 ml por toma')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText(/requiere valoración profesional/)).toBeTruthy();
  });

  it('pide confirmar el peso inusual y vuelve a pedir confirmación al cambiarlo', () => {
    render(<CalculadoraDosis ficha={ficha()} />);
    rellenar('70');
    expect(screen.queryByRole('img')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar edad y peso' }));
    expect(screen.getByRole('img')).toBeTruthy();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Peso en kg' }), {
      target: { value: '75' },
    });
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('button', { name: 'Confirmar edad y peso' })).toBeTruthy();
  });

  it('muestra unidades fraccionables y el dibujo de comprimidos para una regla fija', () => {
    const r = {
      ...regla(),
      presentacion: {
        concentracion: 40,
        unidad: 'mg/unidad',
        unidadToma: 'comprimido',
        pasoDosificable: 0.5,
        fraccionable: true,
      },
      tramos: [{ modo: 'fija', edadMinMeses: 12, mgToma: 60, maxMgDia: 180, intervaloHoras: 8 }],
    };
    render(<CalculadoraDosis ficha={{ ...ficha(), reglaDosis: r, receta: true }} />);
    rellenar();
    expect(screen.getByText('1,5 comprimidos por toma')).toBeTruthy();
    expect(screen.getByRole('img', { name: '1,5 comprimidos por toma' })).toBeTruthy();
  });

  it('al cambiar de producto borra los datos y no devuelve resultado fuera de tramo', () => {
    const { rerender } = render(<CalculadoraDosis ficha={ficha()} />);
    rellenar();
    const otra = {
      ...ficha(),
      nregistro: 'OTRO',
      reglaDosis: { ...regla(), fuente: { ...regla().fuente, nregistro: 'OTRO' } },
    };
    rerender(<CalculadoraDosis ficha={otra} />);
    expect(screen.getByRole('spinbutton', { name: 'Peso en kg' }).getAttribute('value')).toBe('');
    expect(screen.queryByRole('img')).toBeNull();
    rellenar('20', '0');
    expect(screen.getByText(/No indicado para esta edad o peso/)).toBeTruthy();
  });
});
