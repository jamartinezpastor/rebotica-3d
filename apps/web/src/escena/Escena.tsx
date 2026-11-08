import { Canvas, useFrame } from '@react-three/fiber';
import type { ProductoResumen } from '@rebotica/shared';
import type { EstadisticasFps } from './medidorFps';
import { Pasillo, type BaldaEscena } from './Pasillo';
import { Rendimiento } from './Rendimiento';
import { Cursor3D } from './Cursor3D';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Vector3, type PerspectiveCamera } from 'three';
import { RecursosEscena } from './RecursosEscena';
import { FondoFarmacia } from './FondoFarmacia';
import { useMenosMovimiento } from '../useMenosMovimiento';
import { camaraFondo } from './camaraFondo';

/** Blanco de la niebla delante del ambiente lejano. */
export const COLOR_VACIO = '#ffffff';

function SincronizarFondo({ referencia }: { referencia: RefObject<HTMLDivElement | null> }) {
  const direccion = useRef(new Vector3());
  useFrame(({ camera, size }) => {
    const raiz = referencia.current;
    if (!raiz) return;
    camera.getWorldDirection(direccion.current);
    const d = direccion.current;
    const estilo = camaraFondo({
      giro: Math.atan2(-d.x, -d.z),
      inclinacion: Math.asin(d.y),
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      alto: size.height,
      fov: (camera as PerspectiveCamera).fov,
    });
    raiz.style.setProperty('--perspectiva-farmacia', estilo.perspectiva);
    raiz.style.setProperty('--camara-farmacia', estilo.transformacion);
  });
  return null;
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
  destino?: { registro: string };
  onMirar?: (registro: string) => void;
  calidadInicial?: 'normal' | 'ligera';
  introduccion?: boolean;
  onIntroduccionTerminada?: () => void;
}

/**
 * Ambiente decorativo envolvente y desenfocado, niebla, luz de cielo suave
 * y una principal lateral. Pixel ratio limitado a 1,5. El 3D se dibuja bajo demanda: solo hay
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
  destino,
  onMirar,
  calidadInicial = 'normal',
  introduccion = false,
  onIntroduccionTerminada,
}: EscenaProps) {
  const [reducida, setReducida] = useState(calidadInicial === 'ligera');
  const menosMovimiento = useMenosMovimiento();
  const fondo = useRef<HTMLDivElement>(null);
  const permiteAmbiente = !reducida && !menosMovimiento && !seleccionada;
  useEffect(() => {
    if (introduccion && menosMovimiento) onIntroduccionTerminada?.();
  }, [introduccion, menosMovimiento, onIntroduccionTerminada]);
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      data-panoramica={introduccion && !menosMovimiento}
    >
      <FondoFarmacia animado={permiteAmbiente} referencia={fondo} />
      <Canvas
        className="entrada-resultados"
        dpr={reducida ? [0.75, 1] : [1, 1.5]}
        frameloop="demand"
        // Sin tone mapping: el blanco de la escena debe ser el blanco de la página.
        flat
        // Posición y orientación las fija RielCamara en cada fotograma.
        camera={{ fov: 38, near: 0.1, far: 60 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      >
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
        <RecursosEscena>
          <Pasillo
            baldas={baldas}
            seleccionada={seleccionada}
            onSeleccionar={onSeleccionar}
            registroInicial={registroInicial}
            destino={destino}
            onMirar={onMirar}
            ligera={reducida}
            introduccion={introduccion && !menosMovimiento}
            onIntroduccionTerminada={onIntroduccionTerminada}
          />
        </RecursosEscena>
        <SincronizarFondo referencia={fondo} />
      </Canvas>
    </div>
  );
}
