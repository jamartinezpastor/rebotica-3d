import { Canvas } from '@react-three/fiber';
import type { ProductoResumen } from '@rebotica/shared';
import { Pasillo, type BaldaEscena } from './Pasillo';

/** Blanco del vacío: el suelo, la niebla y el fondo son del mismo color y no hay horizonte. */
export const COLOR_VACIO = '#ffffff';

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
  /** `nregistro` del producto abierto en la ficha; null en el pasillo. */
  seleccionada?: string | null;
  onSeleccionar?: (producto: ProductoResumen) => void;
}

/**
 * Vacío blanco sin horizonte: fondo y niebla del mismo color, suelo claro, luz de cielo suave
 * y una principal lateral. Pixel ratio limitado a 1,5. Se dibuja bajo demanda: solo hay
 * fotogramas mientras dura la entrada animada, el movimiento de la cámara o cuando algo cambia.
 * La cámara la gobierna `RielCamara` (dentro de `Pasillo`).
 */
export default function Escena({ baldas = [], seleccionada = null, onSeleccionar }: EscenaProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop="demand"
      // Sin tone mapping: el blanco de la escena debe ser el blanco de la página.
      flat
      // Posición y orientación las fija RielCamara en cada fotograma.
      camera={{ fov: 38, near: 0.1, far: 60 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={[COLOR_VACIO]} />
      <fog attach="fog" args={[COLOR_VACIO, 6, 18]} />
      {/* Intensidades en unidades físicas (three ≥ r155): ~π veces las del modo antiguo. */}
      <hemisphereLight args={['#ffffff', '#ece6da', 1.6]} />
      <directionalLight position={[2.5, 4, 3]} intensity={2.2} />
      <Suelo />
      <Pasillo baldas={baldas} seleccionada={seleccionada} onSeleccionar={onSeleccionar} />
    </Canvas>
  );
}
