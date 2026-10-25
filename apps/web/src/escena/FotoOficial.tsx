import { useEffect, useId, useRef, useState } from 'react';

export function FotoOficial({
  foto,
  color = '#e3f3ea',
  ampliable = false,
  alt = '',
}: {
  foto: string | null;
  color?: string;
  ampliable?: boolean;
  alt?: string;
}) {
  const [estado, setEstado] = useState<'cargando' | 'lista' | 'error'>('cargando');
  const [abierta, setAbierta] = useState(false);
  const dialogo = useRef<HTMLDialogElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    const el = dialogo.current;
    if (!el) return;
    if (abierta && !el.open) el.showModal();
    if (!abierta && el.open) el.close();
  }, [abierta]);
  const sinFoto = !foto || estado === 'error';
  const miniatura = (
    <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-black/10">
      {sinFoto ? (
        <span
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center"
          style={{ backgroundColor: color }}
        >
          <svg viewBox="0 0 40 40" className="h-10 w-10 text-white drop-shadow">
            <path
              d="m8 13 13-6 12 6v17l-13 6-12-6V13Zm0 0 12 6 13-6M20 19v17"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
          </svg>
        </span>
      ) : (
        <>
          {estado === 'cargando' && (
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-cruz-claro motion-safe:animate-pulse"
            />
          )}
          <img
            src={foto}
            alt={alt}
            width={64}
            height={64}
            loading={ampliable ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={() => setEstado('lista')}
            onError={() => {
              setEstado('error');
              setAbierta(false);
            }}
            className={`h-full w-full object-contain transition-opacity motion-reduce:transition-none ${estado === 'lista' ? 'opacity-100' : 'opacity-0'}`}
          />
        </>
      )}
    </span>
  );
  if (!ampliable || sinFoto) return miniatura;
  return (
    <>
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierta(true)}
        aria-label="Foto CIMA: ampliar foto del envase"
        className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cruz"
      >
        {miniatura}
        <span className="mt-1 block text-xs font-semibold text-cruz">Foto CIMA</span>
      </button>
      <dialog
        ref={dialogo}
        aria-labelledby={id}
        onCancel={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAbierta(false);
        }}
        onClose={() => {
          setAbierta(false);
          boton.current?.focus({ preventScroll: true });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') e.stopPropagation();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setAbierta(false);
        }}
        className="m-auto max-h-[90dvh] w-[min(90vw,40rem)] overflow-y-auto rounded-2xl bg-white p-5 text-tinta shadow-2xl backdrop:bg-slate-950/60"
      >
        <header className="flex items-start justify-between gap-3">
          <h3 id={id} className="text-lg font-semibold">
            Foto oficial del envase · CIMA
          </h3>
          <button
            type="button"
            onClick={() => setAbierta(false)}
            aria-label="Cerrar foto ampliada"
            className="min-h-11 shrink-0 rounded-lg bg-cruz-claro px-3 font-semibold text-cruz"
          >
            Cerrar
          </button>
        </header>
        {abierta && (
          <img
            src={foto}
            alt="Foto ampliada del envase publicada en CIMA"
            className="mx-auto mt-4 max-h-[60dvh] w-full object-contain"
          />
        )}
        <p className="mt-3 text-sm text-tinta-suave">
          Se muestra la imagen disponible en CIMA, sin modificar el envase.
        </p>
      </dialog>
    </>
  );
}
