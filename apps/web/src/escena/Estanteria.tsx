import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  Matrix4,
  MeshStandardMaterial,
  MeshBasicMaterial,
  PlaneGeometry,
  TorusGeometry,
  Quaternion,
  Vector3,
  type InstancedMesh,
} from 'three';
import type { GeometriaEstanteria, Pieza } from './geometria';
import { useRecurso } from './RecursosEscena';
import { geometriaVitrina } from './vitrina';

/** Colores de la escena: blanco cálido y el verde de la cruz como único acento. */
export const COLOR_MADERA = '#efe9df';
export const COLOR_FRISO = '#0f8a4b';

const IDENTIDAD = new Quaternion();
const VACIO: Pieza[] = [];
const SIN_RAYCAST = () => null;

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
 * tableros y panel trasero) y los frisos verdes otra. La vitrina añade puertas y herrajes.
 */
export function Estanteria({ geometria, receta = false }: EstanteriaProps) {
  const estructura = useInstancias(geometria.estructura);
  const frisos = useInstancias(geometria.frisos);
  const vitrina = useMemo(() => (receta ? geometriaVitrina(geometria) : null), [receta, geometria]);
  const marco = useInstancias(vitrina?.marco ?? VACIO);
  const puertas = useInstancias(vitrina?.puertas ?? VACIO);
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
      opacity: 0.09,
      roughness: 0.12,
      metalness: 0.2,
      depthWrite: false,
    });
    const metal = new MeshStandardMaterial({ color: '#b6c2c8', metalness: 0.75, roughness: 0.25 });
    const reflejo = new MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    const plano = receta ? new PlaneGeometry(1, 1) : null;
    const arco = receta ? new TorusGeometry(0.014, 0.0035, 6, 12, Math.PI) : null;
    return {
      cubo,
      madera,
      friso,
      cristal,
      metal,
      reflejo,
      plano,
      arco,
      liberar() {
        cubo.dispose();
        madera.dispose();
        friso.dispose();
        cristal.dispose();
        metal.dispose();
        reflejo.dispose();
        plano?.dispose();
        arco?.dispose();
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
      {vitrina && (
        <group>
          <instancedMesh
            ref={puertas}
            args={[recursos.cubo, recursos.cristal, vitrina.puertas.length]}
            raycast={SIN_RAYCAST}
            renderOrder={1}
          />
          <instancedMesh
            ref={marco}
            args={[recursos.cubo, recursos.metal, vitrina.marco.length]}
            raycast={SIN_RAYCAST}
          />
          {[-1, 1].map((lado) => (
            <mesh
              key={lado}
              geometry={recursos.plano ?? undefined}
              material={recursos.reflejo}
              position={[
                vitrina.cx + lado * vitrina.ancho * 0.28,
                vitrina.cy,
                vitrina.frente + 0.004,
              ]}
              rotation-z={-0.12}
              scale={[0.022, vitrina.alto * 0.84, 1]}
              raycast={SIN_RAYCAST}
              renderOrder={2}
            />
          ))}
          <mesh
            geometry={recursos.arco ?? undefined}
            material={recursos.friso}
            position={[vitrina.cx, vitrina.cy + 0.033, vitrina.frente + 0.045]}
            raycast={SIN_RAYCAST}
          />
          <mesh
            geometry={recursos.cubo}
            material={recursos.friso}
            position={[vitrina.cx, vitrina.cy + 0.015, vitrina.frente + 0.045]}
            scale={[0.032, 0.026, 0.013]}
            raycast={SIN_RAYCAST}
          />
        </group>
      )}
    </group>
  );
}
