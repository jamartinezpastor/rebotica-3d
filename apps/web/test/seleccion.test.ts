import { describe, expect, it } from 'vitest';
import {
  DISTANCIA_FICHA,
  DISTANCIA_VELO,
  DURACION_SELECCION,
  avanzarTransicion,
  cajaMasCercana,
  escalaEnFicha,
  suavizado,
} from '../src/escena/seleccion';

describe('suavizado', () => {
  it('parte de 0, acaba en 1, es simétrico y monótono', () => {
    expect(suavizado(0)).toBe(0);
    expect(suavizado(1)).toBe(1);
    expect(suavizado(0.5)).toBeCloseTo(0.5);
    expect(suavizado(0.25) + suavizado(0.75)).toBeCloseTo(1);
    let previo = 0;
    for (let i = 0; i <= 100; i++) {
      const v = suavizado(i / 100);
      expect(v).toBeGreaterThanOrEqual(previo);
      previo = v;
    }
  });

  it('acota fuera de rango', () => {
    expect(suavizado(-3)).toBe(0);
    expect(suavizado(7)).toBe(1);
  });
});

describe('avanzarTransicion', () => {
  it('llega en la duración indicada y no se pasa', () => {
    let u = 0;
    for (let i = 0; i < 20; i++) u = avanzarTransicion(u, DURACION_SELECCION / 10, 1);
    expect(u).toBe(1);
    expect(avanzarTransicion(0, DURACION_SELECCION / 2, 1)).toBeCloseTo(0.5);
  });

  it('volver reproduce la ida al revés', () => {
    const ida: number[] = [];
    let u = 0;
    for (let i = 0; i < 5; i++) {
      u = avanzarTransicion(u, 0.1, 1);
      ida.push(u);
    }
    const vuelta: number[] = [];
    for (let i = 0; i < 4; i++) {
      u = avanzarTransicion(u, 0.1, 0);
      vuelta.push(u);
    }
    // El estado tras 1 paso de vuelta es el de 4 pasos de ida, y así sucesivamente.
    expect(vuelta[0]).toBeCloseTo(ida[3] ?? -1, 9);
    expect(vuelta[1]).toBeCloseTo(ida[2] ?? -1, 9);
  });

  it('invertir a mitad de camino no salta', () => {
    const mitad = avanzarTransicion(0, DURACION_SELECCION * 0.4, 1);
    const atras = avanzarTransicion(mitad, 0.01, 0);
    expect(Math.abs(atras - mitad)).toBeLessThan(0.05);
  });

  it('con duración 0 el cambio es inmediato (menos movimiento)', () => {
    expect(avanzarTransicion(0, 0.016, 1, 0)).toBe(1);
    expect(avanzarTransicion(1, 0.016, 0, 0)).toBe(0);
  });

  it('un dt negativo no retrocede', () => {
    expect(avanzarTransicion(0.5, -1, 1)).toBe(0.5);
  });
});

describe('geometría de la ficha', () => {
  it('el velo queda detrás de la caja y delante de las estanterías', () => {
    expect(DISTANCIA_VELO).toBeGreaterThan(DISTANCIA_FICHA);
    // La cámara del raíl está al menos a 1,2 m de las cajas.
    expect(DISTANCIA_VELO).toBeLessThan(1.2);
  });

  it('escala la caja para llenar su sitio sin agrandarla en exceso', () => {
    expect(escalaEnFicha(0.07)).toBeCloseTo(2);
    expect(escalaEnFicha(0.3)).toBe(1);
    expect(escalaEnFicha(0.01)).toBe(4);
    expect(escalaEnFicha(0)).toBe(1);
  });
});

describe('cajaMasCercana', () => {
  const cajas = [
    { balda: 0, x: 0 },
    { balda: 0, x: 0.2 },
    { balda: 1, x: 0.1 },
    { balda: 1, x: 0.3 },
  ];

  it('elige la más cercana dentro de la balda indicada', () => {
    expect(cajaMasCercana(cajas, 0.18, 0)).toBe(1);
    expect(cajaMasCercana(cajas, 0.18, 1)).toBe(2);
    expect(cajaMasCercana(cajas, 5, 1)).toBe(3);
  });

  it('devuelve -1 si la balda no tiene cajas', () => {
    expect(cajaMasCercana(cajas, 0, 2)).toBe(-1);
    expect(cajaMasCercana([], 0, 0)).toBe(-1);
  });
});
