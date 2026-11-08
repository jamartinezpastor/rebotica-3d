import { describe, expect, it } from 'vitest';
import { marcoEnRiel } from '../src/escena/trayectoPasillo';
import { modeloPasillo, datosRiel } from '../src/escena/Pasillo';
import { baldasDemo, vitrinaDemo } from '../src/escena/demo';
import { geometriaEstanteria } from '../src/escena/geometria';
import { geometriaVitrina } from '../src/escena/vitrina';
import { ControlRiel } from '../src/escena/riel';

const geometria = geometriaEstanteria();
function arrastrarEsquina(control: ControlRiel, pixeles: number) {
  control.empezarArrastre();
  for (let i = 0; i < 20; i++) control.moverArrastre(pixeles / 20, 0, 0.05);
  control.terminarArrastre();
  for (let i = 0; i < 180; i++) control.actualizar(1 / 60);
}

describe('esquina entre sin receta y vitrina', () => {
  it('permite continuar por teclado si se interrumpe el movimiento dentro de la esquina', () => {
    const control = new ControlRiel({
      puntos: [
        [-0.2, 0],
        [1.5, 1.7],
      ],
      esquina: { inicio: 0, fin: 1.5, x: 1 },
      instantaneo: true,
    });
    control.x = 0.7;
    control.empezarArrastre();
    control.terminarArrastre();
    control.teclado('ArrowRight');
    control.actualizar(1 / 60);
    expect(control.x).toBe(1.5);
    expect(control.fila).toBe(1);
  });
  it.each([0, 1, 2])(
    'un arrastre moderado cruza desde la fila %i aunque la vitrina solo tenga una balda',
    (fila) => {
      const riel = datosRiel(
        modeloPasillo([...baldasDemo(36), ...vitrinaDemo()], geometria),
        geometria,
      );
      const esquina = riel.esquina!;
      const ultimo = riel.puntos[fila]!.filter((x) => x <= esquina.inicio).at(-1)!;
      const control = new ControlRiel({ ...riel, filaInicial: fila, xInicial: ultimo });
      control.encuadrar(0.002);
      arrastrarEsquina(control, -160);
      expect(control.x).toBeGreaterThanOrEqual(esquina.fin - 1e-6);
      expect(control.fila).toBeCloseTo(0);
      expect(control.enMovimiento()).toBe(false);
      arrastrarEsquina(control, 160);
      expect(control.x).toBeLessThanOrEqual(esquina.inicio + 1e-6);
      expect(control.enMovimiento()).toBe(false);
    },
  );

  it('el teclado permite entrar desde una altura sin productos en la pared siguiente', () => {
    const riel = datosRiel(
      modeloPasillo([...baldasDemo(36), ...vitrinaDemo()], geometria),
      geometria,
    );
    const ultimo = riel.puntos[1]!.at(-1)!;
    const control = new ControlRiel({
      ...riel,
      filaInicial: 1,
      xInicial: ultimo,
      instantaneo: true,
    });
    control.teclado('ArrowRight');
    control.actualizar(1 / 60);
    expect(control.x).toBeGreaterThanOrEqual(riel.esquina!.fin);
    expect(control.fila).toBe(0);
  });
  it.each([0.8, 1, 1.4])('cruza con un gesto moderado en ambos sentidos y con zoom %s', (zoom) => {
    const control = new ControlRiel({
      puntos: [
        [-0.2, 0],
        [1.5, 1.7],
      ],
      esquina: { inicio: 0, fin: 1.5, x: 1 },
    });
    control.encuadrar(0.002 * zoom);
    control.teclado('End');
    for (let i = 0; i < 180; i++) control.actualizar(1 / 60);
    arrastrarEsquina(control, -160);
    expect(control.x).toBeCloseTo(1.5);
    expect(control.fila).toBeCloseTo(1);
    arrastrarEsquina(control, 160);
    expect(control.x).toBeCloseTo(0);
    expect(control.fila).toBeCloseTo(0);
  });
  it('no cruza con un roce corto y permite volver con teclado desde una fila sin continuidad', () => {
    const control = new ControlRiel({
      puntos: [
        [-0.2, 0],
        [1.5, 1.7],
      ],
      xInicial: 0,
      instantaneo: true,
      esquina: { inicio: 0, fin: 1.5, x: 1 },
    });
    control.encuadrar(0.002);
    arrastrarEsquina(control, -20);
    expect(control.x).toBe(0);
    control.teclado('ArrowRight');
    control.actualizar(1 / 60);
    expect(control.x).toBe(1.5);
    control.teclado('ArrowLeft');
    control.actualizar(1 / 60);
    expect(control.x).toBe(0);
    expect(control.fila).toBe(0);
  });
  it('coloca la vitrina perpendicular a las baldas abiertas, sin mezclar productos', () => {
    const modelo = modeloPasillo([...baldasDemo(36), ...vitrinaDemo()], geometria);
    const normales = modelo.filter((e) => !e.receta);
    const vitrinas = modelo.filter((e) => e.receta);
    expect(normales.every((e) => e.giroY === 0 && e.posicion[2] === 0)).toBe(true);
    expect(vitrinas.every((e) => e.giroY === -Math.PI / 2)).toBe(true);
    expect(vitrinas[0]!.posicion[0]).toBeGreaterThan(normales.at(-1)!.posicion[0]);
    expect(vitrinas[0]!.posicion[2]).toBeGreaterThan(0);
    expect(modelo.flatMap((e) => e.cajas).length).toBe(41);
    expect(modelo.every((e) => e.cajas.every((c) => !!c.item.receta === e.receta))).toBe(true);
  });
  it('cada destino lógico sigue mirando al producto correcto en cualquiera de las paredes', () => {
    const modelo = modeloPasillo([...baldasDemo(36), ...vitrinaDemo()], geometria);
    const riel = datosRiel(modelo, geometria);
    expect(riel.puntos.flat()).toHaveLength(41);
    for (const e of modelo)
      for (const c of e.cajas) {
        const marco = marcoEnRiel(e.rielX + c.posicion[0], riel.esquina);
        expect(marco.x).toBeCloseTo(e.posicion[0] + Math.cos(e.giroY) * c.posicion[0]);
        expect(marco.z).toBeCloseTo(e.posicion[2] - Math.sin(e.giroY) * c.posicion[0]);
        expect(marco.giro).toBe(e.giroY);
      }
  });
  it('la curva de cámara gira de forma continua y permanece dentro de la estancia', () => {
    const modelo = modeloPasillo([...baldasDemo(18), ...vitrinaDemo()], geometria);
    const esquina = datosRiel(modelo, geometria).esquina!;
    let anterior = 0;
    for (let i = 0; i <= 100; i++) {
      const s = esquina.inicio + ((esquina.fin - esquina.inicio) * i) / 100;
      const marco = marcoEnRiel(s, esquina);
      expect(marco.giro).toBeLessThanOrEqual(anterior + 1e-9);
      expect(marco.x + Math.sin(marco.giro) * 1.2).toBeLessThan(esquina.x);
      expect(marco.z + Math.cos(marco.giro) * 1.2).toBeGreaterThan(0);
      anterior = marco.giro;
    }
    expect(anterior).toBeCloseTo(-Math.PI / 2);
  });
  it.each(['inicio', 'fin'] as const)(
    'no introduce saltos de posición en el extremo %s',
    (extremo) => {
      const esquina = datosRiel(
        modeloPasillo([...baldasDemo(18), ...vitrinaDemo()], geometria),
        geometria,
      ).esquina!;
      const a = marcoEnRiel(esquina[extremo] - 1e-7, esquina);
      const b = marcoEnRiel(esquina[extremo] + 1e-7, esquina);
      expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(1e-5);
      expect(Math.abs(a.giro - b.giro)).toBeLessThan(1e-5);
    },
  );
  it('conserva el recorrido recto si todos los medicamentos son sin receta', () => {
    const riel = datosRiel(modeloPasillo(baldasDemo(36), geometria), geometria);
    expect(riel.esquina).toBeUndefined();
    expect(marcoEnRiel(3)).toEqual({ x: 3, z: 0, giro: 0 });
  });
  it('también permite recorrer un catálogo compuesto solo por vitrinas', () => {
    const modelo = modeloPasillo(vitrinaDemo(), geometria);
    const riel = datosRiel(modelo, geometria);
    for (const s of riel.puntos.flat()) {
      const marco = marcoEnRiel(s, riel.esquina);
      expect(marco.giro).toBe(-Math.PI / 2);
      expect(marco.x).toBe(modelo[0]!.posicion[0]);
    }
  });
});

describe('cerramiento visual de la vitrina', () => {
  it('sitúa dos puertas delante de todos los huecos, sin mover cajas ni baldas', () => {
    const antes = structuredClone(geometria);
    const vitrina = geometriaVitrina(geometria);
    expect(vitrina.puertas).toHaveLength(2);
    const frenteHuecos = Math.max(...geometria.huecos.map((h) => h.centro[2] + h.fondo / 2));
    expect(vitrina.puertas.every((p) => p.posicion[2] > frenteHuecos)).toBe(true);
    expect(vitrina.puertas[0]!.posicion[0]).toBeLessThan(vitrina.puertas[1]!.posicion[0]);
    expect(vitrina.marco.every((p) => p.tamano.every((n) => n > 0))).toBe(true);
    expect(geometria).toEqual(antes);
  });
});
