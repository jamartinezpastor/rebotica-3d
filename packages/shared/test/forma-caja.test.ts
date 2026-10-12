import { describe, expect, it } from 'vitest';
import { formaCajaDesde } from '../src';

describe('formaCajaDesde', () => {
  it.each([
    ['COMPRIMIDO', 'caja-plana'],
    ['CÁPSULA DURA', 'caja-plana'],
    ['SUPOSITORIO', 'caja-plana'],
    ['JARABE', 'caja-alta'],
    ['SOLUCIÓN ORAL EN GOTAS', 'caja-alta'],
    ['COLIRIO EN SOLUCIÓN', 'caja-alta'],
    ['SUSPENSIÓN ORAL', 'caja-alta'],
    ['POLVO PARA SOLUCIÓN ORAL EN SOBRE', 'caja-cuadrada'],
    ['GRANULADO EFERVESCENTE', 'caja-cuadrada'],
    ['CREMA', 'tubo'],
    ['GEL TÓPICO', 'tubo'],
    ['POMADA OFTÁLMICA', 'tubo'],
    ['SOLUCIÓN PARA PULVERIZACIÓN NASAL', 'cilindro'],
    ['AEROSOL', 'cilindro'],
    ['SOLUCIÓN PARA INHALACIÓN POR NEBULIZADOR', 'cilindro'],
  ])('%s -> %s', (forma, esperado) => {
    expect(formaCajaDesde(forma)).toBe(esperado);
  });

  it('lo desconocido o ausente va a caja plana', () => {
    expect(formaCajaDesde(null)).toBe('caja-plana');
    expect(formaCajaDesde('FORMA RARA')).toBe('caja-plana');
  });
});
