import { describe, expect, it } from 'vitest';
import { ESTANTERIA_POR_DEFECTO, geometriaEstanteria, type Pieza } from '../src/escena/geometria';

const caja = (p: Pieza) => ({
  min: p.posicion.map((c, i) => c - (p.tamano[i] ?? 0) / 2),
  max: p.posicion.map((c, i) => c + (p.tamano[i] ?? 0) / 2),
});

describe('geometriaEstanteria', () => {
  it('por defecto tiene tres baldas: 2 laterales, panel trasero y 4 tableros', () => {
    const g = geometriaEstanteria();
    expect(g.huecos).toHaveLength(3);
    expect(g.frisos).toHaveLength(3);
    expect(g.estructura).toHaveLength(2 + 1 + 4);
  });

  it('toda la estructura cabe en el volumen exterior y sobre el suelo', () => {
    const { ancho, alto, fondo } = ESTANTERIA_POR_DEFECTO;
    for (const pieza of geometriaEstanteria().estructura) {
      const { min, max } = caja(pieza);
      expect(min[0]).toBeGreaterThanOrEqual(-ancho / 2 - 1e-9);
      expect(max[0]).toBeLessThanOrEqual(ancho / 2 + 1e-9);
      expect(min[1]).toBeGreaterThanOrEqual(-1e-9);
      expect(max[1]).toBeLessThanOrEqual(alto + 1e-9);
      expect(min[2]).toBeGreaterThanOrEqual(-fondo / 2 - 1e-9);
      expect(max[2]).toBeLessThanOrEqual(fondo / 2 + 1e-9);
    }
  });

  it('los huecos son iguales, no se solapan con los tableros y están dentro', () => {
    const g = geometriaEstanteria({ baldas: 4, alto: 2.2 });
    expect(g.huecos).toHaveLength(4);
    const alturas = new Set(g.huecos.map((h) => h.alto.toFixed(6)));
    expect(alturas.size).toBe(1);
    const tableros = g.estructura.filter((p) => p.tamano[1] < 0.05 && p.tamano[2] > 0.1);
    for (const h of g.huecos) {
      const base = h.centro[1];
      const tope = base + h.alto;
      for (const t of tableros) {
        const { min, max } = caja(t);
        const solapa = (min[1] as number) < tope - 1e-9 && (max[1] as number) > base + 1e-9;
        expect(solapa).toBe(false);
      }
    }
  });

  it('la estantería es paramétrica en ancho y número de baldas', () => {
    const ancha = geometriaEstanteria({ ancho: 2 });
    expect(ancha.huecos[0]?.ancho).toBeCloseTo(2 - 2 * ESTANTERIA_POR_DEFECTO.grosor);
    expect(geometriaEstanteria({ baldas: 1 }).huecos).toHaveLength(1);
  });

  it('rechaza parámetros imposibles', () => {
    expect(() => geometriaEstanteria({ baldas: 0 })).toThrow(RangeError);
    expect(() => geometriaEstanteria({ baldas: 1.5 })).toThrow(RangeError);
    expect(() => geometriaEstanteria({ ancho: -1 })).toThrow(RangeError);
    expect(() => geometriaEstanteria({ alto: 0.3, baldas: 5 })).toThrow(RangeError);
  });
});
