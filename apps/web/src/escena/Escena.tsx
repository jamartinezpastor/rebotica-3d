import { Canvas, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import type { PerspectiveCamera } from 'three';
import { CanvasTexture, LinearFilter } from 'three';
import type { ProductoResumen } from '@rebotica/shared';
import { Caja } from './Caja';
import { colocarCajas } from './cajas';
import { Estanteria } from './Estanteria';
import { geometriaEstanteria } from './geometria';

/** Blanco del vacío: el suelo, la niebla y el fondo son del mismo color y no hay horizonte. */
export const COLOR_VACIO = '#ffffff';

/** Sombra de contacto falsa (plan §Rendimiento: sin sombras en tiempo real). */
function useTexturaSombra() {
  return useMemo(() => {
    const lado = 128;
    const lienzo = document.createElement('canvas');
    lienzo.width = lado;
    lienzo.height = lado;
    const ctx = lienzo.getContext('2d');
    if (ctx) {
      const gradiente = ctx.createRadialGradient(
        lado / 2,
        lado / 2,
        0,
        lado / 2,
        lado / 2,
        lado / 2,
      );
      gradiente.addColorStop(0, 'rgba(29,36,32,0.38)');
      gradiente.addColorStop(0.6, 'rgba(29,36,32,0.12)');
      gradiente.addColorStop(1, 'rgba(29,36,32,0)');
      ctx.fillStyle = gradiente;
      ctx.fillRect(0, 0, lado, lado);
    }
    const textura = new CanvasTexture(lienzo);
    textura.minFilter = LinearFilter;
    textura.generateMipmaps = false;
    return textura;
  }, []);
}

/** Semiancho que debe caber en pantalla: la estantería más un margen. */
const SEMIANCHO_VISIBLE = 0.78;
const ALTURA_OJOS = 0.85;
const OBJETIVO_Y = 0.6;

/** Aleja la cámara lo justo para que la estantería quepa a lo ancho en pantallas estrechas. */
export function distanciaCamara(fovVerticalGrados: number, aspecto: number): number {
  const mitadFov = (fovVerticalGrados * Math.PI) / 360;
  const paraAncho = SEMIANCHO_VISIBLE / (Math.tan(mitadFov) * aspecto);
  const paraAlto = 0.8 / Math.tan(mitadFov);
  return Math.max(2.6, paraAncho, paraAlto);
}

function CamaraAjustada() {
  const camera = useThree((s) => s.camera);
  const { width, height } = useThree((s) => s.size);
  const invalidar = useThree((s) => s.invalidate);

  useLayoutEffect(() => {
    const perspectiva = camera as PerspectiveCamera;
    const distancia = distanciaCamara(perspectiva.fov, width / height);
    perspectiva.position.set(0, ALTURA_OJOS, distancia);
    perspectiva.lookAt(0, OBJETIVO_Y, 0);
    perspectiva.updateProjectionMatrix();
    invalidar();
  }, [camera, width, height, invalidar]);

  return null;
}

function Suelo() {
  const sombra = useTexturaSombra();
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <circleGeometry args={[40, 48]} />
        <meshStandardMaterial color="#ffffff" roughness={0.92} metalness={0} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0]}>
        <planeGeometry args={[2.1, 0.9]} />
        <meshBasicMaterial map={sombra} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

export interface EscenaProps {
  /** Productos que se colocan en las baldas, de izquierda a derecha y de arriba abajo. */
  productos?: ProductoResumen[];
}

/**
 * Vacío blanco sin horizonte: fondo y niebla del mismo color, suelo claro, luz de cielo suave
 * y una principal lateral. Pixel ratio limitado a 1,5 y dibujo bajo demanda (la ficha no anima).
 */
export default function Escena({ productos = [] }: EscenaProps) {
  const geometria = useMemo(() => geometriaEstanteria(), []);
  const { colocadas } = useMemo(
    () => colocarCajas(geometria.huecos, productos),
    [geometria, productos],
  );

  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop="demand"
      // Sin tone mapping: el blanco de la escena debe ser el blanco de la página.
      flat
      // La posición la fija CamaraAjustada: R3F reaplicaría aquí `position` en cada cambio de tamaño.
      camera={{ fov: 38, near: 0.1, far: 60 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      aria-label="Estantería en 3D"
    >
      <color attach="background" args={[COLOR_VACIO]} />
      <fog attach="fog" args={[COLOR_VACIO, 6, 18]} />
      {/* Intensidades en unidades físicas (three ≥ r155): ~π veces las del modo antiguo. */}
      <hemisphereLight args={['#ffffff', '#ece6da', 1.6]} />
      <directionalLight position={[2.5, 4, 3]} intensity={2.2} />
      <CamaraAjustada />
      <Suelo />
      <Estanteria geometria={geometria} />
      {colocadas.map((c) => (
        <Caja key={c.item.nregistro} forma={c.forma} asset={c.item.asset} posicion={c.posicion} />
      ))}
    </Canvas>
  );
}
