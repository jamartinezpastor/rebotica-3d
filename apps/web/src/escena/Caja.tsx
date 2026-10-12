import { useThree } from '@react-three/fiber';
import type { AssetCajaPublico, FormaCaja } from '@rebotica/shared';
import { useEffect, useMemo } from 'react';
import { MeshStandardMaterial } from 'three';
import { COLOR_LADO_DEFECTO } from './colores';
import { crearGeometriaCaja, type RectanguloAtlas } from './geometriaCaja';
import { UMBRAL_TOQUE } from './seleccion';
import { useAtlas } from './useAtlas';

export interface CajaProps {
  forma: FormaCaja;
  asset: AssetCajaPublico | null;
  posicion: [number, number, number];
  /** Se llama con un toque o clic limpio (no con el final de un arrastre). */
  onSeleccionar?: () => void;
}

/**
 * Una caja generada: forma según la forma farmacéutica, cara frontal del atlas KTX2 y laterales
 * con el color dominante de la foto. Mientras llega el atlas se ve con el color de los laterales.
 */
export function Caja({ forma, asset, posicion, onSeleccionar }: CajaProps) {
  const invalidar = useThree((s) => s.invalidate);
  const atlas = useAtlas(asset?.atlasUrl);
  const uv = asset?.uv;
  const colorLado = asset?.colorDominante ?? COLOR_LADO_DEFECTO;

  // `uv` es un array nuevo en cada render del padre: se compara por valor mediante su clave.
  const claveUv = uv ? uv.join(',') : '';
  const { geometria, ranuras } = useMemo(
    () =>
      crearGeometriaCaja(
        forma,
        claveUv ? (claveUv.split(',').map(Number) as unknown as RectanguloAtlas) : undefined,
      ),
    [forma, claveUv],
  );

  const materiales = useMemo(() => {
    const lado = new MeshStandardMaterial({ color: colorLado, roughness: 0.7, metalness: 0 });
    const frente = atlas
      ? new MeshStandardMaterial({ map: atlas, roughness: 0.55, metalness: 0 })
      : lado;
    return { lado, frente };
  }, [colorLado, atlas]);

  useEffect(() => {
    invalidar();
    return () => {
      geometria.dispose();
    };
  }, [geometria, invalidar]);

  useEffect(
    () => () => {
      materiales.lado.dispose();
      if (materiales.frente !== materiales.lado) materiales.frente.dispose();
    },
    [materiales],
  );

  const lista = ranuras.map((r) => (r === 'frente' ? materiales.frente : materiales.lado));
  return (
    <mesh
      position={posicion}
      geometry={geometria}
      material={lista}
      onClick={
        onSeleccionar
          ? (e) => {
              // R3F informa de cuánto se movió el puntero entre pulsar y soltar.
              if (e.delta > UMBRAL_TOQUE) return;
              e.stopPropagation();
              onSeleccionar();
            }
          : undefined
      }
    />
  );
}
