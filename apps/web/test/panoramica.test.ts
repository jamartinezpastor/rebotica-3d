import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { modeloPasillo } from '../src/escena/Pasillo';
import { baldasDemo, vitrinaDemo } from '../src/escena/demo';
import { geometriaEstanteria } from '../src/escena/geometria';
import {
  DURACION_PANORAMICA,
  encuadreGeneral,
  piezasPanoramica,
  posePanoramica,
} from '../src/escena/entradaPanoramica';

const geometria = geometriaEstanteria();
const modelo = modeloPasillo([...baldasDemo(278), ...vitrinaDemo()], geometria);
const general = encuadreGeneral(modelo);
describe('entrada panorámica completa', () => {
  it('incluye todos los envases y estructuras, aunque excedan la ventana cercana', () => {
    const piezas = piezasPanoramica(modelo, geometria);
    expect(piezas).toHaveLength(
      283 + modelo.length * (geometria.estructura.length + geometria.frisos.length),
    );
    expect(piezas.some((p) => p.giro === -Math.PI / 2 && p.color === '#f2b544')).toBe(true);
    expect(
      piezas.every((p) => p.posicion.every(Number.isFinite) && p.tamano.every((n) => n > 0)),
    ).toBe(true);
  });
  it.each([390 / 844, 1280 / 900, 844 / 390])(
    'encuadra las dos paredes completas con aspecto %s',
    (aspecto) => {
      const pose = posePanoramica(general, [0, 0.7, 1.2], [0, 0.65, 0], 38, aspecto, 0);
      const camara = new PerspectiveCamera(38, aspecto, 0.1, pose.lejano);
      camara.position.set(...pose.posicion);
      camara.lookAt(...pose.objetivo);
      camara.updateMatrixWorld();
      for (const e of modelo)
        for (const x of [-0.6, 0.6])
          for (const y of [0, 1.45])
            for (const z of [-0.17, 0.17]) {
              const punto = new Vector3(
                e.posicion[0] + Math.cos(e.giroY) * x + Math.sin(e.giroY) * z,
                y,
                e.posicion[2] - Math.sin(e.giroY) * x + Math.cos(e.giroY) * z,
              ).project(camara);
              expect(Math.abs(punto.x)).toBeLessThan(1);
              expect(Math.abs(punto.y)).toBeLessThan(1);
              expect(punto.z).toBeLessThan(1);
            }
    },
  );
  it('termina exactamente en el encuadre normal sin salto de posición u orientación', () => {
    const posicion: [number, number, number] = [-20, 0.7, 1.2];
    const objetivo: [number, number, number] = [-20, 0.65, 0];
    const pose = posePanoramica(general, posicion, objetivo, 38, 390 / 844, DURACION_PANORAMICA);
    pose.posicion.forEach((n, i) => expect(n).toBeCloseTo(posicion[i]!, 10));
    expect(pose.objetivo).toEqual(objetivo);
    const previa = posePanoramica(
      general,
      posicion,
      objetivo,
      38,
      390 / 844,
      DURACION_PANORAMICA - 0.01,
    );
    expect(Math.hypot(...previa.posicion.map((n, i) => n - pose.posicion[i]!))).toBeLessThan(1e-6);
  });
  it('mantiene la vista general al inicio y acerca de forma monótona incluso en un catálogo largo', () => {
    const fin: [number, number, number] = [-20, 0.7, 1.2];
    const objetivo: [number, number, number] = [-20, 0.65, 0];
    expect(posePanoramica(general, fin, objetivo, 38, 1, 0)).toEqual(
      posePanoramica(general, fin, objetivo, 38, 1, 100),
    );
    let anterior = Infinity;
    for (let t = 0; t <= DURACION_PANORAMICA; t += 20) {
      const p = posePanoramica(general, fin, objetivo, 38, 1, t);
      const distancia = Math.hypot(...p.posicion.map((n, i) => n - p.objetivo[i]!));
      expect(distancia).toBeLessThanOrEqual(anterior + 1e-9);
      anterior = distancia;
    }
  });
});
