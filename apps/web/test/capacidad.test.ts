import { describe, expect, it } from 'vitest';
import { evaluarCapacidad, vistaInicial, type Capacidad } from '../src/escena/capacidad';
import { MedidorFps, esLento } from '../src/escena/medidorFps';

describe('evaluarCapacidad', () => {
  it('sin WebGL no hay 3D', () => {
    expect(evaluarCapacidad({ webgl: false })).toMatchObject({ nivel: 'sin3d' });
  });

  it('un móvil moderno es de nivel alto', () => {
    const c = evaluarCapacidad({
      webgl: true,
      renderer: 'Adreno (TM) 740',
      memoriaGB: 8,
      nucleos: 8,
    });
    expect(c).toEqual({ nivel: 'alto', motivos: [] });
  });

  it('el renderizado por software es de nivel bajo', () => {
    for (const renderer of [
      'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device), SwiftShader driver)',
      'llvmpipe (LLVM 15.0.7, 256 bits)',
      'Microsoft Basic Render Driver',
    ]) {
      expect(evaluarCapacidad({ webgl: true, renderer }).nivel).toBe('bajo');
    }
  });

  it('las GPU antiguas y los equipos justos son de nivel bajo', () => {
    expect(evaluarCapacidad({ webgl: true, renderer: 'Mali-400 MP' }).nivel).toBe('bajo');
    expect(evaluarCapacidad({ webgl: true, renderer: 'Adreno (TM) 305' }).nivel).toBe('bajo');
    expect(evaluarCapacidad({ webgl: true, memoriaGB: 1 }).nivel).toBe('bajo');
    expect(evaluarCapacidad({ webgl: true, nucleos: 2 }).nivel).toBe('bajo');
    expect(evaluarCapacidad({ webgl: true, ahorroDatos: true }).nivel).toBe('bajo');
  });

  it('un Mali moderno o un Adreno 6xx no se confunden con los antiguos', () => {
    expect(evaluarCapacidad({ webgl: true, renderer: 'Mali-G78' }).nivel).toBe('alto');
    expect(evaluarCapacidad({ webgl: true, renderer: 'Adreno (TM) 619' }).nivel).toBe('alto');
  });

  it('acumula los motivos', () => {
    const c = evaluarCapacidad({ webgl: true, renderer: 'SwiftShader', memoriaGB: 2, nucleos: 2 });
    expect(c.motivos).toHaveLength(3);
  });
});

describe('vistaInicial', () => {
  const alto: Capacidad = { nivel: 'alto', motivos: [] };
  const bajo: Capacidad = { nivel: 'bajo', motivos: ['x'] };
  const sin3d: Capacidad = { nivel: 'sin3d', motivos: ['x'] };

  it('sin preferencias sigue la capacidad', () => {
    expect(vistaInicial(null, null, alto)).toBe('3d');
    expect(vistaInicial(null, null, bajo)).toBe('lista');
    expect(vistaInicial(null, null, sin3d)).toBe('lista');
  });

  it('la URL manda sobre la preferencia guardada y sobre la capacidad', () => {
    expect(vistaInicial('lista', '3d', alto)).toBe('lista');
    expect(vistaInicial('3d', 'lista', bajo)).toBe('3d');
  });

  it('la preferencia guardada manda sobre la capacidad', () => {
    expect(vistaInicial(null, '3d', bajo)).toBe('3d');
    expect(vistaInicial(null, 'lista', alto)).toBe('lista');
  });

  it('sin WebGL nunca se fuerza el 3D', () => {
    expect(vistaInicial('3d', '3d', sin3d)).toBe('lista');
  });

  it('valores desconocidos se ignoran', () => {
    expect(vistaInicial('raro', 'otro', alto)).toBe('3d');
  });
});

describe('MedidorFps', () => {
  it('mide 60 fps con fotogramas de 16,7 ms', () => {
    const m = new MedidorFps({ ventana: 30 });
    for (let i = 0; i < 30; i++) m.registrar(1 / 60);
    const e = m.estadisticas();
    expect(e?.fps).toBeCloseTo(60, 3);
    expect(m.llena).toBe(true);
    expect(esLento(e)).toBe(false);
  });

  it('detecta un dibujo lento', () => {
    const m = new MedidorFps();
    for (let i = 0; i < 60; i++) m.registrar(0.05);
    expect(m.estadisticas()?.fps).toBeCloseTo(20, 3);
    expect(esLento(m.estadisticas())).toBe(true);
  });

  it('las pausas entre interacciones no cuentan como lentitud', () => {
    const m = new MedidorFps({ ventana: 10 });
    for (let i = 0; i < 10; i++) m.registrar(1 / 60);
    m.registrar(3); // el navegador estuvo parado 3 s esperando un gesto
    expect(m.estadisticas()).toBeNull();
    for (let i = 0; i < 5; i++) m.registrar(1 / 60);
    expect(m.estadisticas()?.fps).toBeCloseTo(60, 3);
  });

  it('el percentil 95 refleja los tirones aislados', () => {
    const m = new MedidorFps({ ventana: 100 });
    for (let i = 0; i < 95; i++) m.registrar(1 / 60);
    for (let i = 0; i < 5; i++) m.registrar(0.1);
    const e = m.estadisticas();
    expect(e?.p95Ms).toBeGreaterThanOrEqual(99);
    expect(e?.maxMs).toBeCloseTo(100);
  });

  it('cuenta fotogramas válidos y da el aviso una sola vez', () => {
    const m = new MedidorFps();
    m.registrar(1 / 60);
    m.registrar(0);
    m.registrar(1 / 60);
    expect(m.total).toBe(2);
    expect(m.primerAviso()).toBe(true);
    expect(m.primerAviso()).toBe(false);
  });

  it('descarta valores no válidos y se puede reiniciar', () => {
    const m = new MedidorFps();
    m.registrar(0);
    m.registrar(-1);
    m.registrar(Number.NaN);
    expect(m.estadisticas()).toBeNull();
    m.registrar(0.02);
    m.reiniciar();
    expect(m.estadisticas()).toBeNull();
  });

  it('esLento sin datos no da falsos avisos', () => {
    expect(esLento(null)).toBe(false);
  });
});
