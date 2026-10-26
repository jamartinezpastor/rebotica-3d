import { useFrame, useThree } from '@react-three/fiber';
import type { ProductoResumen } from '@rebotica/shared';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Vector3,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  type PerspectiveCamera,
} from 'three';
import { avance, muelle, planificarEntrada } from './animacion';
import { datosEnvase } from './arteEnvase';
import { Caja } from './Caja';
import { colocarCajas, dimensionesCaja, type CajaColocada } from './cajas';
import { Estanteria } from './Estanteria';
import { GiroFicha } from './giroFicha';
import { ESTANTERIA_POR_DEFECTO, geometriaEstanteria, type GeometriaEstanteria } from './geometria';
import { Letrero, LETRERO_ALTO } from './Letrero';
import { RielCamara } from './RielCamara';
import { useMenosMovimiento } from '../useMenosMovimiento';
import {
  DISTANCIA_FICHA,
  DISTANCIA_VELO,
  POSICION_FICHA_Y,
  VELOCIDAD_GIRO,
  avanzarTransicion,
  cajaMasCercana,
  escalaSegunEncuadre,
  suavizado,
} from './seleccion';
import { Sombra } from './Sombra';
import { ventanaEstanterias } from './ventanaEscena';
import { usePrecargaEstanterias } from './usePrecargaEstanterias';

/** Una balda del pasillo: su título (principio activo) y los productos que lleva. */
export interface BaldaEscena {
  titulo: string;
  productos: ProductoResumen[];
  receta?: boolean;
  descripcion?: string;
  grupo?: string;
}

/** Baldas por estantería: el plan usa estanterías de tres baldas. */
export const BALDAS_POR_ESTANTERIA = 3;
/** Separación entre estanterías contiguas, de centro a centro. */
export const SEPARACION_ESTANTERIAS = 1.4;

interface ModeloEstanteria {
  receta: boolean;
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
  // La vitrina tiene su propia estructura: nunca compartir estantería con las baldas sin receta.
  const grupos = [
    ...trocear(
      baldas.filter((b) => !b.receta),
      BALDAS_POR_ESTANTERIA,
    ),
    ...trocear(
      baldas.filter((b) => b.receta),
      BALDAS_POR_ESTANTERIA,
    ),
  ];
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
      receta: grupo[0]?.receta === true,
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

export interface PasilloProps {
  baldas: readonly BaldaEscena[];
  /** `nregistro` del producto abierto en la ficha, o null en el pasillo. */
  seleccionada?: string | null;
  /** Se llama al tocar una caja (con el producto) o al elegirla con el teclado. */
  onSeleccionar?: (producto: ProductoResumen) => void;
  registroInicial?: string | null;
  onMirar?: (registro: string) => void;
  ligera?: boolean;
}

/**
 * Pasillo de estanterías con la entrada tipo «Constructo»: cada estantería llega desde el fondo
 * o desde un lateral y frena con un muelle; después las cajas caen a su hueco una a una y los
 * letreros se descifran. Todo el movimiento se calcula aquí con una sola línea de tiempo.
 */
export function Pasillo({
  baldas,
  seleccionada = null,
  onSeleccionar,
  registroInicial,
  onMirar,
  ligera = false,
}: PasilloProps) {
  const invalidar = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const menosMovimiento = useMenosMovimiento();
  const geometria = useMemo(() => geometriaEstanteria(), []);
  const modelo = useMemo(() => modeloPasillo(baldas, geometria), [baldas, geometria]);
  const plan = useMemo(() => planificarEntrada(modelo.map((m) => m.cajas.length)), [modelo]);
  const riel = useMemo(() => datosRiel(modelo, geometria), [modelo, geometria]);
  const ubicadas = useMemo(
    () =>
      modelo.flatMap((est) =>
        est.cajas.map((c) => ({
          balda: c.balda,
          x: est.posicion[0] + c.posicion[0],
          item: c.item,
          estanteria: est.indice,
        })),
      ),
    [modelo],
  );
  const inicio = useMemo(() => {
    const caja = ubicadas.find((c) => c.item.nregistro === registroInicial);
    return caja ? { x: caja.x, fila: caja.balda } : undefined;
  }, [ubicadas, registroInicial]);
  const [centro, setCentro] = useState(
    () => ubicadas.find((c) => c.item.nregistro === registroInicial)?.estanteria ?? 0,
  );
  const centroActual = useRef(centro);
  const alMirar = useCallback(
    (x: number, fila: number) => {
      const caja = ubicadas[cajaMasCercana(ubicadas, x, fila)];
      if (caja) {
        if (caja.estanteria !== centroActual.current) {
          centroActual.current = caja.estanteria;
          setCentro(caja.estanteria);
        }
        onMirar?.(caja.item.nregistro);
      }
    },
    [ubicadas, onMirar],
  );

  const t0 = useRef<number | null>(null);
  const reloj = useCallback(() => {
    if (menosMovimiento || modelo.length > (ligera ? 3 : 5)) return 1e6;
    if (t0.current === null) t0.current = performance.now();
    return (performance.now() - t0.current) / 1000;
  }, [menosMovimiento, modelo.length, ligera]);

  // Producto que se está mostrando en la ficha. Se conserva mientras dura el vuelo de vuelta,
  // aunque `seleccionada` ya sea null, y se limpia cuando la caja ha regresado a su balda.
  const [mostrada, setMostrada] = useState<string | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  if (seleccionada !== previa) {
    setPrevia(seleccionada);
    if (seleccionada) setMostrada(seleccionada);
  }

  usePrecargaEstanterias(modelo, centro, ligera, mostrada !== null);

  const indice = useMemo(() => {
    const mapa = new Map<string, { i: number; j: number }>();
    modelo.forEach((est, i) => est.cajas.forEach((c, j) => mapa.set(c.item.nregistro, { i, j })));
    return mapa;
  }, [modelo]);
  const visibles = useMemo(
    () =>
      ventanaEstanterias(
        modelo.length,
        centro,
        ligera ? 1 : 2,
        mostrada ? indice.get(mostrada)?.i : undefined,
      ),
    [modelo.length, centro, ligera, mostrada, indice],
  );

  const sel = useRef({ u: 0, origen: new Vector3(), tieneOrigen: false });
  // Giro de la caja en la ficha: automático, arrastrable con inercia y de vuelta a los 3 s.
  const giro = useMemo(
    () => new GiroFicha(menosMovimiento ? 0 : VELOCIDAD_GIRO, !menosMovimiento),
    [menosMovimiento],
  );
  const gl = useThree((s) => s.gl);
  const volando = useRef<Group>(null);
  const velo = useRef<Mesh>(null);
  const direccion = useMemo(() => new Vector3(), []);
  const destino = useMemo(() => new Vector3(), []);
  const rayo = useMemo(() => new Vector3(), []);

  const grupos = useRef<(Group | null)[]>([]);
  const cajas = useRef<(Group | null)[][]>([]);
  const estelas = useRef<(Group | null)[]>([]);

  // Un fotograma al montar o al cambiar los datos; después la animación se pide a sí misma.
  useLayoutEffect(() => {
    t0.current = performance.now();
    invalidar();
  }, [modelo, invalidar]);

  // Arrastrar en la ficha hace girar la caja (el raíl está desactivado mientras hay ficha).
  useEffect(() => {
    if (!seleccionada) return;
    const el = gl.domElement;
    let puntero: number | null = null;
    let ultimo = { x: 0, t: 0 };

    const abajo = (e: PointerEvent) => {
      if (!e.isPrimary || puntero !== null) return;
      puntero = e.pointerId;
      el.setPointerCapture(e.pointerId);
      ultimo = { x: e.clientX, t: e.timeStamp };
      giro.empezar();
      invalidar();
    };
    const mover = (e: PointerEvent) => {
      if (e.pointerId !== puntero) return;
      giro.arrastrar(e.clientX - ultimo.x, (e.timeStamp - ultimo.t) / 1000);
      ultimo = { x: e.clientX, t: e.timeStamp };
      invalidar();
    };
    const soltar = (e: PointerEvent) => {
      if (e.pointerId !== puntero) return;
      puntero = null;
      giro.soltar(performance.now() / 1000);
      invalidar();
    };

    el.addEventListener('pointerdown', abajo);
    el.addEventListener('pointermove', mover);
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
    return () => {
      el.removeEventListener('pointerdown', abajo);
      el.removeEventListener('pointermove', mover);
      el.removeEventListener('pointerup', soltar);
      el.removeEventListener('pointercancel', soltar);
      if (puntero !== null) giro.soltar(performance.now() / 1000);
    };
  }, [seleccionada, gl, giro, invalidar]);

  useFrame((_, delta) => {
    const t = reloj();
    visibles.forEach((i) => {
      const est = modelo[i];
      if (!est) return;
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
      camera.getWorldDirection(direccion);
      // La caja aterriza en el tercio superior de la pantalla, sobre la hoja de la ficha: se
      // toma el rayo que pasa por ese punto y se avanza hasta la profundidad de la ficha.
      rayo.set(0, POSICION_FICHA_Y, 0.5).unproject(camera).sub(camera.position).normalize();
      const profundidad = Math.max(rayo.dot(direccion), 0.1);
      destino.copy(camera.position).addScaledVector(rayo, DISTANCIA_FICHA / profundidad);

      const forma = modelo[lugar.i]?.cajas[lugar.j]?.forma;
      const escala = escalaSegunEncuadre(
        dimensionesCaja(forma ?? 'caja-plana'),
        (camera as PerspectiveCamera).fov,
        size.width / size.height,
      );

      volando.current.position.lerpVectors(estado.origen, destino, e);
      volando.current.scale.setScalar(1 + (escala - 1) * e);
      // Gira solo cuando ya está en la ficha; al volver el giro se deshace con el vuelo.
      if (estado.u >= 1) giro.actualizar(delta, performance.now() / 1000);
      volando.current.rotation.y = giro.angulo * e;

      velo.current.position.copy(camera.position).addScaledVector(direccion, DISTANCIA_VELO);
      velo.current.quaternion.copy(camera.quaternion);
      (velo.current.material as MeshBasicMaterial).opacity = 0.94 * e;
      velo.current.visible = e > 0.001;

      if (estado.u === 0 && !seleccionada) {
        original.visible = true;
        estado.tieneOrigen = false;
        giro.reiniciar();
        setMostrada(null);
      }
    }

    const enVuelo = mostrada !== null && (estado.u > 0 || seleccionada !== null);
    const girando = estado.u >= 1 && (!menosMovimiento || giro.estaArrastrando);
    if (girando) {
      // En la ficha la caja gira: ~30 fotogramas por segundo bastan y ahorran batería.
      window.setTimeout(invalidar, 33);
    } else if (enVuelo || t < plan.total + 0.1) {
      invalidar();
    }
  });

  /** Enter sobre el raíl: elige el producto que la cámara tiene delante. */
  const activarPorTeclado = useCallback(
    (x: number, fila: number) => {
      const k = cajaMasCercana(ubicadas, x, fila);
      const elegida = ubicadas[k];
      if (elegida) onSeleccionar?.(elegida.item);
    },
    [ubicadas, onSeleccionar],
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
        inicio={inicio}
        onMirar={alMirar}
      />
      {visibles.map((i) => {
        const est = modelo[i];
        if (!est) return null;
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
            <Estanteria geometria={geometria} receta={est.receta} />
            {est.receta && (
              <Letrero
                texto="⚠ VITRINA · REQUIERE RECETA"
                receta
                reloj={reloj}
                inicio={0}
                duracion={0.1}
                posicion={[0, 1.34, 0.19]}
              />
            )}
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
                  receta={est.receta}
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
                  datos={datosEnvase(c.item)}
                  calidad={ligera ? 'ligera' : 'estanteria'}
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
          <Caja
            forma={cajaMostrada.forma}
            datos={datosEnvase(cajaMostrada.item)}
            calidad="ficha"
            posicion={[0, 0, 0]}
          />
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
