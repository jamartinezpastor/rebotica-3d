import type { ProductoResumen } from '@rebotica/shared';
import { COLOR_LADO_DEFECTO } from './colores';
import type { BaldaEscena } from './Pasillo';

export interface VistaListaProps {
  titulo: string;
  baldas: readonly BaldaEscena[];
  onSeleccionar: (producto: ProductoResumen) => void;
}

function Etiqueta({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-cruz-claro px-2 py-0.5 text-sm font-medium text-cruz">
      {children}
    </span>
  );
}

/**
 * Pasillo como lista: el mismo contenido y la misma acción que la escena 3D, sin WebGL. Es la
 * vista para dispositivos débiles, para lectores de pantalla y para quien prefiere no moverse
 * por un pasillo (plan: «Ver como lista» siempre disponible).
 */
export function VistaLista({ titulo, baldas, onSeleccionar }: VistaListaProps) {
  return (
    <main className="mx-auto max-w-2xl px-4 pt-20 pb-40" aria-labelledby="titulo-pasillo">
      <h1 id="titulo-pasillo" className="text-2xl font-semibold tracking-tight">
        {titulo}
      </h1>

      {baldas.map((balda, i) => {
        const id = `balda-${i}`;
        return (
          <section key={`${balda.titulo}-${i}`} aria-labelledby={id} className="mt-8">
            <h2 id={id} className="text-lg font-semibold text-cruz">
              {balda.titulo}
            </h2>
            {balda.productos.length === 0 ? (
              <p className="mt-2 text-base text-tinta-suave">
                No hay productos disponibles para este grupo.
              </p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {balda.productos.map((p) => (
                  <li key={p.nregistro}>
                    <button
                      type="button"
                      onClick={() => onSeleccionar(p)}
                      className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-white p-3 text-left ring-1 ring-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cruz"
                    >
                      <span
                        aria-hidden="true"
                        className="h-10 w-10 shrink-0 rounded-md ring-1 ring-black/10"
                        style={{ backgroundColor: p.asset?.colorDominante ?? COLOR_LADO_DEFECTO }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-base leading-snug font-medium">{p.nombre}</span>
                        <span className="block text-sm text-tinta-suave">
                          {[p.principioActivo, p.forma].filter(Boolean).join(' · ')}
                        </span>
                        {(p.generico || p.conduccion) && (
                          <span className="mt-1 flex flex-wrap gap-1">
                            {p.generico && <Etiqueta>Genérico</Etiqueta>}
                            {p.conduccion && <Etiqueta>Puede afectar a la conducción</Etiqueta>}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </main>
  );
}
