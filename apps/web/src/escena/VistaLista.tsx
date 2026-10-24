import type { ProductoResumen } from '@rebotica/shared';
import { useLayoutEffect, useRef } from 'react';
import { COLOR_LADO_DEFECTO } from './colores';
import type { BaldaEscena } from './Pasillo';
import { AvisoReceta } from './AvisoReceta';
import type { RetornoLista } from './navegacionCatalogo';
import { FotoOficial } from './FotoOficial';

export interface VistaListaProps {
  titulo: string;
  baldas: readonly BaldaEscena[];
  onSeleccionar: (producto: ProductoResumen) => void;
  retorno?: RetornoLista;
  conHerramientas?: boolean;
  pagina?: number;
}

/**
 * Foto del envase tal como la publica CIMA (miniatura de la propia API). Si el producto no tiene
 * foto se muestra un cuadro con su color de marca, para no dejar un hueco.
 */
function Miniatura({ producto }: { producto: ProductoResumen }) {
  return (
    <FotoOficial
      key={`${producto.nregistro}:${producto.asset?.foto}`}
      foto={producto.asset?.foto ?? null}
      color={producto.asset?.colorDominante ?? COLOR_LADO_DEFECTO}
    />
  );
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
export function VistaLista({
  titulo,
  baldas,
  onSeleccionar,
  retorno,
  conHerramientas = false,
  pagina = 0,
}: VistaListaProps) {
  const cabecera = useRef<HTMLHeadingElement>(null);
  const raiz = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const destino = Array.from(
      raiz.current?.querySelectorAll<HTMLElement>('[data-registro]') ?? [],
    ).find((el) => el.dataset.registro === retorno?.registro);
    (destino ?? cabecera.current)?.focus({ preventScroll: true });
    if (retorno) {
      const borde =
        document.querySelector('[data-herramientas-catalogo]')?.getBoundingClientRect().bottom ?? 0;
      const top =
        retorno.scrollY ??
        Math.max(0, (destino ?? cabecera.current)?.getBoundingClientRect().top ?? 0) +
          window.scrollY -
          borde -
          12;
      if (window.scrollY !== Math.max(0, top))
        window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
    }
  }, [retorno]);
  return (
    <main
      ref={raiz}
      className={`mx-auto max-w-2xl px-4 ${conHerramientas ? 'pt-6' : 'pt-64'} pb-40`}
      aria-labelledby="titulo-pasillo"
    >
      <h1
        ref={cabecera}
        tabIndex={-1}
        id="titulo-pasillo"
        className="text-2xl font-semibold tracking-tight"
      >
        {titulo}
      </h1>
      {baldas.length === 0 && (
        <p role="status" className="mt-6">
          No hay medicamentos que coincidan con estos filtros.
        </p>
      )}

      <div key={pagina} className="entrada-resultados">
        {baldas.map((balda, i) => {
          const id = `balda-${i}`;
          return (
            <section
              key={`${balda.titulo}-${i}`}
              aria-labelledby={id}
              className={
                balda.receta
                  ? 'mt-8 rounded-2xl border-2 border-amber-700 bg-slate-900 p-4 text-white'
                  : 'mt-8'
              }
            >
              <h2
                id={id}
                className={`text-lg font-semibold ${balda.receta ? 'text-amber-200' : 'text-cruz'}`}
              >
                {balda.receta ? `Vitrina con receta · ${balda.titulo}` : balda.titulo}
              </h2>
              {balda.receta && (
                <div className="mt-3">
                  <AvisoReceta />
                </div>
              )}
              {balda.descripcion && <p className="mt-3 text-base">{balda.descripcion}</p>}
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
                        data-cursor="medicamento"
                        data-registro={p.nregistro}
                        onClick={(e) => {
                          e.currentTarget.focus({ preventScroll: true });
                          onSeleccionar(p);
                        }}
                        className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-white p-3 text-left text-tinta ring-1 ring-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cruz"
                      >
                        <Miniatura producto={p} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-base leading-snug font-semibold break-words">
                            {p.nombre}
                          </span>
                          {p.receta && (
                            <span className="block text-base font-semibold text-amber-900">
                              ⚠ Requiere receta médica
                            </span>
                          )}
                          <span className="mt-1 block text-sm font-medium text-cruz">
                            {p.principioActivo}
                          </span>
                          {p.forma && (
                            <span className="block text-sm text-tinta-suave">{p.forma}</span>
                          )}
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
      </div>
    </main>
  );
}
