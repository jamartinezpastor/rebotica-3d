import { describe, expect, it } from 'vitest';
import tabla from '../data/peso-oms.json';
import { comprobarPeso } from '../src';

describe('referencia de peso OMS (datos de crecimiento, nunca dosis)', () => {
  it('cubre cada mes de 0 a 120 y conserva fuentes oficiales con huellas', () => {
    expect(tabla.rangos.map(([mes]) => mes)).toEqual(Array.from({ length: 121 }, (_, mes) => mes));
    expect(tabla.fuentes).toHaveLength(4);
    expect(
      tabla.fuentes.every(
        (f) => /^https:\/\/cdn\.who\.int\//.test(f.url) && /^[a-f0-9]{64}$/.test(f.sha256),
      ),
    ).toBe(true);
  });

  it('admite los bordes de cada rango y pide confirmar fuera, sin modificar el peso', () => {
    for (const [edad, min, max] of tabla.rangos) {
      if (edad === undefined || min === undefined || max === undefined)
        throw new Error('Fila incompleta');
      expect(comprobarPeso(edad, min).requiereConfirmacion).toBe(false);
      expect(comprobarPeso(edad, max).requiereConfirmacion).toBe(false);
      expect(comprobarPeso(edad, min / 2).motivo).toBe('fueraReferencia');
      expect(comprobarPeso(edad, max * 2).motivo).toBe('fueraReferencia');
    }
  });

  it('no extrapola donde no existen tablas de peso por edad', () => {
    expect(comprobarPeso(121, 50)).toEqual({
      requiereConfirmacion: true,
      motivo: 'sinReferencia',
      rango: null,
    });
  });

  it('no considera plausible un peso no numérico o no positivo', () => {
    for (const peso of [NaN, Infinity, 0, -1]) {
      expect(comprobarPeso(12, peso).requiereConfirmacion).toBe(true);
    }
  });
});
