import { Canvas } from '@react-three/fiber';
import type { ProductoResumen } from '@rebotica/shared';
import type { EstadisticasFps } from './medidorFps';
import { Pasillo, type BaldaEscena } from './Pasillo';
import { Rendimiento } from './Rendimiento';
import { Cursor3D } from './Cursor3D';
import { useState } from 'react';
import { RecursosEscena } from './RecursosEscena';

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
  /** Estadísticas de fotogramas, para el contador de medición (`?fps=1`). */
  onFps?: (estadisticas: EstadisticasFps) => void;
  /** Aviso único cuando la escena va por debajo de 24 fps sostenidos. */
  onLento?: () => void;
  registroInicial?: string | null;
  onMirar?: (registro: string) => void;
  calidadInicial?: 'normal' | 'ligera';
}

/**
 * Vacío blanco sin horizonte: fondo y niebla del mismo color, suelo claro, luz de cielo suave
 * y una principal lateral. Pixel ratio limitado a 1,5. Se dibuja bajo demanda: solo hay
 * fotogramas mientras dura la entrada animada, el movimiento de la cámara o cuando algo cambia.
 * La cámara la gobierna `RielCamara` (dentro de `Pasillo`).
 */
export default function Escena({
  baldas = [],
  seleccionada = null,
  onSeleccionar,
  onFps,
  onLento,
  registroInicial,
  onMirar,
  calidadInicial = 'normal',
}: EscenaProps) {
  const [reducida, setReducida] = useState(calidadInicial === 'ligera');
  return (
    <Canvas
      className="entrada-resultados"
      dpr={reducida ? [0.75, 1] : [1, 1.5]}
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
      <directionalLight position={[2.5, 4, 4]} intensity={1.9} />
      <Rendimiento
        onFps={onFps}
        onLento={() => {
          setReducida(true);
          onLento?.();
        }}
      />
      <Cursor3D />
      <Suelo />
      <RecursosEscena>
        <Pasillo
          baldas={baldas}
          seleccionada={seleccionada}
          onSeleccionar={onSeleccionar}
          registroInicial={registroInicial}
          onMirar={onMirar}
          ligera={reducida}
        />
      </RecursosEscena>
    </Canvas>
  );
}
