import { AGRUPACIONES, esAgrupacion, type Agrupacion } from './agrupacion';
import type { ReactNode } from 'react';

export function SelectorAgrupacion({
  valor,
  onCambiar,
  children,
  destinos = [],
  onIr,
}: {
  valor: Agrupacion;
  onCambiar: (valor: Agrupacion) => void;
  children?: ReactNode;
  destinos?: { registro: string; texto: string }[];
  onIr?: (registro: string) => void;
}) {
  return (
    <div className="relative rounded-xl bg-white/95 p-3 shadow ring-1 ring-black/15">
      {children}
      <div className="flex items-start gap-2">
        <label className="flex min-w-0 flex-1 items-center text-base font-semibold">
          <span className="sr-only">Agrupar por</span>
          <select
            value={valor}
            onChange={(e) => {
              if (esAgrupacion(e.target.value)) onCambiar(e.target.value);
            }}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-black/20 bg-white px-2 text-base focus-visible:outline-2 focus-visible:outline-cruz"
          >
            {AGRUPACIONES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.texto}
              </option>
            ))}
          </select>
        </label>
        {destinos.length > 1 && (
          <details name="herramientas-catalogo">
            <summary className="flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-3 font-semibold text-cruz ring-1 ring-cruz/30">
              Grupos <span aria-hidden="true">⌄</span>
            </summary>
            <div className="absolute inset-x-0 top-full z-20 rounded-xl bg-white p-4 shadow-lg ring-1 ring-black/15">
              <label className="block space-y-2 text-base font-semibold">
                <span>Ir a grupo</span>
                <select
                  value=""
                  onChange={(e) => {
                    const detalle = e.currentTarget.closest('details');
                    if (detalle) detalle.open = false;
                    onIr?.(e.target.value);
                  }}
                  className="min-h-11 w-full min-w-0 rounded-lg border border-black/20 bg-white px-2 font-normal"
                >
                  <option value="" disabled>
                    Elegir grupo…
                  </option>
                  {destinos.map((d) => (
                    <option key={d.registro} value={d.registro}>
                      {d.texto}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </details>
        )}
      </div>
      {valor === 'infantil' && (
        <p className="mt-2 text-base text-tinta-suave">
          Solo se clasifica con reglas validadas. La edad y las restricciones concretas se consultan
          en la ficha.
        </p>
      )}
      {valor === 'consultas' && (
        <p className="mt-2 text-base text-tinta-suave">
          Agrupa por las dolencias asociadas. Se conservan todos los medicamentos del resultado.
        </p>
      )}
    </div>
  );
}
