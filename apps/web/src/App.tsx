import { AVISO_LEGAL } from '@rebotica/shared';
import { lazy, Suspense, useMemo } from 'react';
import { baldasDemo } from './escena/demo';
import { usePasillo } from './escena/usePasillo';
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

function EscenaDemo() {
  const baldas = useMemo(() => baldasDemo(), []);
  return <Escena baldas={baldas} />;
}

function EscenaPasillo({ id }: { id: string }) {
  const estado = usePasillo(id);
  if (estado.tipo === 'cargando') return <Preparando texto="Cargando el pasillo…" />;
  if (estado.tipo === 'error') return <Preparando texto={estado.mensaje} />;
  return <Escena baldas={estado.baldas} />;
}

/** Vista de desarrollo: `/escena` con productos ficticios o `/escena?pasillo=<id>` con datos reales. */
function VistaEscena() {
  const pasillo = new URLSearchParams(window.location.search).get('pasillo');
  return (
    <div className="h-dvh w-full">
      <Suspense fallback={<Preparando />}>
        {pasillo ? <EscenaPasillo id={pasillo} /> : <EscenaDemo />}
      </Suspense>
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
