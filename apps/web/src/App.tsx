import { AVISO_LEGAL } from '@rebotica/shared';
import { useEstadoApi } from './useEstadoApi';

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
