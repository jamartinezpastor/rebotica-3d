import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { MedidorFps, esLento, type EstadisticasFps } from './medidorFps';

/** Fotogramas consecutivos que se miden antes de dar un aviso de lentitud. */
const VENTANA_AVISO = 45;
/** Cada cuántos fotogramas se publican las estadísticas (para no repintar el DOM a 60 Hz). */
const CADA_N = 15;

export interface RendimientoProps {
  /** Estadísticas periódicas (para el contador de `?fps=1`). */
  onFps?: (e: EstadisticasFps) => void;
  /** Una sola vez: la escena va por debajo de 24 fps sostenidos. */
  onLento?: () => void;
}

/**
 * Mide los fotogramas reales de la escena. Vive dentro del lienzo y no dibuja nada: solo lee el
 * `delta` de cada fotograma. Las pausas del dibujo bajo demanda no cuentan como lentitud.
 */
export function Rendimiento({ onFps, onLento }: RendimientoProps) {
  const medidor = useMemo(() => new MedidorFps({ ventana: 60 }), []);

  useFrame((_, delta) => {
    medidor.registrar(delta);
    if (medidor.total % CADA_N !== 0) return;
    const e = medidor.estadisticas();
    if (!e) return;
    onFps?.(e);
    if (e.muestras >= VENTANA_AVISO && esLento(e) && medidor.primerAviso()) onLento?.();
  });

  return null;
}
