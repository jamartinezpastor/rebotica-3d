import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import {
  BoxGeometry,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type InstancedMesh,
} from 'three';
import type { GeometriaEstanteria, Pieza } from './geometria';
import { useRecurso } from './RecursosEscena';

/** Colores de la escena: blanco cálido y el verde de la cruz como único acento. */
export const COLOR_MADERA = '#efe9df';
export const COLOR_FRISO = '#0f8a4b';

const IDENTIDAD = new Quaternion();

/** Escribe cada pieza como una instancia (posición + escala) de un cubo unitario. */
function useInstancias(piezas: readonly Pieza[]) {
  const malla = useRef<InstancedMesh>(null);
  const invalidar = useThree((s) => s.invalidate);

  useLayoutEffect(() => {
    const instancias = malla.current;
    if (!instancias) return;
    const matriz = new Matrix4();
    piezas.forEach((pieza, i) => {
      matriz.compose(new Vector3(...pieza.posicion), IDENTIDAD, new Vector3(...pieza.tamano));
      instancias.setMatrixAt(i, matriz);
    });
    instancias.instanceMatrix.needsUpdate = true;
    // La escena se dibuja bajo demanda: hay que pedir un fotograma tras cambiar las instancias.
    invalidar();
  }, [piezas, invalidar]);

  return malla;
}

export interface EstanteriaProps {
  /** Resultado de `geometriaEstanteria()`; lo calcula el padre porque también coloca las cajas. */
  geometria: GeometriaEstanteria;
  receta?: boolean;
}

/**
 * Estantería de tres baldas: toda la estructura es una sola malla instanciada (laterales,
 * tableros y panel trasero) y los frisos verdes otra. Dos llamadas de dibujo por estantería.
 */
export function Estanteria({ geometria, receta = false }: EstanteriaProps) {
  const estructura = useInstancias(geometria.estructura);
  const frisos = useInstancias(geometria.frisos);
  const recursos = useRecurso(`estructura:${receta}`, () => {
    const cubo = new BoxGeometry(1, 1, 1);
    const madera = new MeshStandardMaterial({
      color: receta ? '#263442' : COLOR_MADERA,
      roughness: 0.85,
      metalness: receta ? 0.25 : 0,
    });
    const friso = new MeshStandardMaterial({
      color: receta ? '#f2b544' : COLOR_FRISO,
      roughness: 0.6,
    });
    const cristal = new MeshStandardMaterial({
      color: '#d7e4eb',
      transparent: true,
      opacity: 0.12,
      roughness: 0.45,
      depthWrite: false,
    });
    return {
      cubo,
      madera,
      friso,
      cristal,
      liberar() {
        cubo.dispose();
        madera.dispose();
        friso.dispose();
        cristal.dispose();
      },
    };
  });

  return (
    <group>
      <instancedMesh
        ref={estructura}
        args={[recursos.cubo, recursos.madera, geometria.estructura.length]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={frisos}
        args={[recursos.cubo, recursos.friso, geometria.frisos.length]}
        frustumCulled={false}
      />
      {receta && (
        <mesh
          position={[0, 0.68, 0.18]}
          scale={[1.13, 1.07, 0.008]}
          geometry={recursos.cubo}
          material={recursos.cristal}
          raycast={() => null}
        />
      )}
    </group>
  );
}
