import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three';
import { geometriaEstanteria, type ParametrosEstanteria, type Pieza } from './geometria';

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
  parametros?: Partial<ParametrosEstanteria>;
  posicion?: [number, number, number];
}

/**
 * Estantería de tres baldas: toda la estructura es una sola malla instanciada (laterales,
 * tableros y panel trasero) y los frisos verdes otra. Dos llamadas de dibujo por estantería.
 */
export function Estanteria({ parametros, posicion = [0, 0, 0] }: EstanteriaProps) {
  const geometria = useMemo(() => geometriaEstanteria(parametros), [parametros]);
  const estructura = useInstancias(geometria.estructura);
  const frisos = useInstancias(geometria.frisos);

  return (
    <group position={posicion}>
      <instancedMesh
        ref={estructura}
        args={[undefined, undefined, geometria.estructura.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLOR_MADERA} roughness={0.85} metalness={0} />
      </instancedMesh>
      <instancedMesh
        ref={frisos}
        args={[undefined, undefined, geometria.frisos.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={COLOR_FRISO} roughness={0.6} metalness={0} />
      </instancedMesh>
    </group>
  );
}
