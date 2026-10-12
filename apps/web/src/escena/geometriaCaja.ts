import type { FormaCaja } from '@rebotica/shared';
import { BoxGeometry, CylinderGeometry, type BufferGeometry } from 'three';
import { dimensionesCaja } from './cajas';

/** Rectángulo del atlas [u0, v0, u1, v1]; el origen (0,0) es la esquina superior izquierda. */
export type RectanguloAtlas = readonly [number, number, number, number];

/** Qué material lleva cada grupo de la geometría, en el orden en que three los crea. */
export type RanuraMaterial = 'frente' | 'lado';

export interface GeometriaCaja {
  geometria: BufferGeometry;
  ranuras: RanuraMaterial[];
}

const LADOS_CILINDRO = 28;

/**
 * Remapea las UV de un grupo de la geometría al rectángulo del atlas. Los atlas KTX2 no se
 * voltean al subirlos a la GPU: la fila superior de la imagen está en v = 0.
 */
function remapearUv(geometria: BufferGeometry, grupo: number, rect: RectanguloAtlas): void {
  const uv = geometria.getAttribute('uv');
  const indice = geometria.getIndex();
  const g = geometria.groups[grupo];
  if (!uv || !indice || !g) return;
  const [u0, v0, u1, v1] = rect;
  const tocados = new Set<number>();
  for (let i = g.start; i < g.start + g.count; i++) tocados.add(indice.getX(i));
  for (const vertice of tocados) {
    const x = uv.getX(vertice);
    const y = uv.getY(vertice);
    uv.setXY(vertice, u0 + x * (u1 - u0), v1 - y * (v1 - v0));
  }
  uv.needsUpdate = true;
}

/**
 * Geometría de la caja según la forma farmacéutica. La cara frontal (+z; la cara que da al
 * pasillo) lleva la textura del atlas; el resto, el color dominante. El cilindro envuelve la
 * textura alrededor de toda su superficie lateral.
 */
export function crearGeometriaCaja(forma: FormaCaja, rect?: RectanguloAtlas): GeometriaCaja {
  const d = dimensionesCaja(forma);

  if (forma === 'cilindro') {
    const geometria = new CylinderGeometry(d.ancho / 2, d.ancho / 2, d.alto, LADOS_CILINDRO, 1);
    if (rect) remapearUv(geometria, 0, rect);
    // La textura empieza en +z; se gira media vuelta para que su centro quede de cara al pasillo.
    geometria.rotateY(Math.PI);
    return { geometria, ranuras: ['frente', 'lado', 'lado'] };
  }

  const geometria = new BoxGeometry(d.ancho, d.alto, d.fondo);
  // Orden de BoxGeometry: +x, -x, +y, -y, +z, -z.
  if (rect) remapearUv(geometria, 4, rect);
  return { geometria, ranuras: ['lado', 'lado', 'lado', 'lado', 'frente', 'lado'] };
}
