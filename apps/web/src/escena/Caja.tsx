import { useThree } from '@react-three/fiber';
import type { FormaCaja } from '@rebotica/shared';
import { useEffect, useId } from 'react';
import {
  CanvasTexture,
  LinearFilter,
  MeshStandardMaterial,
  SRGBColorSpace,
  type WebGLRenderer,
} from 'three';
import {
  dibujarCara,
  dibujarEnvolvente,
  tamanoCara,
  type Calidad,
  type DatosEnvase,
} from './arteEnvase';
import { crearGeometriaCaja, medidasCara, ranurasCaja } from './geometriaCaja';
import type { CacheRecursos } from './cacheRecursos';
import { UMBRAL_TOQUE } from './seleccion';
import { marcarMedicamento } from './cursorMedicamento';
import { useRecurso } from './RecursosEscena';

/** Dibuja una cara en su propio lienzo y la convierte en textura. */
function texturaDe(
  forma: FormaCaja,
  ranura: ReturnType<typeof crearGeometriaCaja>['ranuras'][number],
  datos: DatosEnvase,
  calidad: Calidad,
): CanvasTexture {
  const medidas = medidasCara(forma, ranura);
  const { ancho, alto } = tamanoCara(medidas.ancho, medidas.alto, calidad);
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  if (ctx) {
    if (ranura === 'lateral') dibujarEnvolvente(ctx, ancho, alto, datos);
    else dibujarCara(ctx, ranura, ancho, alto, datos);
  }
  const textura = new CanvasTexture(lienzo);
  textura.colorSpace = SRGBColorSpace;
  textura.minFilter = LinearFilter;
  textura.generateMipmaps = false;
  textura.anisotropy = calidad === 'ligera' ? 1 : 4;
  return textura;
}

/** Geometría, texturas y materiales de una caja; las mutaciones viven aquí, fuera del render. */
function construirMateriales(
  forma: FormaCaja,
  ranuras: ReturnType<typeof crearGeometriaCaja>['ranuras'],
  datos: DatosEnvase,
  calidad: Calidad,
) {
  const texturas = ranuras.map((r) => texturaDe(forma, r, datos, calidad));
  const materiales = texturas.map(
    (map) => new MeshStandardMaterial({ map, roughness: 0.62, metalness: 0 }),
  );
  return {
    materiales,
    texturas,
    liberar() {
      materiales.forEach((m) => m.dispose());
      texturas.forEach((t) => t.dispose());
    },
  };
}

export function claveEnvase(forma: FormaCaja, datos: DatosEnvase, calidad: Calidad): string {
  return `envase:${forma}:${calidad}:${JSON.stringify(datos)}`;
}

/** Reserva compartida: el montaje posterior reutiliza también las texturas ya subidas a GPU. */
export function precargarEnvase(
  cache: CacheRecursos,
  gl: WebGLRenderer,
  forma: FormaCaja,
  datos: DatosEnvase,
  calidad: Calidad,
): () => void {
  const clave = claveEnvase(forma, datos, calidad);
  const caja = cache.obtener(clave, () =>
    construirMateriales(forma, ranurasCaja(forma), datos, calidad),
  );
  cache.retener(clave);
  try {
    caja.texturas.forEach((t) => gl.initTexture(t));
  } catch (error) {
    cache.soltar(clave);
    throw error;
  }
  return () => cache.soltar(clave);
}

export interface CajaProps {
  forma: FormaCaja;
  datos: DatosEnvase;
  /** `estanteria`: poca resolución, muchas cajas; `ficha`: la máxima, una sola caja. */
  calidad?: Calidad;
  posicion: [number, number, number];
  /** Se llama con un toque o clic limpio (no con el final de un arrastre). */
  onSeleccionar?: () => void;
}

/**
 * Una caja generada: forma según la forma farmacéutica y las seis caras dibujadas con los datos
 * del producto y los colores de su envase. Frente: nombre, principio activo, dosis y forma.
 * Trasera: ficha con laboratorio y categoría. Laterales, tapa y base: nombre, dosis, laboratorio…
 */
export function Caja({ forma, datos, calidad = 'estanteria', posicion, onSeleccionar }: CajaProps) {
  const invalidar = useThree((s) => s.invalidate);
  const lienzo = useThree((s) => s.gl.domElement);
  const idCursor = useId();
  const seleccionable = !!onSeleccionar;
  useEffect(
    () => () => marcarMedicamento(lienzo, idCursor, false),
    [lienzo, idCursor, seleccionable],
  );
  // Los datos cambian de identidad en cada render del padre: se comparan por valor.
  const clave = claveEnvase(forma, datos, calidad);

  const formaCompartida = useRecurso(`geometria:${forma}`, () => {
    const valor = crearGeometriaCaja(forma);
    return { ...valor, liberar: () => valor.geometria.dispose() };
  });
  const caja = useRecurso(clave, () =>
    construirMateriales(forma, formaCompartida.ranuras, datos, calidad),
  );

  useEffect(() => {
    invalidar();
  }, [caja, invalidar]);

  return (
    <mesh
      position={posicion}
      dispose={null}
      geometry={formaCompartida.geometria}
      material={caja.materiales}
      onPointerOver={
        onSeleccionar
          ? (e) => {
              if (e.pointerType !== 'mouse') return;
              e.stopPropagation();
              marcarMedicamento(lienzo, idCursor, true);
              invalidar();
            }
          : undefined
      }
      onPointerOut={
        onSeleccionar
          ? () => {
              marcarMedicamento(lienzo, idCursor, false);
              invalidar();
            }
          : undefined
      }
      onClick={
        onSeleccionar
          ? (e) => {
              // R3F informa de cuánto se movió el puntero entre pulsar y soltar.
              if (e.delta > UMBRAL_TOQUE) return;
              e.stopPropagation();
              onSeleccionar();
            }
          : undefined
      }
    />
  );
}
