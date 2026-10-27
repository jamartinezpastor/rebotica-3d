import type { ModeloEstanteria } from './Pasillo';
import type { GeometriaEstanteria, Pieza } from './geometria';
import { ESTANTERIA_POR_DEFECTO } from './geometria';

export interface PiezaPanoramica extends Pieza {
  giro: number;
  color: string;
}
export interface EncuadreGeneral {
  centro: [number, number, number];
  radio: number;
}
export const DURACION_PANORAMICA = 2200;

/** Un único conjunto instanciado, sin etiquetas ni texturas de envase, para ver TODO el catálogo. */
export function piezasPanoramica(
  modelo: readonly ModeloEstanteria[],
  geometria: GeometriaEstanteria,
): PiezaPanoramica[] {
  return modelo.flatMap((est) => {
    const transformar = (pieza: Pieza, color: string): PiezaPanoramica => ({
      posicion: [
        est.posicion[0] +
          Math.cos(est.giroY) * pieza.posicion[0] +
          Math.sin(est.giroY) * pieza.posicion[2],
        est.posicion[1] + pieza.posicion[1],
        est.posicion[2] -
          Math.sin(est.giroY) * pieza.posicion[0] +
          Math.cos(est.giroY) * pieza.posicion[2],
      ],
      tamano: pieza.tamano,
      giro: est.giroY,
      color,
    });
    return [
      ...geometria.estructura.map((p) => transformar(p, est.receta ? '#263442' : '#efe9df')),
      ...geometria.frisos.map((p) => transformar(p, est.receta ? '#f2b544' : '#0f8a4b')),
      ...est.cajas.map((c) =>
        transformar(
          {
            posicion: c.posicion,
            tamano: [c.dimensiones.ancho, c.dimensiones.alto, c.dimensiones.fondo],
          },
          c.item.asset?.colorDominante ?? '#08773e',
        ),
      ),
    ];
  });
}

export function encuadreGeneral(modelo: readonly ModeloEstanteria[]): EncuadreGeneral {
  const min = [Infinity, 0, Infinity];
  const max = [-Infinity, ESTANTERIA_POR_DEFECTO.alto + 0.2, -Infinity];
  for (const e of modelo) {
    const ancho =
      (Math.abs(Math.cos(e.giroY)) * ESTANTERIA_POR_DEFECTO.ancho +
        Math.abs(Math.sin(e.giroY)) * ESTANTERIA_POR_DEFECTO.fondo) /
      2;
    const fondo =
      (Math.abs(Math.sin(e.giroY)) * ESTANTERIA_POR_DEFECTO.ancho +
        Math.abs(Math.cos(e.giroY)) * ESTANTERIA_POR_DEFECTO.fondo) /
      2;
    min[0] = Math.min(min[0]!, e.posicion[0] - ancho);
    max[0] = Math.max(max[0]!, e.posicion[0] + ancho);
    min[2] = Math.min(min[2]!, e.posicion[2] - fondo);
    max[2] = Math.max(max[2]!, e.posicion[2] + fondo);
  }
  if (!modelo.length) return { centro: [0, 0.7, 0], radio: 1 };
  return {
    centro: min.map((v, i) => (v + max[i]!) / 2) as [number, number, number],
    radio: Math.hypot(...min.map((v, i) => max[i]! - v)) / 2,
  };
}

/** La esfera completa cabe tanto en vertical como en horizontal, también en móvil. */
export function distanciaPanoramica(radio: number, fov: number, aspecto: number): number {
  const vertical = (fov * Math.PI) / 360;
  const horizontal = Math.atan(Math.tan(vertical) * aspecto);
  return (radio / Math.sin(Math.min(vertical, horizontal))) * 1.12;
}

export function progresoPanoramica(transcurrido: number) {
  const t = Math.max(0, Math.min(1, (transcurrido / DURACION_PANORAMICA - 0.12) / 0.88));
  return { zoom: t * t * (3 - 2 * t), destino: 1 - (1 - t) ** 4 };
}

export function posePanoramica(
  general: EncuadreGeneral,
  posicionFinal: [number, number, number],
  objetivoFinal: [number, number, number],
  fov: number,
  aspecto: number,
  transcurrido: number,
) {
  const progreso = progresoPanoramica(transcurrido);
  const inicial = distanciaPanoramica(general.radio, fov, aspecto);
  const vectorFinal = posicionFinal.map((n, i) => n - objetivoFinal[i]!);
  const final = Math.hypot(...vectorFinal);
  const normaInicial = Math.hypot(1, 0.65, 1);
  const direccion = [-1, 0.65, 1].map(
    (n, i) => (n / normaInicial) * (1 - progreso.zoom) + (vectorFinal[i]! / final) * progreso.zoom,
  );
  const norma = Math.hypot(...direccion);
  const distancia = Math.exp(
    Math.log(inicial) * (1 - progreso.zoom) + Math.log(final) * progreso.zoom,
  );
  const objetivo = general.centro.map(
    (n, i) => n * (1 - progreso.destino) + objetivoFinal[i]! * progreso.destino,
  ) as [number, number, number];
  return {
    objetivo,
    posicion: objetivo.map((n, i) => n + (direccion[i]! / norma) * distancia) as [
      number,
      number,
      number,
    ],
    lejano: Math.max(60, inicial + general.radio * 3),
  };
}
