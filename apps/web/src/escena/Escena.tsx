import { Canvas, useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import type { PerspectiveCamera } from 'three';
import { ESTANTERIA_POR_DEFECTO } from './geometria';
import { Pasillo, SEPARACION_ESTANTERIAS, type BaldaEscena } from './Pasillo';

/** Blanco del vacío: el suelo, la niebla y el fondo son del mismo color y no hay horizonte. */
export const COLOR_VACIO = '#ffffff';

const ALTURA_OJOS = 0.85;
const OBJETIVO_Y = 0.6;
/** Margen a cada lado de lo que debe caber en pantalla. */
const MARGEN = 0.2;
/** Mientras no hay raíl de cámara (F2-04) se encuadran como mucho dos estanterías. */
const SEMIANCHO_MAXIMO = 1.5;

/** Semiancho de la estantería sola, más un margen. */
export const SEMIANCHO_UNA_ESTANTERIA = ESTANTERIA_POR_DEFECTO.ancho / 2 + MARGEN;

/**
 * Aleja la cámara lo justo para que quepa `semiancho` metros a cada lado del centro, también en
 * pantallas estrechas (retrato) y sin acercarse nunca por debajo de una distancia mínima.
 */
export function distanciaCamara(
  fovVerticalGrados: number,
  aspecto: number,
  semiancho = SEMIANCHO_UNA_ESTANTERIA,
): number {
  const mitadFov = (fovVerticalGrados * Math.PI) / 360;
  const paraAncho = semiancho / (Math.tan(mitadFov) * aspecto);
  const paraAlto = 0.8 / Math.tan(mitadFov);
  return Math.max(2.6, paraAncho, paraAlto);
}

function CamaraAjustada({ semiancho }: { semiancho: number }) {
  const camera = useThree((s) => s.camera);
  const { width, height } = useThree((s) => s.size);
  const invalidar = useThree((s) => s.invalidate);

  useLayoutEffect(() => {
    const perspectiva = camera as PerspectiveCamera;
    const distancia = distanciaCamara(perspectiva.fov, width / height, semiancho);
    perspectiva.position.set(0, ALTURA_OJOS, distancia);
    perspectiva.lookAt(0, OBJETIVO_Y, 0);
    perspectiva.updateProjectionMatrix();
    invalidar();
  }, [camera, width, height, semiancho, invalidar]);

  return null;
}

function Suelo() {
  return (
    <mesh rotation-x={-Math.PI / 2}>
      <circleGeometry args={[40, 48]} />
      <meshStandardMaterial color="#ffffff" roughness={0.92} metalness={0} />
    </mesh>
  );
}

export interface EscenaProps {
  /** Baldas del pasillo, en orden; se agrupan de tres en tres en estanterías. */
  baldas?: BaldaEscena[];
}

/**
 * Vacío blanco sin horizonte: fondo y niebla del mismo color, suelo claro, luz de cielo suave
 * y una principal lateral. Pixel ratio limitado a 1,5. Se dibuja bajo demanda: solo hay
 * fotogramas mientras dura la entrada animada o cuando algo cambia.
 */
export default function Escena({ baldas = [] }: EscenaProps) {
  const estanterias = Math.max(1, Math.ceil(baldas.length / 3));
  const anchoTotal = (estanterias - 1) * SEPARACION_ESTANTERIAS + ESTANTERIA_POR_DEFECTO.ancho;
  const semiancho = Math.min(anchoTotal / 2 + MARGEN, SEMIANCHO_MAXIMO);

  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop="demand"
      // Sin tone mapping: el blanco de la escena debe ser el blanco de la página.
      flat
      // La posición la fija CamaraAjustada: R3F reaplicaría aquí `position` en cada cambio de tamaño.
      camera={{ fov: 38, near: 0.1, far: 60 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      aria-label="Estanterías en 3D"
    >
      <color attach="background" args={[COLOR_VACIO]} />
      <fog attach="fog" args={[COLOR_VACIO, 6, 18]} />
      {/* Intensidades en unidades físicas (three ≥ r155): ~π veces las del modo antiguo. */}
      <hemisphereLight args={['#ffffff', '#ece6da', 1.6]} />
      <directionalLight position={[2.5, 4, 3]} intensity={2.2} />
      <CamaraAjustada semiancho={semiancho} />
      <Suelo />
      <Pasillo baldas={baldas} />
    </Canvas>
  );
}
