import { describe, expect, it } from 'vitest';
import {
  LIMITE_ENTRADA,
  avance,
  muelle,
  planificarEntrada,
  textoDescifrado,
} from '../src/escena/animacion';

function muestras(opciones?: Parameters<typeof muelle>[1], pasos = 600) {
  const asentamiento = opciones?.asentamiento ?? 0.6;
  return Array.from({ length: pasos + 1 }, (_, i) =>
    muelle((i / pasos) * asentamiento * 1.2, opciones),
  );
}

describe('muelle', () => {
  it('parte de 0, termina exactamente en 1 y nunca es NaN', () => {
    expect(muelle(-1)).toBe(0);
    expect(muelle(0)).toBe(0);
    expect(muelle(0.6)).toBe(1);
    expect(muelle(5)).toBe(1);
    expect(muestras().every((v) => Number.isFinite(v))).toBe(true);
  });

  it('rebota entre el 3 % y el 5 % por defecto, como pide el plan', () => {
    const pico = Math.max(...muestras());
    expect(pico).toBeGreaterThan(1.03);
    expect(pico).toBeLessThan(1.05);
  });

  it('el sobreimpulso sigue al parámetro', () => {
    const pico = Math.max(...muestras({ sobreimpulso: 0.1 }));
    expect(pico).toBeGreaterThan(1.09);
    expect(pico).toBeLessThan(1.11);
  });

  it('sube sin retroceder hasta llegar por primera vez a 1', () => {
    const v = muestras();
    const llegada = v.findIndex((x) => x >= 1);
    for (let i = 1; i <= llegada; i++) expect(v[i]).toBeGreaterThanOrEqual(v[i - 1] ?? 0);
  });

  it('al asentarse el salto final es inferior al 0,5 % del recorrido', () => {
    expect(Math.abs(1 - muelle(0.6 - 1e-6))).toBeLessThan(0.005);
  });
});

describe('avance', () => {
  it('se acota a [0, 1]', () => {
    expect(avance(0, 1, 2)).toBe(0);
    expect(avance(2, 1, 2)).toBeCloseTo(0.5);
    expect(avance(9, 1, 2)).toBe(1);
    expect(avance(0.5, 1, 0)).toBe(0);
    expect(avance(1, 1, 0)).toBe(1);
  });
});

describe('planificarEntrada', () => {
  it('escalona las estanterías 100 ms y las cajas 30 ms', () => {
    const plan = planificarEntrada([3, 3, 3]);
    expect(plan.estanterias[1]!.inicio - plan.estanterias[0]!.inicio).toBeCloseTo(0.1);
    expect(plan.cajas[0]![1]!.inicio - plan.cajas[0]![0]!.inicio).toBeCloseTo(0.03);
    expect(plan.total).toBeLessThanOrEqual(LIMITE_ENTRADA);
  });

  it('nunca pasa de 1,4 s aunque haya muchas cajas', () => {
    const plan = planificarEntrada([24, 24, 24, 24, 24, 24]);
    expect(plan.total).toBeLessThanOrEqual(LIMITE_ENTRADA + 1e-9);
    const fin = Math.max(
      ...plan.cajas.flat().map((t) => t.inicio + t.duracion),
      ...plan.estanterias.map((t) => t.inicio + t.duracion),
    );
    expect(fin).toBeLessThanOrEqual(LIMITE_ENTRADA + 1e-9);
  });

  it('mantiene el orden: cada caja cae después de que empiece su estantería', () => {
    const plan = planificarEntrada([5, 5]);
    plan.cajas.forEach((lista, i) => {
      for (const caja of lista) {
        expect(caja.inicio).toBeGreaterThan(plan.estanterias[i]!.inicio);
      }
    });
  });

  it('sin estanterías no hay nada que animar', () => {
    expect(planificarEntrada([]).total).toBe(0);
  });
});

describe('textoDescifrado', () => {
  it('al principio es todo glifos (salvo espacios) y al final el texto exacto', () => {
    const inicio = textoDescifrado('Principio activo', 0, 7);
    expect(inicio.texto).toHaveLength('Principio activo'.length);
    expect(inicio.texto[9]).toBe(' ');
    expect(inicio.descifrados).toBe(0);
    expect(inicio.texto.replace(/ /g, '')).not.toBe('Principioactivo');
    expect(textoDescifrado('Principio activo', 1).texto).toBe('Principio activo');
  });

  it('fija los caracteres de izquierda a derecha', () => {
    const medio = textoDescifrado('ABCDEFGH', 0.5, 3);
    expect(medio.descifrados).toBe(4);
    expect(medio.texto.slice(0, 4)).toBe('ABCD');
  });

  it('es determinista para una misma semilla', () => {
    expect(textoDescifrado('Hola mundo', 0.3, 42)).toEqual(textoDescifrado('Hola mundo', 0.3, 42));
  });

  it('el progreso se acota', () => {
    expect(textoDescifrado('abc', -3).descifrados).toBe(0);
    expect(textoDescifrado('abc', 7).texto).toBe('abc');
  });
});
