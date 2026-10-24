import type { ProductoResumen } from '@rebotica/shared';
import { useRef } from 'react';

export function BarraComparacion({
  productos,
  onQuitar,
  onAbrir,
}: {
  productos: readonly ProductoResumen[];
  onQuitar: (registro: string) => void;
  onAbrir: () => void;
}) {
  const resumen = useRef<HTMLElement>(null);
  return (
    <div className="relative flex items-center justify-between gap-2 rounded-xl bg-white/95 p-2 shadow ring-1 ring-cruz/40">
      <details
        name="herramientas-catalogo"
        className="min-w-0 flex-1"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            e.currentTarget.open = false;
            resumen.current?.focus({ preventScroll: true });
          }
        }}
      >
        <summary
          ref={resumen}
          className="flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-2 font-semibold text-cruz"
        >
          Comparación ({productos.length}/2) <span aria-hidden="true">⌃</span>
        </summary>
        <div className="absolute inset-x-0 bottom-full z-20 mb-2 max-h-[45dvh] overflow-y-auto rounded-xl bg-white p-3 shadow-lg ring-1 ring-black/15">
          <p className="mb-2 text-sm text-tinta-suave">
            Elige hasta dos medicamentos desde sus fichas.
          </p>
          <ul className="space-y-2">
            {productos.map((p) => (
              <li
                key={p.nregistro}
                className={`flex items-start gap-2 rounded-lg p-2 ${p.receta ? 'bg-amber-50 ring-1 ring-amber-700' : 'bg-cruz-claro'}`}
              >
                <span className="min-w-0 flex-1 text-sm font-semibold break-words">
                  {p.nombre}
                  {p.receta && <span className="block text-amber-900">Requiere receta</span>}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (productos.length > 1) resumen.current?.focus({ preventScroll: true });
                    onQuitar(p.nregistro);
                  }}
                  aria-label={`Quitar ${p.nombre} de la comparación`}
                  className="min-h-11 shrink-0 rounded-lg px-2 font-semibold text-cruz"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        </div>
      </details>
      <p role="status" className="sr-only">
        {productos.length} de 2 medicamentos seleccionados para comparar.
      </p>
      <button
        type="button"
        disabled={productos.length !== 2}
        onClick={onAbrir}
        aria-label="Comparar medicamentos"
        className="min-h-11 shrink-0 rounded-lg bg-cruz px-3 font-semibold text-white disabled:bg-black/10 disabled:text-tinta-suave"
      >
        Comparar
      </button>
    </div>
  );
}
