import { describe, expect, it } from 'vitest';
import { baldasDemo, productosDemo } from '../src/escena/demo';
import { geometriaEstanteria } from '../src/escena/geometria';
import { modeloPasillo, SEPARACION_ESTANTERIAS } from '../src/escena/Pasillo';

const geometria = geometriaEstanteria();

describe('modeloPasillo', () => {
  it('agrupa las baldas de tres en tres y centra las estanterías', () => {
    const modelo = modeloPasillo(baldasDemo(), geometria);
    expect(modelo).toHaveLength(2);
    expect(modelo.map((m) => m.baldas.length)).toEqual([3, 3]);
    expect(modelo[0]?.posicion[0]).toBeCloseTo(-SEPARACION_ESTANTERIAS / 2);
    expect(modelo[1]?.posicion[0]).toBeCloseTo(SEPARACION_ESTANTERIAS / 2);
  });

  it('una última estantería incompleta lleva solo las baldas que quedan', () => {
    const baldas = baldasDemo().slice(0, 4);
    const modelo = modeloPasillo(baldas, geometria);
    expect(modelo.map((m) => m.baldas.length)).toEqual([3, 1]);
  });

  it('las estanterías llegan alternando fondo y laterales', () => {
    const baldas = Array.from({ length: 12 }, (_, i) => ({
      titulo: `Balda ${i}`,
      productos: productosDemo(2),
    }));
    const origenes = modeloPasillo(baldas, geometria).map((m) => m.origen);
    // 0: fondo, 1: lateral izquierdo, 2: fondo, 3: lateral derecho.
    expect(origenes[0]).toEqual([0, 0, -9]);
    expect(origenes[1]?.[0]).toBeLessThan(0);
    expect(origenes[2]).toEqual([0, 0, -9]);
    expect(origenes[3]?.[0]).toBeGreaterThan(0);
  });

  it('cada balda coloca sus productos en su propio hueco', () => {
    const modelo = modeloPasillo(baldasDemo(), geometria);
    const primera = modelo[0];
    expect(primera).toBeDefined();
    for (const caja of primera?.cajas ?? []) {
      const hueco = geometria.huecos[caja.balda];
      expect(hueco).toBeDefined();
      if (!hueco) continue;
      expect(caja.posicion[1]).toBeGreaterThanOrEqual(hueco.centro[1]);
      expect(caja.posicion[1]).toBeLessThanOrEqual(hueco.centro[1] + hueco.alto);
    }
    // 6 productos por balda y 3 baldas.
    expect(primera?.cajas).toHaveLength(18);
  });

  it('sin baldas no hay estanterías', () => {
    expect(modeloPasillo([], geometria)).toEqual([]);
  });
});
