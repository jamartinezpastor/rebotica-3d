import { describe, expect, it } from 'vitest';
import { esEnlaceCima, parrafos, pestanasDe } from '../src/escena/fichaSecciones';
import { GiroFicha, REANUDAR_TRAS } from '../src/escena/giroFicha';

const seccion = (codigo: string, texto: string, resumenLlano: string | null = null) => ({
  seccion: codigo,
  titulo: `Título técnico ${codigo}`,
  texto,
  resumenLlano,
});

describe('pestanasDe', () => {
  it('reparte las secciones en Uso, Precauciones y Dosis', () => {
    const pestanas = pestanasDe({
      secciones: [
        seccion('4.1', 'Indicación.'),
        seccion('4.2', 'Posología.'),
        seccion('4.3', 'Contraindicación.'),
        seccion('4.4', 'Advertencia.'),
        seccion('4.7', 'Conducción.'),
      ],
    });
    expect(pestanas.map((p) => p.id)).toEqual(['uso', 'precauciones', 'dosis']);
    expect(pestanas.map((p) => p.etiqueta)).toEqual(['Uso', 'Precauciones', 'Dosis']);
    expect(pestanas[0]?.secciones.map((s) => s.seccion)).toEqual(['4.1']);
    expect(pestanas[1]?.secciones.map((s) => s.seccion)).toEqual(['4.3', '4.4', '4.7']);
    expect(pestanas[2]?.secciones.map((s) => s.seccion)).toEqual(['4.2']);
  });

  it('usa títulos pensados para el usuario, no los de la ficha técnica', () => {
    const [uso] = pestanasDe({ secciones: [seccion('4.1', 'Texto.')] });
    expect(uso?.secciones[0]?.titulo).toBe('Para qué se usa');
  });

  it('omite las secciones sin texto ni resumen y deja las pestañas vacías', () => {
    const pestanas = pestanasDe({ secciones: [seccion('4.1', '  \n '), seccion('4.2', 'Algo.')] });
    expect(pestanas[0]?.secciones).toEqual([]);
    expect(pestanas[2]?.secciones).toHaveLength(1);
  });

  it('conserva el resumen en lenguaje llano revisado', () => {
    const [uso] = pestanasDe({ secciones: [seccion('4.1', 'Oficial.', 'En palabras sencillas.')] });
    expect(uso?.secciones[0]?.resumenLlano).toBe('En palabras sencillas.');
  });

  it('el reparto no depende del orden en que llegan las secciones', () => {
    const a = pestanasDe({ secciones: [seccion('4.5', 'x'), seccion('4.3', 'y')] });
    expect(a[1]?.secciones.map((s) => s.seccion)).toEqual(['4.3', '4.5']);
  });
});

describe('parrafos', () => {
  it('divide por saltos de línea y descarta vacíos', () => {
    expect(parrafos('Uno.\n\n  Dos.  \n\n\nTres.')).toEqual(['Uno.', 'Dos.', 'Tres.']);
    expect(parrafos('')).toEqual([]);
  });
});

describe('esEnlaceCima', () => {
  it('solo acepta https a cima.aemps.es', () => {
    expect(esEnlaceCima('https://cima.aemps.es/cima/dochtml/p/1/P_1.html')).toBe(true);
    expect(esEnlaceCima('http://cima.aemps.es/x')).toBe(false);
    expect(esEnlaceCima('https://cima.aemps.es.evil.example/x')).toBe(false);
    expect(esEnlaceCima('javascript:alert(1)')).toBe(false);
    expect(esEnlaceCima('no es una url')).toBe(false);
  });
});

describe('GiroFicha', () => {
  it('gira sola a la velocidad automática', () => {
    const g = new GiroFicha(0.5);
    for (let i = 0; i < 60; i++) g.actualizar(1 / 60, i / 60);
    expect(g.angulo).toBeCloseTo(0.5, 1);
  });

  it('arrastrar la gira con el dedo y suelta con inercia que se apaga', () => {
    const g = new GiroFicha(0.5);
    g.empezar();
    for (let i = 0; i < 10; i++) g.arrastrar(20, 1 / 60);
    const alSoltar = g.angulo;
    expect(alSoltar).toBeGreaterThan(2);
    g.soltar(0);
    g.actualizar(1 / 60, 1 / 60);
    const v0 = Math.abs(g.velocidad);
    expect(v0).toBeGreaterThan(1);
    for (let i = 0; i < 120; i++) g.actualizar(1 / 60, 0.1 + i / 60);
    expect(Math.abs(g.velocidad)).toBeLessThan(v0 * 0.1);
    expect(g.angulo).toBeGreaterThan(alSoltar);
  });

  it('a los 3 s sin tocarla vuelve a girar sola a la velocidad automática', () => {
    const g = new GiroFicha(0.5);
    g.empezar();
    for (let i = 0; i < 6; i++) g.arrastrar(-30, 1 / 60);
    g.soltar(10);
    // Justo antes de los 3 s sigue casi parada.
    for (let i = 0; i < 100; i++) g.actualizar(1 / 60, 10 + (i / 100) * (REANUDAR_TRAS - 0.2));
    expect(Math.abs(g.velocidad)).toBeLessThan(0.2);
    // Pasados los 3 s recupera la velocidad automática.
    for (let i = 0; i < 400; i++) g.actualizar(1 / 60, 10 + REANUDAR_TRAS + i / 60);
    expect(g.velocidad).toBeCloseTo(0.5, 1);
  });

  it('un dt enorme (pestaña en segundo plano) no hace saltar la caja', () => {
    const g = new GiroFicha(0.5);
    const antes = g.angulo;
    g.actualizar(30, 30);
    expect(Math.abs(g.angulo - antes)).toBeLessThan(0.1);
  });

  it('mientras se arrastra no hay giro automático ni inercia', () => {
    const g = new GiroFicha(0.5);
    g.empezar();
    const a = g.angulo;
    g.actualizar(1 / 60, 1);
    expect(g.angulo).toBe(a);
    expect(g.estaArrastrando).toBe(true);
  });
});
