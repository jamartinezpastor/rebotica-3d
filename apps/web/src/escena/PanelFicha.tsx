import type { ProductoResumen } from '@rebotica/shared';
import { useEffect, useRef } from 'react';

export interface PanelFichaProps {
  producto: ProductoResumen;
  onVolver: () => void;
}

/**
 * Cabecera provisional de la ficha: la caja de la escena aterriza detrás y aquí va el nombre.
 * La ficha completa (pestañas Uso, Precauciones y Dosis) es F3-01. No muestra dosis: el campo
 * `dosis` de CIMA es la concentración del envase, y la pauta solo sale de una regla validada.
 */
export function PanelFicha({ producto, onVolver }: PanelFichaProps) {
  const volver = useRef<HTMLButtonElement>(null);

  // Al abrir la ficha el foco pasa al botón: el teclado y el lector de pantalla siguen el cambio.
  useEffect(() => {
    volver.current?.focus();
  }, [producto.nregistro]);

  return (
    <section
      role="dialog"
      aria-label={`Ficha de ${producto.nombre}`}
      className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
    >
      <div className="pointer-events-auto w-full max-w-md rounded-2xl bg-white/95 p-4 shadow-lg ring-1 ring-black/10">
        <h2 className="text-xl leading-snug font-semibold">{producto.nombre}</h2>
        <p className="mt-1 text-base text-tinta-suave">{producto.principioActivo}</p>
        {producto.forma && <p className="text-base text-tinta-suave">{producto.forma}</p>}
        <button
          ref={volver}
          type="button"
          onClick={onVolver}
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-cruz px-4 text-base font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cruz"
        >
          Volver al pasillo
        </button>
      </div>
    </section>
  );
}
