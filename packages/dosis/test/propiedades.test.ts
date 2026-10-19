import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { calcularDosis } from '../src';
import { entradaFicticia, reglaFicticia } from './fixtures';

// Coeficientes, pesos y límites FICTICIOS generados, sin medicamentos reales.
const parametros = fc.record({
  peso: fc.integer({ min: 10, max: 70 }),
  coeficiente: fc.integer({ min: 1, max: 19 }),
  concentracion: fc.integer({ min: 1, max: 30 }),
  topeToma: fc.integer({ min: 5, max: 300 }),
  topeKgDia: fc.integer({ min: 1, max: 100 }),
  topeDia: fc.integer({ min: 10, max: 900 }),
  intervalo: fc.integer({ min: 1, max: 49 }),
});
const configuracion = { numRuns: 1500, seed: 3022026 };

describe('propiedades del motor de dosis', () => {
  it('nunca supera el máximo diario por kilo, absoluto ni el máximo por toma', () => {
    fc.assert(
      fc.property(parametros, (p) => {
        const regla = reglaFicticia();
        regla.presentacion = {
          ...regla.presentacion,
          concentracion: p.concentracion,
          pasoDosificable: 0.1,
        };
        regla.tramos = [
          {
            modo: 'porPeso',
            edadMinMeses: 0,
            mgKgToma: p.coeficiente,
            maxMgToma: p.topeToma,
            maxMgKgDia: p.topeKgDia,
            maxMgDia: p.topeDia,
            intervaloHoras: p.intervalo,
          },
        ];
        const r = calcularDosis(regla, entradaFicticia({ pesoKg: p.peso }));
        if (r.tipo !== 'calculada') return;
        // Comparación en décimas enteras: oráculo independiente de la aritmética del motor.
        const mgDecimas = Math.round(r.mgToma * 10);
        expect(mgDecimas).toBeLessThanOrEqual(p.topeToma * 10);
        expect(mgDecimas * r.maxTomasDia).toBeLessThanOrEqual(p.topeKgDia * p.peso * 10);
        expect(mgDecimas * r.maxTomasDia).toBeLessThanOrEqual(p.topeDia * 10);
        expect(r.maxTomasDia).toBeLessThanOrEqual(Math.ceil(24 / p.intervalo));
        expect(r.cantidadToma).toBeGreaterThan(0);
        expect(r.mgToma).toBeGreaterThan(0);
      }),
      configuracion,
    );
  });

  it('la dosis por toma no baja al aumentar el peso dentro del mismo tramo', () => {
    fc.assert(
      fc.property(parametros, fc.integer({ min: 0, max: 15 }), (p, incremento) => {
        const regla = reglaFicticia();
        regla.tramos = [
          {
            modo: 'porPeso',
            edadMinMeses: 0,
            mgKgToma: p.coeficiente,
            maxMgToma: p.topeToma,
            maxMgKgDia: 100,
            maxMgDia: 10000,
            intervaloHoras: p.intervalo,
          },
        ];
        const a = calcularDosis(regla, entradaFicticia({ pesoKg: p.peso }));
        const b = calcularDosis(regla, entradaFicticia({ pesoKg: p.peso + incremento }));
        if (a.tipo === 'calculada') {
          expect(b.tipo).toBe('calculada');
          if (b.tipo === 'calculada') expect(b.mgToma).toBeGreaterThanOrEqual(a.mgToma);
        }
      }),
      configuracion,
    );
  });

  it('jamás devuelve una pauta fuera de los límites de edad o peso', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 1, max: 100 }),
        (edadMeses, pesoKg) => {
          const r = calcularDosis(reglaFicticia(), entradaFicticia({ edadMeses, pesoKg }));
          if (edadMeses < 12 || edadMeses >= 120 || pesoKg < 5 || pesoKg >= 80) {
            expect(r).toMatchObject({ tipo: 'derivar', motivo: 'fueraTramo' });
            expect(r).not.toHaveProperty('cantidadToma');
          }
        },
      ),
      configuracion,
    );
  });
});
