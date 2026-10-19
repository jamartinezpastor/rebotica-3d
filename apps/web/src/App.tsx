import { AVISO_LEGAL } from '@rebotica/shared';
import { lazy, Suspense, useMemo, useState } from 'react';
import { baldasDemo, vitrinaDemo } from './escena/demo';
import {
  detectarDispositivo,
  evaluarCapacidad,
  vistaInicial,
  type VistaElegida,
} from './escena/capacidad';
import type { EstadisticasFps } from './escena/medidorFps';
import { PanelFicha } from './escena/PanelFicha';
import { usePasillo } from './escena/usePasillo';
import { useSeleccion } from './escena/useSeleccion';
import { VistaLista } from './escena/VistaLista';
import { useEstadoApi } from './useEstadoApi';

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
      className="pointer-events-none absolute top-3 left-3 z-10 rounded-md bg-black/75 px-2 py-1 font-mono text-xs text-white"
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
function VistaEscena() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const pasillo = params.get('pasillo');
  const cajasDemo = Math.min(Math.max(Number(params.get('cajas')) || 36, 1), 200);
  const mostrarVitrinaDemo = params.get('vitrina') === '1';
  const midiendo = params.get('fps') === '1';

  const capacidad = useMemo(() => evaluarCapacidad(detectarDispositivo()), []);
  const [vista, setVista] = useState<VistaElegida>(() =>
    vistaInicial(params.get('vista'), leerPreferencia(), capacidad),
  );
  const [lento, setLento] = useState(false);
  const [fps, setFps] = useState<EstadisticasFps | null>(null);

  const remoto = usePasillo(pasillo);
  const baldasDemoMemo = useMemo(
    () => [...baldasDemo(cajasDemo), ...(mostrarVitrinaDemo ? vitrinaDemo() : [])],
    [cajasDemo, mostrarVitrinaDemo],
  );
  const seleccion = useSeleccion();

  const cambiarVista = (siguiente: VistaElegida) => {
    setVista(siguiente);
    guardarPreferencia(siguiente);
    setLento(false);
  };

  let titulo = 'Pasillo de demostración';
  let baldas = baldasDemoMemo;
  if (pasillo) {
    if (remoto.tipo === 'cargando') return <Preparando texto="Cargando el pasillo…" />;
    if (remoto.tipo === 'error') return <Preparando texto={remoto.mensaje} />;
    titulo = remoto.titulo;
    baldas = remoto.baldas;
  }
  const totalCajas = baldas.reduce((n, b) => n + b.productos.length, 0);
  const puede3d = capacidad.nivel !== 'sin3d';
  const borrador = !pasillo || (remoto.tipo === 'listo' && remoto.estado === 'borrador');
  const tieneVitrina = baldas.some((b) => b.receta);

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
          {tieneVitrina && vista === '3d' && (
            <p
              role="note"
              className="rounded-xl border-2 border-amber-500 bg-slate-900 p-3 text-base text-white"
            >
              ⚠ Al final del pasillo: vitrina con receta. Estos medicamentos requieren indicación
              médica.
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
  // Vista de desarrollo de la escena (F2-01); el pasillo real llega con las rutas de F2-03.
  if (window.location.pathname === '/escena') return <VistaEscena />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),2rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <header className="flex items-center gap-3">
        <Cruz />
        <h1 className="text-2xl font-semibold tracking-tight">Rebotica 3D</h1>
      </header>

      <main className="mt-12 flex-1">
        <p className="text-3xl leading-tight font-semibold">Hola, soy tu farmacéutico.</p>
        <p className="mt-3 text-lg text-tinta-suave">
          Pronto podrás contarme qué te pasa y recorrer las estanterías en 3D.
        </p>
        <div className="mt-8">
          <EstadoServidor />
        </div>
      </main>

      <footer className="border-t border-black/10 pt-4 text-sm text-tinta-suave">
        {AVISO_LEGAL}
      </footer>
    </div>
  );
}
