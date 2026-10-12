import { describe, expect, it } from 'vitest';
import { colocarCajas, dimensionesCaja } from '../src/escena/cajas';
import { geometriaEstanteria } from '../src/escena/geometria';

const huecos = geometriaEstanteria().huecos;
const lote = (n: number, forma: 'caja-plana' | 'caja-alta' | 'tubo' = 'caja-plana') =>
  Array.from({ length: n }, (_, i) => ({ id: i, formaCaja: forma }));

describe('colocarCajas', () => {
  it('rellena la primera balda y pasa a la siguiente cuando no caben', () => {
    const { colocadas, omitidas } = colocarCajas(huecos, lote(12));
    expect(omitidas).toEqual([]);
    expect(colocadas[0]?.balda).toBe(0);
    expect(colocadas.at(-1)?.balda).toBeGreaterThan(0);
    // Las baldas se llenan en orden.
    const baldas = colocadas.map((c) => c.balda);
    expect(baldas).toEqual([...baldas].sort((a, b) => a - b));
  });

  it('ninguna caja sale de su hueco ni se solapa con la contigua', () => {
    const { colocadas } = colocarCajas(huecos, lote(40, 'caja-alta'));
    for (const c of colocadas) {
      const hueco = huecos[c.balda];
      expect(hueco).toBeDefined();
      if (!hueco) continue;
      const { ancho, alto, fondo } = c.dimensiones;
      expect(c.posicion[0] - ancho / 2).toBeGreaterThanOrEqual(hueco.centro[0] - hueco.ancho / 2);
      expect(c.posicion[0] + ancho / 2).toBeLessThanOrEqual(hueco.centro[0] + hueco.ancho / 2);
      expect(c.posicion[1] - alto / 2).toBeCloseTo(hueco.centro[1], 6);
      expect(c.posicion[1] + alto / 2).toBeLessThanOrEqual(hueco.centro[1] + hueco.alto);
      expect(c.posicion[2] + fondo / 2).toBeLessThanOrEqual(hueco.centro[2] + hueco.fondo / 2);
    }
    for (let i = 1; i < colocadas.length; i++) {
      const a = colocadas[i - 1];
      const b = colocadas[i];
      if (!a || !b || a.balda !== b.balda) continue;
      expect(b.posicion[0] - b.dimensiones.ancho / 2).toBeGreaterThan(
        a.posicion[0] + a.dimensiones.ancho / 2,
      );
    }
  });

  it('devuelve como omitidas las que no caben en ninguna balda', () => {
    const { colocadas, omitidas } = colocarCajas(huecos, lote(200));
    expect(colocadas.length + omitidas.length).toBe(200);
    expect(omitidas.length).toBeGreaterThan(0);
  });

  it('sin huecos no coloca nada', () => {
    const { colocadas, omitidas } = colocarCajas([], lote(3));
    expect(colocadas).toEqual([]);
    expect(omitidas).toHaveLength(3);
  });

  it('cada forma tiene sus medidas', () => {
    expect(dimensionesCaja('caja-alta').alto).toBeGreaterThan(dimensionesCaja('caja-plana').alto);
    expect(dimensionesCaja('cilindro').ancho).toBe(dimensionesCaja('cilindro').fondo);
  });
});
