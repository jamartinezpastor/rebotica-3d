import { useFrame, useThree } from '@react-three/fiber';
import type { ProductoResumen } from '@rebotica/shared';
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import { avance, muelle, planificarEntrada } from './animacion';
import { Caja } from './Caja';
import { colocarCajas, type CajaColocada } from './cajas';
import { Estanteria } from './Estanteria';
import { ESTANTERIA_POR_DEFECTO, geometriaEstanteria, type GeometriaEstanteria } from './geometria';
import { Letrero, LETRERO_ALTO } from './Letrero';
import { Sombra } from './Sombra';

/** Una balda del pasillo: su título (principio activo) y los productos que lleva. */
export interface BaldaEscena {
  titulo: string;
  productos: ProductoResumen[];
}

/** Baldas por estantería: el plan usa estanterías de tres baldas. */
export const BALDAS_POR_ESTANTERIA = 3;
/** Separación entre estanterías contiguas, de centro a centro. */
export const SEPARACION_ESTANTERIAS = 1.4;

interface ModeloEstanteria {
  indice: number;
  posicion: [number, number, number];
  /** Desde dónde llega: alterna el fondo del pasillo y cada lateral. */
  origen: [number, number, number];
  baldas: { titulo: string; hueco: number }[];
  cajas: CajaColocada<ProductoResumen>[];
}

const DISTANCIA_FONDO = 9;
const DISTANCIA_LATERAL = 7;
const ALTURA_CAIDA = 0.35;

function trocear<T>(lista: readonly T[], n: number): T[][] {
  const trozos: T[][] = [];
  for (let i = 0; i < lista.length; i += n) trozos.push(lista.slice(i, i + n));
  return trozos;
}

/** Posiciones de reposo y orígenes de entrada de todas las estanterías. */
export function modeloPasillo(
  baldas: readonly BaldaEscena[],
  geometria: GeometriaEstanteria,
): ModeloEstanteria[] {
  const grupos = trocear(baldas, BALDAS_POR_ESTANTERIA);
  return grupos.map((grupo, indice) => {
    const x = (indice - (grupos.length - 1) / 2) * SEPARACION_ESTANTERIAS;
    // 0: del fondo; 1: del lateral izquierdo; 2: del fondo; 3: del lateral derecho…
    const lado = indice % 4 === 1 ? -1 : 1;
    const origen: [number, number, number] =
      indice % 2 === 0 ? [0, 0, -DISTANCIA_FONDO] : [lado * DISTANCIA_LATERAL, 0, 0];
    const cajas: CajaColocada<ProductoResumen>[] = [];
    grupo.forEach((balda, k) => {
      const hueco = geometria.huecos[k];
      if (!hueco) return;
      cajas.push(
        ...colocarCajas([hueco], balda.productos).colocadas.map((c) => ({ ...c, balda: k })),
      );
    });
    return {
      indice,
      posicion: [x, 0, 0],
      origen,
      baldas: grupo.map((b, k) => ({ titulo: b.titulo, hueco: k })),
      cajas,
    };
  });
}

/** `prefers-reduced-motion`: la escena nace ya montada, sin entrada animada. */
function useMenosMovimiento(): boolean {
  return useMemo(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
}

export interface PasilloProps {
  baldas: readonly BaldaEscena[];
}

/**
 * Pasillo de estanterías con la entrada tipo «Constructo»: cada estantería llega desde el fondo
 * o desde un lateral y frena con un muelle; después las cajas caen a su hueco una a una y los
 * letreros se descifran. Todo el movimiento se calcula aquí con una sola línea de tiempo.
 */
export function Pasillo({ baldas }: PasilloProps) {
  const invalidar = useThree((s) => s.invalidate);
  const menosMovimiento = useMenosMovimiento();
  const geometria = useMemo(() => geometriaEstanteria(), []);
  const modelo = useMemo(() => modeloPasillo(baldas, geometria), [baldas, geometria]);
  const plan = useMemo(() => planificarEntrada(modelo.map((m) => m.cajas.length)), [modelo]);

  const t0 = useRef<number | null>(null);
  const reloj = useCallback(() => {
    if (menosMovimiento) return 1e6;
    if (t0.current === null) t0.current = performance.now();
    return (performance.now() - t0.current) / 1000;
  }, [menosMovimiento]);

  const grupos = useRef<(Group | null)[]>([]);
  const cajas = useRef<(Group | null)[][]>([]);
  const estelas = useRef<(Group | null)[]>([]);

  // Un fotograma al montar o al cambiar los datos; después la animación se pide a sí misma.
  useLayoutEffect(() => {
    t0.current = performance.now();
    invalidar();
  }, [modelo, invalidar]);

  useFrame(() => {
    const t = reloj();
    modelo.forEach((est, i) => {
      const tramo = plan.estanterias[i];
      const grupo = grupos.current[i];
      if (!tramo || !grupo) return;

      const k = muelle(t - tramo.inicio, { sobreimpulso: 0.04, asentamiento: tramo.duracion });
      const resto = 1 - k;
      grupo.visible = t >= tramo.inicio;
      grupo.position.set(
        est.posicion[0] + est.origen[0] * resto,
        est.posicion[1],
        est.posicion[2] + est.origen[2] * resto,
      );

      // Estela de velocidad: barras claras detrás de la estantería mientras se mueve.
      const estela = estelas.current[i];
      if (estela) {
        const fuerza =
          Math.max(0, Math.min(1, Math.abs(resto) * 1.6)) *
          (1 - avance(t, tramo.inicio, tramo.duracion) * 0.4);
        estela.visible = fuerza > 0.01;
        estela.children.forEach((hijo) => {
          const material = (hijo as Mesh).material as MeshBasicMaterial;
          material.opacity = 0.35 * fuerza;
        });
      }

      est.cajas.forEach((_, j) => {
        const caja = cajas.current[i]?.[j];
        const tramoCaja = plan.cajas[i]?.[j];
        const colocada = est.cajas[j];
        if (!caja || !tramoCaja || !colocada) return;
        const c = muelle(t - tramoCaja.inicio, {
          sobreimpulso: 0.06,
          asentamiento: tramoCaja.duracion,
        });
        caja.visible = t >= tramoCaja.inicio;
        caja.position.set(
          colocada.posicion[0],
          colocada.posicion[1] + ALTURA_CAIDA * (1 - c),
          colocada.posicion[2],
        );
      });
    });

    if (t < plan.total + 0.1) invalidar();
  });

  return (
    <group>
      {modelo.map((est, i) => {
        const tramo = plan.estanterias[i];
        const horizontal = est.origen[0] !== 0;
        return (
          <group
            key={est.indice}
            ref={(g) => {
              grupos.current[i] = g;
            }}
            position={[
              est.posicion[0] + est.origen[0],
              est.posicion[1],
              est.posicion[2] + est.origen[2],
            ]}
            visible={menosMovimiento}
          >
            <Estanteria geometria={geometria} />
            <Sombra ancho={ESTANTERIA_POR_DEFECTO.ancho} fondo={ESTANTERIA_POR_DEFECTO.fondo} />

            <group
              ref={(g) => {
                estelas.current[i] = g;
              }}
              visible={false}
            >
              {[0.35, 0.95, 1.5].map((y) => (
                <mesh
                  key={y}
                  position={horizontal ? [Math.sign(est.origen[0]) * 1.2, y, 0.05] : [0, y, -1.4]}
                  scale={horizontal ? [2.4, 0.012, 0.012] : [0.012, 0.012, 2.4]}
                >
                  <boxGeometry args={[1, 1, 1]} />
                  <meshBasicMaterial color="#0f8a4b" transparent opacity={0} depthWrite={false} />
                </mesh>
              ))}
            </group>

            {est.baldas.map((b) => {
              const hueco = geometria.huecos[b.hueco];
              if (!hueco || !tramo) return null;
              return (
                <Letrero
                  key={b.hueco}
                  texto={b.titulo}
                  reloj={reloj}
                  // Se descifra mientras la estantería frena y acaba cuando se detiene.
                  inicio={tramo.inicio + tramo.duracion * 0.25}
                  duracion={tramo.duracion * 0.75}
                  posicion={[
                    hueco.centro[0],
                    hueco.centro[1] + hueco.alto - LETRERO_ALTO / 2 - 0.02,
                    hueco.centro[2] + hueco.fondo / 2 - 0.02,
                  ]}
                />
              );
            })}

            {est.cajas.map((c, j) => (
              <group
                key={c.item.nregistro}
                ref={(g) => {
                  (cajas.current[i] ??= [])[j] = g;
                }}
                position={c.posicion}
                visible={menosMovimiento}
              >
                <Caja forma={c.forma} asset={c.item.asset} posicion={[0, 0, 0]} />
              </group>
            ))}
          </group>
        );
      })}
    </group>
  );
}
