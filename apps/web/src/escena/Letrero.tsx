import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';
import { avance, textoDescifrado } from './animacion';

const ANCHO_PX = 512;
const ALTO_PX = 96;
/** Tamaño del cartel en metros (misma proporción que el lienzo). */
export const LETRERO_ANCHO = 0.62;
export const LETRERO_ALTO = (LETRERO_ANCHO * ALTO_PX) / ANCHO_PX;

const VERDE = '#0f8a4b';
const VERDE_CLARO = '#8fd3ac';

function dibujar(ctx: CanvasRenderingContext2D, texto: string, fijos: number) {
  ctx.clearRect(0, 0, ANCHO_PX, ALTO_PX);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ANCHO_PX, ALTO_PX);
  ctx.strokeStyle = VERDE;
  ctx.lineWidth = 5;
  ctx.strokeRect(2.5, 2.5, ANCHO_PX - 5, ALTO_PX - 5);

  // Monoespaciada para que cada carácter conserve su casilla mientras se descifra.
  const n = Math.max(texto.length, 1);
  const tamano = Math.min(44, (ANCHO_PX - 40) / (n * 0.6));
  ctx.font = `bold ${tamano}px ui-monospace, Consolas, "Courier New", monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const ancho = tamano * 0.6;
  const x0 = (ANCHO_PX - ancho * n) / 2;
  for (let i = 0; i < texto.length; i++) {
    ctx.fillStyle = i < fijos ? VERDE : VERDE_CLARO;
    ctx.fillText(texto[i] ?? '', x0 + i * ancho, ALTO_PX / 2 + 2);
  }
}

/** Lienzo y textura de un cartel; las mutaciones viven aquí, fuera del render de React. */
function crearCartel() {
  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO_PX;
  lienzo.height = ALTO_PX;
  const textura = new CanvasTexture(lienzo);
  textura.colorSpace = SRGBColorSpace;
  textura.minFilter = LinearFilter;
  textura.generateMipmaps = false;
  // Último estado dibujado: evita redibujar el texto final en cada fotograma.
  let dibujado: { texto: string; semilla: number; fijos: number } | null = null;

  return {
    textura,
    /** Redibuja solo si algo ha cambiado desde el último fotograma. */
    actualizar(objetivo: string, progreso: number, semilla: number) {
      const { texto: visible, descifrados } = textoDescifrado(objetivo, progreso, semilla);
      const fijos = progreso < 1 ? descifrados : visible.length;
      if (dibujado && dibujado.texto === visible && dibujado.fijos === fijos) return;
      const ctx = lienzo.getContext('2d');
      if (!ctx) return;
      dibujar(ctx, visible, fijos);
      textura.needsUpdate = true;
      dibujado = { texto: visible, semilla, fijos };
    },
    liberar() {
      textura.dispose();
    },
  };
}

export interface LetreroProps {
  texto: string;
  posicion: [number, number, number];
  /** Segundos de la entrada en los que empieza a descifrarse y lo que dura. */
  inicio: number;
  duracion: number;
  /** Tiempo transcurrido desde el comienzo de la entrada (compartido con el resto de la escena). */
  reloj: () => number;
}

/**
 * Cartel de una balda. Mientras entra, los caracteres verdes se «descifran» de izquierda a
 * derecha hasta formar el nombre del grupo (guiño al Matrix del plan). Al terminar queda el
 * texto fijo; con «menos movimiento» el reloj ya viene completo y nace descifrado.
 */
export function Letrero({ texto, posicion, inicio, duracion, reloj }: LetreroProps) {
  const cartel = useMemo(() => crearCartel(), []);

  useEffect(() => () => cartel.liberar(), [cartel]);

  useFrame(() => {
    const t = reloj();
    const progreso = avance(t, inicio, duracion);
    // Mientras dura el efecto los glifos cambian unas 30 veces por segundo.
    cartel.actualizar(texto, progreso, progreso < 1 ? Math.floor(t * 30) : 1);
  });

  return (
    <mesh position={posicion}>
      <planeGeometry args={[LETRERO_ANCHO, LETRERO_ALTO]} />
      <meshBasicMaterial map={cartel.textura} toneMapped={false} />
    </mesh>
  );
}
