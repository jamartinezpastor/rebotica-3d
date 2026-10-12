import type { FormaCaja } from '@rebotica/shared';
import { describe, expect, it } from 'vitest';
import { crearGeometriaCaja } from '../src/escena/geometriaCaja';

const RECT = [0.25, 0.5, 0.375, 0.75] as const;

function uvDelGrupo(forma: FormaCaja, grupo: number, rect?: typeof RECT) {
  const { geometria } = crearGeometriaCaja(forma, rect);
  const uv = geometria.getAttribute('uv');
  const indice = geometria.getIndex();
  const g = geometria.groups[grupo];
  if (!uv || !indice || !g) throw new Error('geometría incompleta');
  const pares = new Set<string>();
  for (let i = g.start; i < g.start + g.count; i++) {
    const v = indice.getX(i);
    pares.add(`${uv.getX(v).toFixed(4)},${uv.getY(v).toFixed(4)}`);
  }
  return [...pares].map((p) => p.split(',').map(Number) as [number, number]);
}

describe('crearGeometriaCaja', () => {
  it('la cara frontal de una caja usa exactamente el rectángulo del atlas', () => {
    const uv = uvDelGrupo('caja-plana', 4, RECT);
    expect(uv).toHaveLength(4);
    const us = uv.map(([u]) => u);
    const vs = uv.map(([, v]) => v);
    expect(Math.min(...us)).toBeCloseTo(0.25);
    expect(Math.max(...us)).toBeCloseTo(0.375);
    expect(Math.min(...vs)).toBeCloseTo(0.5);
    expect(Math.max(...vs)).toBeCloseTo(0.75);
  });

  it('el borde superior de la caja corresponde a la fila superior del rectángulo (v0)', () => {
    const { geometria } = crearGeometriaCaja('caja-plana', RECT);
    const pos = geometria.getAttribute('position');
    const uv = geometria.getAttribute('uv');
    const indice = geometria.getIndex();
    const g = geometria.groups[4];
    if (!pos || !uv || !indice || !g) throw new Error('geometría incompleta');
    let yMax = -Infinity;
    for (let i = g.start; i < g.start + g.count; i++) {
      yMax = Math.max(yMax, pos.getY(indice.getX(i)));
    }
    let vArriba = Infinity;
    let vAbajo = -Infinity;
    for (let i = g.start; i < g.start + g.count; i++) {
      const v = indice.getX(i);
      if (pos.getY(v) === yMax) vArriba = Math.min(vArriba, uv.getY(v));
      else vAbajo = Math.max(vAbajo, uv.getY(v));
    }
    expect(vArriba).toBeCloseTo(0.5);
    expect(vAbajo).toBeCloseTo(0.75);
  });

  it('las demás caras conservan sus UV originales', () => {
    for (const grupo of [0, 1, 2, 3, 5]) {
      expect(uvDelGrupo('caja-alta', grupo, RECT)).toEqual(uvDelGrupo('caja-alta', grupo));
    }
  });

  it('asigna una ranura de material por grupo y solo una es el frente', () => {
    for (const forma of ['caja-plana', 'caja-alta', 'caja-cuadrada', 'tubo', 'cilindro'] as const) {
      const { geometria, ranuras } = crearGeometriaCaja(forma, RECT);
      expect(ranuras).toHaveLength(geometria.groups.length);
      expect(ranuras.filter((r) => r === 'frente')).toHaveLength(1);
    }
  });

  it('el cilindro envuelve todo el rectángulo en su lateral', () => {
    const us = uvDelGrupo('cilindro', 0, RECT).map(([u]) => u);
    expect(Math.min(...us)).toBeCloseTo(0.25);
    expect(Math.max(...us)).toBeCloseTo(0.375);
  });
});
