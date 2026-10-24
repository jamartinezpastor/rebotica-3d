import { AVISO_LEGAL, type PasilloResponse } from '@rebotica/shared';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { baldasDemo, vitrinaDemo } from './escena/demo';
import {
  detectarDispositivo,
  evaluarCapacidad,
  vistaInicial,
  type VistaElegida,
} from './escena/capacidad';
import type { EstadisticasFps } from './escena/medidorFps';
import { PanelFicha } from './escena/PanelFicha';
import { usePasillo, pasilloAEscena } from './escena/usePasillo';
import { useSeleccion } from './escena/useSeleccion';
import { VistaLista } from './escena/VistaLista';
import { useEstadoApi } from './useEstadoApi';
import { agruparBaldas, esAgrupacion, type Agrupacion } from './escena/agrupacion';
import { SelectorAgrupacion } from './escena/SelectorAgrupacion';
import { ConsultaGuiada } from './mostrador/ConsultaGuiada';
import { paginaCatalogo, PRODUCTOS_POR_PAGINA } from './escena/paginaCatalogo';
import { EstadoCatalogo } from './escena/EstadoCatalogo';
import { CargaVisual } from './escena/CargaVisual';
import { BusquedaCatalogo } from './escena/BusquedaCatalogo';
import {
  FILTROS_INICIALES,
  filtrarCatalogo,
  indiceBusqueda,
  opcionesFiltros,
  type FiltrosCatalogo,
} from './escena/filtrosCatalogo';
import {
  destinosGrupos,
  indiceDeRegistro,
  registroVisible,
  type RetornoLista,
} from './escena/navegacionCatalogo';

// La escena 3D se descarga en diferido: no cuenta en el JavaScript inicial (< 250 kB).
const Escena = lazy(() => import('./escena/Escena'));

function Preparando({ texto = 'Preparando la estantería…' }: { texto?: string }) {
  return (
    <p role="status" className="p-6 text-tinta-suave">
      {texto}
    </p>
  );
}

const CLAVE_VISTA = 'rebotica.vista';

function leerPreferencia(): string | null {
  try {
    return window.localStorage.getItem(CLAVE_VISTA);
  } catch {
    return null; // modo privado o almacenamiento bloqueado
  }
}

function guardarPreferencia(vista: VistaElegida): void {
  try {
    window.localStorage.setItem(CLAVE_VISTA, vista);
  } catch {
    // Sin almacenamiento la vista elegida solo vale para esta sesión.
  }
}

/** Contador de fotogramas para medir en un dispositivo real (`?fps=1`). */
function ContadorFps({ e, cajas }: { e: EstadisticasFps | null; cajas: number }) {
  return (
    <p
      role="status"
      className="pointer-events-none absolute top-64 left-3 z-10 rounded-md bg-black/75 px-2 py-1 font-mono text-xs text-white"
    >
      {e
        ? `${e.fps.toFixed(0)} fps · p95 ${e.p95Ms.toFixed(0)} ms · máx ${e.maxMs.toFixed(0)} ms`
        : 'sin datos (mueve la cámara)'}
      {` · ${cajas} productos en página`}
      {e?.recursos &&
        ` · ${e.recursos.geometrias} geometrías · ${e.recursos.texturas} texturas · ${e.recursos.llamadas} dibujos`}
    </p>
  );
}

/**
 * `/escena` abre el catálogo real. Solo `demo=1` usa datos ficticios para pruebas de la escena.
 */
function VistaEscena({
  precargado,
  onNueva,
}: { precargado?: PasilloResponse; onNueva?: () => void } = {}) {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const pasillo = precargado?.id ?? params.get('pasillo');
  const demo = !precargado && !pasillo && params.get('demo') === '1';
  const general = !precargado && !pasillo && !demo;
  const [pagina, setPagina] = useState(0);
  const cajasDemo = Math.min(Math.max(Number(params.get('cajas')) || 36, 1), 200);
  const mostrarVitrinaDemo = params.get('vitrina') === '1';
  const midiendo = params.get('fps') === '1';

  const capacidad = useMemo(() => evaluarCapacidad(detectarDispositivo()), []);
  const [vista, setVista] = useState<VistaElegida>(() =>
    vistaInicial(params.get('vista'), leerPreferencia(), capacidad),
  );
  const [lento, setLento] = useState(false);
  const botonVista = useRef<HTMLButtonElement>(null);
  const [fps, setFps] = useState<EstadisticasFps | null>(null);
  const [agrupacion, setAgrupacion] = useState<Agrupacion>(() => {
    const valor = params.get('agrupar');
    return esAgrupacion(valor) ? valor : 'original';
  });

  const descargado = usePasillo(precargado ? null : pasillo, !precargado && !pasillo && !demo);
  const cargado = useMemo(() => (precargado ? pasilloAEscena(precargado) : null), [precargado]);
  const remoto = cargado ?? descargado;
  useEffect(() => {
    if (vista === '3d') botonVista.current?.focus({ preventScroll: true });
    // El foco inicial en lista lo recibe el título de VistaLista.
  }, [vista, remoto.tipo]);
  const baldasDemoMemo = useMemo(
    () => [...baldasDemo(cajasDemo), ...(mostrarVitrinaDemo ? vitrinaDemo() : [])],
    [cajasDemo, mostrarVitrinaDemo],
  );
  const seleccion = useSeleccion();
  const [filtros, setFiltros] = useState<FiltrosCatalogo>(FILTROS_INICIALES);
  const lista = useRef<HTMLDivElement>(null);
  const herramientas = useRef<HTMLDivElement>(null);
  const mirada = useRef<string | null>(null);
  const listaGuardada = useRef<RetornoLista | null>(null);
  const [retorno, setRetorno] = useState<RetornoLista>();
  const [registroInicial, setRegistroInicial] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const recolocar = useRef(false);
  const alMirar = useCallback((registro: string) => {
    mirada.current = registro;
  }, []);
  const fuente = useMemo(
    () => (!demo && remoto.tipo === 'listo' ? remoto.baldas : demo ? baldasDemoMemo : []),
    [demo, remoto, baldasDemoMemo],
  );
  const indice = useMemo(() => indiceBusqueda(fuente), [fuente]);
  const opciones = useMemo(() => opcionesFiltros(fuente), [fuente]);
  const filtradas = useMemo(
    () => filtrarCatalogo(fuente, filtros, indice),
    [fuente, filtros, indice],
  );
  const baldasAgrupadas = useMemo(
    () => agruparBaldas(filtradas, agrupacion),
    [filtradas, agrupacion],
  );
  const destinos = useMemo(() => destinosGrupos(baldasAgrupadas), [baldasAgrupadas]);

  const reiniciarRecorrido = () => {
    setPagina(0);
    setRegistroInicial(null);
    mirada.current = null;
    listaGuardada.current = null;
    setRevision((n) => n + 1);
    recolocar.current = true;
  };
  useLayoutEffect(() => {
    if (recolocar.current) {
      recolocar.current = false;
      if (window.scrollY !== 0) window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [revision, vista]);

  let titulo = 'Pasillo de demostración';
  const totalOriginal = fuente.reduce((n, b) => n + b.productos.length, 0);
  const totalCajas = baldasAgrupadas.reduce((n, b) => n + b.productos.length, 0);
  const paginas = Math.max(1, Math.ceil(totalCajas / PRODUCTOS_POR_PAGINA));
  const paginaActual = Math.min(pagina, paginas - 1);
  // En 3D también se acotan las consultas grandes; la lista por dolencia conserva todo.
  const paginado = !demo && paginas > 1 && (general || vista === '3d');
  const baldas = useMemo(
    () => (paginado ? paginaCatalogo(baldasAgrupadas, paginaActual) : baldasAgrupadas),
    [paginado, baldasAgrupadas, paginaActual],
  );
  const cambiarVista = (siguiente: VistaElegida) => {
    if (vista === 'lista') {
      const registro =
        registroVisible(lista.current, herramientas.current?.getBoundingClientRect().bottom ?? 0) ??
        baldas[0]?.productos[0]?.nregistro ??
        null;
      listaGuardada.current = { registro, scrollY: window.scrollY };
      mirada.current = registro;
      setRegistroInicial(registro);
      const i = indiceDeRegistro(baldasAgrupadas, registro);
      if (i >= 0) setPagina(Math.floor(i / PRODUCTOS_POR_PAGINA));
      if (window.scrollY !== 0) window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      const registro = mirada.current ?? baldas[0]?.productos[0]?.nregistro ?? null;
      setRetorno(
        listaGuardada.current?.registro === registro ? { ...listaGuardada.current } : { registro },
      );
    }
    setVista(siguiente);
    guardarPreferencia(siguiente);
    setLento(false);
  };
  const cambiarPagina = (siguiente: number) => {
    setPagina(siguiente);
    mirada.current = null;
    listaGuardada.current = null;
    setRegistroInicial(null);
    setRetorno({
      registro: paginaCatalogo(baldasAgrupadas, siguiente)[0]?.productos[0]?.nregistro ?? null,
    });
  };
  const irAGrupo = (registro: string) => {
    const i = indiceDeRegistro(baldasAgrupadas, registro);
    if (i < 0) return;
    setPagina(Math.floor(i / PRODUCTOS_POR_PAGINA));
    setRegistroInicial(registro);
    mirada.current = registro;
    listaGuardada.current = null;
    setRetorno({ registro });
    setRevision((n) => n + 1);
    if (vista === '3d') botonVista.current?.focus({ preventScroll: true });
  };
  if (!demo) {
    if (remoto.tipo === 'cargando') return <CargaVisual texto="Cargando el pasillo…" />;
    if (remoto.tipo === 'error')
      return (
        <div>
          <a href="/" className="inline-block p-4 text-cruz underline">
            Volver al inicio
          </a>
          <Preparando texto="No se pudo cargar el catálogo real. Inténtalo de nuevo en unos minutos." />
        </div>
      );
    titulo = remoto.titulo;
  }
  const puede3d = capacidad.nivel !== 'sin3d';
  const borrador = demo || (remoto.tipo === 'listo' && remoto.estado === 'borrador');

  return (
    <div
      className={
        vista === '3d' ? 'relative h-dvh w-full overflow-hidden' : 'relative min-h-dvh pt-20'
      }
    >
      {!seleccion.producto && (
        <a
          className="saltar-contenido"
          href={vista === 'lista' ? '#titulo-pasillo' : '#cambiar-vista'}
        >
          Saltar al contenido
        </a>
      )}
      <div
        ref={herramientas}
        data-herramientas-catalogo
        inert={!!seleccion.producto}
        className={`${seleccion.producto ? 'invisible' : ''} ${vista === '3d' ? 'fixed inset-x-3 top-18 z-10 mx-auto max-w-xl' : 'sticky top-18 z-10 mx-3 sm:mx-auto sm:max-w-xl'}`}
      >
        <SelectorAgrupacion
          destinos={destinos}
          onIr={irAGrupo}
          valor={agrupacion}
          onCambiar={(valor) => {
            setAgrupacion(valor);
            reiniciarRecorrido();
          }}
        >
          <BusquedaCatalogo
            valor={filtros}
            onCambiar={(valor) => {
              setFiltros(valor);
              reiniciarRecorrido();
            }}
            opciones={opciones}
            coincidencias={totalCajas}
            total={totalOriginal}
          />
        </SelectorAgrupacion>
      </div>
      {totalCajas === 0 && vista === '3d' ? (
        <p
          role="status"
          className={`mx-auto max-w-xl p-6 ${vista === '3d' ? 'absolute inset-x-0 top-72' : ''}`}
        >
          No hay medicamentos que coincidan con estos filtros.
        </p>
      ) : vista === '3d' ? (
        <Suspense fallback={<CargaVisual texto="Preparando la estantería…" />}>
          <Escena
            key={`${paginaActual}-${agrupacion}-${revision}`}
            baldas={baldas}
            seleccionada={seleccion.producto?.nregistro ?? null}
            onSeleccionar={seleccion.seleccionar}
            onFps={midiendo ? setFps : undefined}
            onLento={() => setLento(true)}
            registroInicial={registroInicial}
            onMirar={alMirar}
            calidadInicial={capacidad.nivel === 'bajo' ? 'ligera' : 'normal'}
          />
        </Suspense>
      ) : (
        <div ref={lista} inert={!!seleccion.producto}>
          <VistaLista
            titulo={titulo}
            baldas={baldas}
            onSeleccionar={seleccion.seleccionar}
            conHerramientas
            retorno={retorno}
            pagina={paginaActual}
          />
        </div>
      )}

      {midiendo && vista === '3d' && (
        <ContadorFps e={fps} cajas={baldas.reduce((n, b) => n + b.productos.length, 0)} />
      )}
      {seleccion.producto && vista === '3d' && (
        <p className="pointer-events-none absolute top-3 left-3 z-10 rounded-full bg-white/90 px-3 py-2 text-xs text-tinta-suave">
          Modelo 3D generado
        </p>
      )}

      {!seleccion.producto &&
        (onNueva ? (
          <button
            type="button"
            onClick={onNueva}
            className="fixed top-3 left-3 z-10 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-4 text-base font-semibold shadow ring-1 ring-black/15"
          >
            <span aria-hidden="true">←</span> Nueva consulta
          </button>
        ) : (
          <a
            href="/"
            className="fixed top-3 left-3 z-10 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-4 text-base font-semibold shadow ring-1 ring-black/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cruz"
          >
            <span aria-hidden="true">←</span> Inicio
          </a>
        ))}

      {
        <div
          inert={!!seleccion.producto}
          className={`${seleccion.producto ? 'invisible' : ''} z-10 space-y-2 p-3 ${vista === '3d' ? 'pointer-events-none absolute inset-x-0 bottom-3' : ''}`}
        >
          {paginado && (
            <nav
              aria-label="Páginas del catálogo"
              className={`pointer-events-auto flex items-center justify-between gap-2 rounded-xl bg-white p-2 shadow ${vista === 'lista' ? 'fixed inset-x-3 bottom-3 z-10 mx-auto max-w-xl' : ''}`}
            >
              <button
                type="button"
                disabled={paginaActual === 0}
                onClick={() => cambiarPagina(paginaActual - 1)}
                className="min-h-11 rounded-lg px-3 font-semibold text-cruz disabled:opacity-40"
              >
                Anterior
              </button>
              <p role="status" className="text-center text-sm">
                {paginaActual * PRODUCTOS_POR_PAGINA + 1}–
                {Math.min((paginaActual + 1) * PRODUCTOS_POR_PAGINA, totalCajas)} de {totalCajas}
              </p>
              <button
                type="button"
                disabled={paginaActual === paginas - 1}
                onClick={() => cambiarPagina(paginaActual + 1)}
                className="min-h-11 rounded-lg px-3 font-semibold text-cruz disabled:opacity-40"
              >
                Siguiente
              </button>
            </nav>
          )}
          {borrador && (
            <p
              role="note"
              className="rounded-xl bg-amber-50 p-3 text-base text-amber-950 ring-1 ring-amber-700"
            >
              Demostración: pendiente de validación farmacéutica
            </p>
          )}
          {remoto.tipo === 'listo' && remoto.estado === 'informativo' && (
            <div
              role="note"
              className="rounded-xl bg-white/95 p-3 text-base text-tinta ring-1 ring-cruz/30"
            >
              Catálogo informativo:{' '}
              <strong>
                {totalCajas}{' '}
                {!pasillo && !demo
                  ? totalCajas === 1
                    ? 'medicamento'
                    : 'medicamentos'
                  : totalCajas === 1
                    ? 'medicamento relacionado'
                    : 'medicamentos relacionados'}
              </strong>
              . Consulta la ficha completa.
              <EstadoCatalogo datos={remoto.catalogo} />
            </div>
          )}
        </div>
      }

      {/* «Ver como lista» está siempre a mano (plan §reglas de interfaz). */}
      {!seleccion.producto && (
        <div className="fixed top-3 right-3 z-10 flex flex-col items-end gap-2">
          {(vista === 'lista' ? puede3d : true) && (
            <button
              id="cambiar-vista"
              ref={botonVista}
              type="button"
              onClick={() => cambiarVista(vista === '3d' ? 'lista' : '3d')}
              className="min-h-12 rounded-full bg-white px-4 text-base font-semibold shadow ring-1 ring-black/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cruz"
            >
              {vista === '3d' ? 'Ver como lista' : 'Ver en 3D'}
            </button>
          )}
          {vista === '3d' && lento && (
            <p
              role="status"
              className="max-w-64 rounded-xl bg-amber-50 p-3 text-sm text-aviso ring-1 ring-amber-200"
            >
              Se ha reducido el detalle para mejorar la fluidez. Puedes cambiar a la lista.
            </p>
          )}
        </div>
      )}

      {seleccion.producto && (
        <PanelFicha producto={seleccion.producto} onVolver={seleccion.volver} modo={vista} />
      )}
    </div>
  );
}

function Cruz() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-9 w-9 text-cruz">
      <path fill="currentColor" d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z" />
    </svg>
  );
}

function EstadoServidor() {
  const estado = useEstadoApi();
  const texto =
    estado.tipo === 'cargando'
      ? 'Comprobando servidor…'
      : estado.tipo === 'ok'
        ? `Servidor en marcha · v${estado.version}`
        : 'Servidor sin conexión';
  const color =
    estado.tipo === 'ok'
      ? 'bg-cruz-claro text-cruz'
      : estado.tipo === 'caida'
        ? 'bg-amber-50 text-aviso'
        : 'bg-black/5 text-tinta-suave';

  return (
    <p role="status" className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${color}`}>
      {texto}
    </p>
  );
}

export function App() {
  const [activa, setActiva] = useState(false);
  const [pasilloConsulta, setPasilloConsulta] = useState<PasilloResponse | null>(null);
  useEffect(() => {
    const borrar = () =>
      flushSync(() => {
        setPasilloConsulta(null);
        setActiva(false);
      });
    const restaurar = (e: PageTransitionEvent) => {
      if (e.persisted) borrar();
    };
    window.addEventListener('pagehide', borrar);
    window.addEventListener('pageshow', restaurar);
    return () => {
      window.removeEventListener('pagehide', borrar);
      window.removeEventListener('pageshow', restaurar);
    };
  }, []);
  // La portada y /escena usan siempre el catálogo real salvo la demo explícita.
  if (window.location.pathname === '/escena') return <VistaEscena />;
  if (pasilloConsulta)
    return (
      <VistaEscena
        precargado={pasilloConsulta}
        onNueva={() => {
          setPasilloConsulta(null);
          setActiva(false);
        }}
      />
    );

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),2rem)] pb-32">
      <a className="saltar-contenido" href="#contenido">
        Saltar al contenido
      </a>
      <header className="flex items-center gap-3">
        <Cruz />
        <h1 className="text-2xl font-semibold tracking-tight">Rebotica 3D</h1>
      </header>

      <main id="contenido" tabIndex={-1} className="mt-8 flex-1">
        <ConsultaGuiada modo="informativo" onActiva={setActiva} onPasillo={setPasilloConsulta} />
        {!activa && (
          <>
            <div className="mt-8 flex flex-col gap-3">
              <a
                href="/escena?vista=3d"
                className="inline-flex min-h-14 items-center justify-center rounded-xl bg-cruz px-5 py-3 text-center text-lg font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cruz"
              >
                Explorar medicamentos
              </a>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-black/10 pt-4 text-sm text-tinta-suave">
        <p>{AVISO_LEGAL}</p>
        <div className="mt-3">
          <EstadoServidor />
        </div>
      </footer>
    </div>
  );
}
