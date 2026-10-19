import { describe, expect, it } from 'vitest';
import { baldasDemo, productosDemo, vitrinaDemo } from '../src/escena/demo';
import { geometriaEstanteria } from '../src/escena/geometria';
import { datosRiel, modeloPasillo, SEPARACION_ESTANTERIAS } from '../src/escena/Pasillo';
import { alturaEnFila } from '../src/escena/RielCamara';

const geometria = geometriaEstanteria();

describe('modeloPasillo', () => {
  it('la vitrina usa una estantería propia al final y conserva las cajas seleccionables en el raíl', () => {
    const modelo = modeloPasillo([...baldasDemo(6), ...vitrinaDemo()], geometria);
    expect(modelo.map((m) => m.receta)).toEqual([false, true]);
    expect(modelo[1]?.cajas.every((c) => c.item.receta)).toBe(true);
    expect(modelo[0]?.cajas.every((c) => !c.item.receta)).toBe(true);
    expect(datosRiel(modelo, geometria).puntos[0]).toHaveLength(11);
  });

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

describe('datosRiel', () => {
  it('reúne las posiciones x de cada balda de todas las estanterías, ordenadas', () => {
    const modelo = modeloPasillo(baldasDemo(), geometria);
    const { puntos, alturas } = datosRiel(modelo, geometria);
    expect(puntos).toHaveLength(3);
    // 6 productos por balda en cada una de las 2 estanterías.
    for (const fila of puntos) {
      expect(fila).toHaveLength(12);
      expect(fila).toEqual([...fila].sort((a, b) => a - b));
    }
    // Las de la segunda estantería quedan a la derecha de las de la primera.
    expect(puntos[0]?.[6]).toBeGreaterThan(puntos[0]?.[5] ?? 0);
    expect(alturas).toHaveLength(3);
    expect(alturas[0]).toBeLessThan(alturas[1] ?? 0);
    expect(alturas[1]).toBeLessThan(alturas[2] ?? 0);
  });

  it('una balda vacía aporta una lista vacía', () => {
    const baldas = [
      { titulo: 'A', productos: [] },
      { titulo: 'B', productos: productosDemo(2) },
    ];
    const { puntos } = datosRiel(modeloPasillo(baldas, geometria), geometria);
    expect(puntos[0]).toEqual([]);
    expect(puntos[1]).toHaveLength(2);
  });
});

describe('alturaEnFila', () => {
  it('interpola entre baldas y se acota a los extremos', () => {
    const alturas = [0.2, 0.6, 1.0];
    expect(alturaEnFila(alturas, 0)).toBeCloseTo(0.2);
    expect(alturaEnFila(alturas, 0.5)).toBeCloseTo(0.4);
    expect(alturaEnFila(alturas, 2)).toBeCloseTo(1.0);
    expect(alturaEnFila(alturas, -1)).toBeCloseTo(0.2);
    expect(alturaEnFila(alturas, 9)).toBeCloseTo(1.0);
    expect(alturaEnFila([], 1)).toBe(0);
  });
});
