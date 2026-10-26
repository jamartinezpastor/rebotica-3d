import type { GeometriaEstanteria, Pieza } from './geometria';

/** Puertas y herrajes delante de los huecos, sin tocar la colocación de medicamentos. */
export function geometriaVitrina(g: GeometriaEstanteria) {
  const izquierda = Math.min(...g.huecos.map((h) => h.centro[0] - h.ancho / 2));
  const derecha = Math.max(...g.huecos.map((h) => h.centro[0] + h.ancho / 2));
  const abajo = Math.min(...g.huecos.map((h) => h.centro[1]));
  const arriba = Math.max(...g.huecos.map((h) => h.centro[1] + h.alto));
  const frente = Math.max(...g.huecos.map((h) => h.centro[2] + h.fondo / 2)) + 0.025;
  const ancho = derecha - izquierda;
  const alto = arriba - abajo;
  const cx = (izquierda + derecha) / 2;
  const cy = (abajo + arriba) / 2;
  const marco: Pieza[] = [
    { posicion: [izquierda, cy, frente], tamano: [0.014, alto, 0.015] },
    { posicion: [derecha, cy, frente], tamano: [0.014, alto, 0.015] },
    { posicion: [cx, arriba, frente], tamano: [ancho, 0.014, 0.015] },
    { posicion: [cx, abajo, frente], tamano: [ancho, 0.014, 0.015] },
    { posicion: [cx, cy, frente + 0.003], tamano: [0.012, alto, 0.014] },
    ...[-1, 1].map((lado) => ({
      posicion: [cx + lado * 0.028, cy, frente + 0.028] as [number, number, number],
      tamano: [0.009, 0.115, 0.018] as [number, number, number],
    })),
  ];
  const puertas: Pieza[] = [-1, 1].map((lado) => ({
    posicion: [cx + (lado * ancho) / 4, cy, frente],
    tamano: [ancho / 2 - 0.012, alto - 0.012, 0.003],
  }));
  return { marco, puertas, ancho, alto, cx, cy, frente };
}
