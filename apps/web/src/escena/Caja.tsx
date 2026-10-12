import { useThree } from '@react-three/fiber';
import type { AssetCajaPublico, FormaCaja } from '@rebotica/shared';
import { useEffect, useMemo } from 'react';
import { MeshStandardMaterial } from 'three';
import { crearGeometriaCaja, type RectanguloAtlas } from './geometriaCaja';
import { useAtlas } from './useAtlas';

/** Color de los laterales cuando no hay foto de la que sacarlo. */
export const COLOR_LADO_DEFECTO = '#ddd6c8';

export interface CajaProps {
  forma: FormaCaja;
  asset: AssetCajaPublico | null;
  posicion: [number, number, number];
}

/**
 * Una caja generada: forma según la forma farmacéutica, cara frontal del atlas KTX2 y laterales
 * con el color dominante de la foto. Mientras llega el atlas se ve con el color de los laterales.
 */
export function Caja({ forma, asset, posicion }: CajaProps) {
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
  return <mesh position={posicion} geometry={geometria} material={lista} />;
}
