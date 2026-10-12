import { useFrame, useThree } from '@react-three/fiber';
import type { ProductoResumen } from '@rebotica/shared';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Vector3,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  type PerspectiveCamera,
} from 'three';
import { avance, muelle, planificarEntrada } from './animacion';
import { Caja } from './Caja';
import { colocarCajas, dimensionesCaja, type CajaColocada } from './cajas';
import { Estanteria } from './Estanteria';
import { ESTANTERIA_POR_DEFECTO, geometriaEstanteria, type GeometriaEstanteria } from './geometria';
import { Letrero, LETRERO_ALTO } from './Letrero';
import { RielCamara } from './RielCamara';
import {
  ALTO_EN_FICHA,
  DISTANCIA_FICHA,
  DISTANCIA_VELO,
  VELOCIDAD_GIRO,
  avanzarTransicion,
  cajaMasCercana,
  escalaEnFicha,
  suavizado,
} from './seleccion';
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

/**
 * Destinos del raíl: la posición x de cada producto en cada balda, de todas las estanterías, y la
 * altura del centro de cada balda. Una balda sin productos aporta una lista vacía.
 */
export function datosRiel(
  modelo: readonly ModeloEstanteria[],
  geometria: GeometriaEstanteria,
): { puntos: number[][]; alturas: number[] } {
  const puntos: number[][] = geometria.huecos.map(() => []);
  for (const est of modelo) {
    for (const caja of est.cajas) {
      puntos[caja.balda]?.push(est.posicion[0] + caja.posicion[0]);
    }
  }
  for (const fila of puntos) fila.sort((a, b) => a - b);
  const alturas = geometria.huecos.map((h) => h.centro[1] + h.alto * 0.45);
  return { puntos, alturas };
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
  /** `nregistro` del producto abierto en la ficha, o null en el pasillo. */
  seleccionada?: string | null;
  /** Se llama al tocar una caja (con el producto) o al elegirla con el teclado. */
  onSeleccionar?: (producto: ProductoResumen) => void;
}

/**
 * Pasillo de estanterías con la entrada tipo «Constructo»: cada estantería llega desde el fondo
 * o desde un lateral y frena con un muelle; después las cajas caen a su hueco una a una y los
 * letreros se descifran. Todo el movimiento se calcula aquí con una sola línea de tiempo.
 */
export function Pasillo({ baldas, seleccionada = null, onSeleccionar }: PasilloProps) {
  const invalidar = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);
  const menosMovimiento = useMenosMovimiento();
  const geometria = useMemo(() => geometriaEstanteria(), []);
  const modelo = useMemo(() => modeloPasillo(baldas, geometria), [baldas, geometria]);
  const plan = useMemo(() => planificarEntrada(modelo.map((m) => m.cajas.length)), [modelo]);
  const riel = useMemo(() => datosRiel(modelo, geometria), [modelo, geometria]);

  const t0 = useRef<number | null>(null);
  const reloj = useCallback(() => {
    if (menosMovimiento) return 1e6;
    if (t0.current === null) t0.current = performance.now();
    return (performance.now() - t0.current) / 1000;
  }, [menosMovimiento]);

  // Producto que se está mostrando en la ficha. Se conserva mientras dura el vuelo de vuelta,
  // aunque `seleccionada` ya sea null, y se limpia cuando la caja ha regresado a su balda.
  const [mostrada, setMostrada] = useState<string | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  if (seleccionada !== previa) {
    setPrevia(seleccionada);
    if (seleccionada) setMostrada(seleccionada);
  }

  const indice = useMemo(() => {
    const mapa = new Map<string, { i: number; j: number }>();
    modelo.forEach((est, i) => est.cajas.forEach((c, j) => mapa.set(c.item.nregistro, { i, j })));
    return mapa;
  }, [modelo]);

  const sel = useRef({ u: 0, origen: new Vector3(), tieneOrigen: false, angulo: 0 });
  const volando = useRef<Group>(null);
  const velo = useRef<Mesh>(null);
  const direccion = useMemo(() => new Vector3(), []);
  const destino = useMemo(() => new Vector3(), []);
  const arriba = useMemo(() => new Vector3(), []);

  const grupos = useRef<(Group | null)[]>([]);
  const cajas = useRef<(Group | null)[][]>([]);
  const estelas = useRef<(Group | null)[]>([]);

  // Un fotograma al montar o al cambiar los datos; después la animación se pide a sí misma.
  useLayoutEffect(() => {
    t0.current = performance.now();
    invalidar();
  }, [modelo, invalidar]);

  useFrame((_, delta) => {
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

    // ---- Selección: la caja vuela a la ficha y el resto se apaga tras un velo blanco -------------
    const estado = sel.current;
    estado.u = avanzarTransicion(
      estado.u,
      delta,
      seleccionada ? 1 : 0,
      menosMovimiento ? 0 : undefined,
    );
    const lugar = mostrada ? indice.get(mostrada) : undefined;
    const original = lugar ? cajas.current[lugar.i]?.[lugar.j] : null;

    if (lugar && original && volando.current && velo.current) {
      if (!estado.tieneOrigen) {
        original.getWorldPosition(estado.origen);
        estado.tieneOrigen = true;
      }
      // La caja real se oculta mientras su copia está fuera de la balda.
      original.visible = false;

      const e = suavizado(estado.u);
      const perspectiva = camera as PerspectiveCamera;
      camera.getWorldDirection(direccion);
      arriba.copy(perspectiva.up).applyQuaternion(camera.quaternion);
      destino.copy(camera.position).addScaledVector(direccion, DISTANCIA_FICHA);
      destino.addScaledVector(arriba, ALTO_EN_FICHA * 0.12);

      const forma = modelo[lugar.i]?.cajas[lugar.j]?.forma;
      const escala = escalaEnFicha(forma ? dimensionesCaja(forma).alto : ALTO_EN_FICHA);

      volando.current.position.lerpVectors(estado.origen, destino, e);
      volando.current.scale.setScalar(1 + (escala - 1) * e);
      // Gira despacio solo cuando ya está en la ficha; al volver el giro se deshace con el vuelo.
      if (estado.u >= 1 && !menosMovimiento) estado.angulo += delta * VELOCIDAD_GIRO;
      volando.current.rotation.y = estado.angulo * e;

      velo.current.position.copy(camera.position).addScaledVector(direccion, DISTANCIA_VELO);
      velo.current.quaternion.copy(camera.quaternion);
      (velo.current.material as MeshBasicMaterial).opacity = 0.94 * e;
      velo.current.visible = e > 0.001;

      if (estado.u === 0 && !seleccionada) {
        original.visible = true;
        estado.tieneOrigen = false;
        estado.angulo = 0;
        setMostrada(null);
      }
    }

    const enVuelo = mostrada !== null && (estado.u > 0 || seleccionada !== null);
    if (estado.u >= 1 && !menosMovimiento) {
      // En la ficha la caja gira: ~30 fotogramas por segundo bastan y ahorran batería.
      window.setTimeout(invalidar, 33);
    } else if (enVuelo || t < plan.total + 0.1) {
      invalidar();
    }
  });

  /** Enter sobre el raíl: elige el producto que la cámara tiene delante. */
  const activarPorTeclado = useCallback(
    (x: number, fila: number) => {
      const ubicadas = modelo.flatMap((est) =>
        est.cajas.map((c) => ({
          balda: c.balda,
          x: est.posicion[0] + c.posicion[0],
          item: c.item,
        })),
      );
      const k = cajaMasCercana(ubicadas, x, fila);
      const elegida = ubicadas[k];
      if (elegida) onSeleccionar?.(elegida.item);
    },
    [modelo, onSeleccionar],
  );

  const lugarMostrada = mostrada ? indice.get(mostrada) : undefined;
  const cajaMostrada = lugarMostrada ? modelo[lugarMostrada.i]?.cajas[lugarMostrada.j] : undefined;

  return (
    <group>
      <RielCamara
        puntos={riel.puntos}
        alturas={riel.alturas}
        instantaneo={menosMovimiento}
        activo={mostrada === null}
        onActivar={activarPorTeclado}
      />
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
                <Caja
                  forma={c.forma}
                  asset={c.item.asset}
                  posicion={[0, 0, 0]}
                  onSeleccionar={mostrada === null ? () => onSeleccionar?.(c.item) : undefined}
                />
              </group>
            ))}
          </group>
        );
      })}
      {cajaMostrada && (
        <group ref={volando}>
          <Caja forma={cajaMostrada.forma} asset={cajaMostrada.item.asset} posicion={[0, 0, 0]} />
        </group>
      )}
      {/* Velo blanco entre la caja de la ficha y el resto de la escena (más lejos que ella). */}
      <mesh ref={velo} visible={false} raycast={() => null} renderOrder={5}>
        <planeGeometry args={[6, 6]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
