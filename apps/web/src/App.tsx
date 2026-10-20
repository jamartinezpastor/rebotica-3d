import { AVISO_LEGAL, type PasilloResponse } from '@rebotica/shared';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
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
      {` · ${cajas} cajas · dpr ${Math.min(window.devicePixelRatio, 1.5).toFixed(2)}`}
    </p>
  );
}

/**
 * Vista de desarrollo del pasillo. `/escena` usa productos ficticios y `/escena?pasillo=<id>` los
 * de la API. Parámetros: `vista=3d|lista`, `cajas=N` (demo) y `fps=1` (contador).
 */
function VistaEscena({
  precargado,
  onNueva,
}: { precargado?: PasilloResponse; onNueva?: () => void } = {}) {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const pasillo = precargado?.id ?? params.get('pasillo');
  const cajasDemo = Math.min(Math.max(Number(params.get('cajas')) || 36, 1), 200);
  const mostrarVitrinaDemo = params.get('vitrina') === '1';
  const midiendo = params.get('fps') === '1';

  const capacidad = useMemo(() => evaluarCapacidad(detectarDispositivo()), []);
  const [vista, setVista] = useState<VistaElegida>(() =>
    vistaInicial(params.get('vista'), leerPreferencia(), capacidad),
  );
  const [lento, setLento] = useState(false);
  const [fps, setFps] = useState<EstadisticasFps | null>(null);
  const [agrupacion, setAgrupacion] = useState<Agrupacion>(() => {
    const valor = params.get('agrupar');
    return esAgrupacion(valor) ? valor : 'original';
  });

  const descargado = usePasillo(precargado ? null : pasillo);
  const cargado = useMemo(() => (precargado ? pasilloAEscena(precargado) : null), [precargado]);
  const remoto = cargado ?? descargado;
  const baldasDemoMemo = useMemo(
    () => [...baldasDemo(cajasDemo), ...(mostrarVitrinaDemo ? vitrinaDemo() : [])],
    [cajasDemo, mostrarVitrinaDemo],
  );
  const seleccion = useSeleccion();
  const baldasOrigen = pasillo && remoto.tipo === 'listo' ? remoto.baldas : baldasDemoMemo;
  const baldasAgrupadas = useMemo(
    () => agruparBaldas(baldasOrigen, agrupacion),
    [baldasOrigen, agrupacion],
  );

  const cambiarVista = (siguiente: VistaElegida) => {
    setVista(siguiente);
    guardarPreferencia(siguiente);
    setLento(false);
  };

  let titulo = 'Pasillo de demostración';
  const baldas = baldasAgrupadas;
  if (pasillo) {
    if (remoto.tipo === 'cargando') return <Preparando texto="Cargando el pasillo…" />;
    if (remoto.tipo === 'error') return <Preparando texto={remoto.mensaje} />;
    titulo = remoto.titulo;
  }
  const totalCajas = baldas.reduce((n, b) => n + b.productos.length, 0);
  const puede3d = capacidad.nivel !== 'sin3d';
  const borrador = !pasillo || (remoto.tipo === 'listo' && remoto.estado === 'borrador');

  return (
    <div
      className={vista === '3d' ? 'relative h-dvh w-full overflow-hidden' : 'relative min-h-dvh'}
    >
      {vista === '3d' ? (
        <Suspense fallback={<Preparando />}>
          <Escena
            baldas={baldas}
            seleccionada={seleccion.producto?.nregistro ?? null}
            onSeleccionar={seleccion.seleccionar}
            onFps={midiendo ? setFps : undefined}
            onLento={() => setLento(true)}
          />
        </Suspense>
      ) : (
        <VistaLista titulo={titulo} baldas={baldas} onSeleccionar={seleccion.seleccionar} />
      )}

      {midiendo && vista === '3d' && <ContadorFps e={fps} cajas={totalCajas} />}

      {!seleccion.producto && <SelectorAgrupacion valor={agrupacion} onCambiar={setAgrupacion} />}

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

      {!seleccion.producto && (
        <div
          className={`z-10 space-y-2 p-3 ${vista === '3d' ? 'pointer-events-none absolute inset-x-0 bottom-3' : ''}`}
        >
          {borrador && (
            <p
              role="note"
              className="rounded-xl bg-amber-50 p-3 text-base text-amber-950 ring-1 ring-amber-700"
            >
              Demostración: pendiente de validación farmacéutica
            </p>
          )}
          {remoto.tipo === 'listo' && remoto.estado === 'informativo' && (
            <p
              role="note"
              className="rounded-xl bg-white/95 p-3 text-base text-tinta ring-1 ring-cruz/30"
            >
              Catálogo informativo: las indicaciones de CIMA mencionan esta dolencia. No es una
              selección de tratamiento para ti. Consulta la ficha completa.
            </p>
          )}
        </div>
      )}

      {/* «Ver como lista» está siempre a mano (plan §reglas de interfaz). */}
      <div className="fixed top-3 right-3 z-10 flex flex-col items-end gap-2">
        {(vista === 'lista' ? puede3d : true) && (
          <button
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
            El 3D va lento en este dispositivo. La lista muestra lo mismo y es más ligera.
          </p>
        )}
      </div>

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
  // La portada enlaza a la demostración; los pasillos de la API se abren con ?pasillo=<id>.
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
      <header className="flex items-center gap-3">
        <Cruz />
        <h1 className="text-2xl font-semibold tracking-tight">Rebotica 3D</h1>
      </header>

      <main className="mt-8 flex-1">
        <ConsultaGuiada modo="informativo" onActiva={setActiva} onPasillo={setPasilloConsulta} />
        {!activa && (
          <>
            <div className="mt-8 flex flex-col gap-3">
              <a
                href="/escena?vitrina=1&vista=3d"
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
