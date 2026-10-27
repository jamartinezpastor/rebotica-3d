import { useLayoutEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import {
  BoxGeometry,
  Color,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type InstancedMesh,
} from 'three';
import type { ModeloEstanteria } from './Pasillo';
import type { GeometriaEstanteria } from './geometria';
import { piezasPanoramica } from './entradaPanoramica';
import { useRecurso } from './RecursosEscena';

const SIN_RAYCAST = () => null;
export function Panoramica({
  modelo,
  geometria,
}: {
  modelo: readonly ModeloEstanteria[];
  geometria: GeometriaEstanteria;
}) {
  const piezas = useMemo(() => piezasPanoramica(modelo, geometria), [modelo, geometria]);
  const malla = useRef<InstancedMesh>(null);
  const invalidar = useThree((s) => s.invalidate);
  const recursos = useRecurso('panoramica', () => {
    const cubo = new BoxGeometry(1, 1, 1);
    const material = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, fog: false });
    return {
      cubo,
      material,
      liberar() {
        cubo.dispose();
        material.dispose();
      },
    };
  });
  useLayoutEffect(() => {
    if (!malla.current) return;
    const matriz = new Matrix4();
    const posicion = new Vector3();
    const escala = new Vector3();
    const giro = new Quaternion();
    const eje = new Vector3(0, 1, 0);
    const color = new Color();
    piezas.forEach((p, i) => {
      matriz.compose(
        posicion.set(...p.posicion),
        giro.setFromAxisAngle(eje, p.giro),
        escala.set(...p.tamano),
      );
      malla.current!.setMatrixAt(i, matriz);
      malla.current!.setColorAt(i, color.set(p.color));
    });
    malla.current.instanceMatrix.needsUpdate = true;
    if (malla.current.instanceColor) malla.current.instanceColor.needsUpdate = true;
    invalidar();
  }, [piezas, invalidar]);
  return (
    <instancedMesh
      ref={malla}
      args={[recursos.cubo, recursos.material, piezas.length]}
      frustumCulled={false}
      raycast={SIN_RAYCAST}
    />
  );
}
