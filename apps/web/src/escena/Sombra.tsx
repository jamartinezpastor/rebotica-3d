import { useMemo } from 'react';
import { CanvasTexture, LinearFilter } from 'three';

/**
 * Sombra de contacto falsa bajo una estantería (plan §Rendimiento: sin sombras en tiempo real).
 * Va dentro del grupo de la estantería para moverse con ella durante la entrada.
 */
function crearTextura(): CanvasTexture {
  const lado = 128;
  const lienzo = document.createElement('canvas');
  lienzo.width = lado;
  lienzo.height = lado;
  const ctx = lienzo.getContext('2d');
  if (ctx) {
    const gradiente = ctx.createRadialGradient(lado / 2, lado / 2, 0, lado / 2, lado / 2, lado / 2);
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
}

export interface SombraProps {
  ancho: number;
  fondo: number;
}

export function Sombra({ ancho, fondo }: SombraProps) {
  const textura = useMemo(() => crearTextura(), []);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0]}>
      <planeGeometry args={[ancho * 1.75, fondo * 2.6]} />
      <meshBasicMaterial map={textura} transparent depthWrite={false} />
    </mesh>
  );
}
