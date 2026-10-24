import { AVISO_LEGAL, type ProductoResumen, type ProductoResponse } from '@rebotica/shared';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { AvisoReceta } from './AvisoReceta';
import { FotoOficial } from './FotoOficial';
import { CargaVisual } from './CargaVisual';
import { esEnlaceCima, parrafos } from './fichaSecciones';
import { useFicha, type EstadoFicha } from './useFicha';

const CAMPOS: { titulo: string; valor: (f: ProductoResponse) => string | null }[] = [
  { titulo: 'Principio activo', valor: (f) => f.principioActivo },
  { titulo: 'Forma farmacéutica', valor: (f) => f.forma },
  { titulo: 'Laboratorio', valor: (f) => f.laboratorio },
  { titulo: 'Categoría', valor: (f) => f.categoria },
  { titulo: 'Identificación EFG', valor: (f) => (f.generico ? 'Sí' : 'No') },
  {
    titulo: 'Pictograma de conducción',
    valor: (f) => (f.conduccion ? 'Presente en CIMA' : 'Sin pictograma en esta copia'),
  },
  {
    titulo: 'Suministro',
    valor: (f) =>
      f.problemaSuministro
        ? 'Problemas de suministro indicados en CIMA'
        : 'Sin problemas de suministro indicados en esta copia',
  },
];
const SECCIONES = [
  ['4.1', 'Indicaciones oficiales'],
  ['4.3', 'Contraindicaciones'],
  ['4.4', 'Advertencias y precauciones'],
  ['4.5', 'Interacciones'],
  ['4.6', 'Embarazo y lactancia'],
  ['4.7', 'Conducción y manejo de máquinas'],
  ['4.2', 'Posología oficial'],
] as const;
interface Columna {
  producto: ProductoResumen;
  estado: EstadoFicha;
}
const fichaDe = (c: Columna) => (c.estado.tipo === 'listo' ? c.estado.ficha : null);
const nombreDe = (c: Columna) => fichaDe(c)?.nombre ?? c.producto.nombre;
const conReceta = (c: Columna) => c.producto.receta || !!fichaDe(c)?.receta;

function Contenido({
  estado,
  children,
}: {
  estado: EstadoFicha;
  children: (f: ProductoResponse) => ReactNode;
}) {
  if (estado.tipo === 'cargando')
    return <p className="text-sm text-tinta-suave">Pendiente de cargar la ficha.</p>;
  if (estado.tipo === 'error')
    return <p className="text-sm text-tinta-suave">Datos no disponibles para esta ficha.</p>;
  return children(estado.ficha);
}

export default function Comparacion({
  primero,
  segundo,
  onCerrar,
}: {
  primero: ProductoResumen;
  segundo: ProductoResumen;
  onCerrar: () => void;
}) {
  const estadoPrimero = useFicha(primero.nregistro);
  const estadoSegundo = useFicha(segundo.nregistro);
  const columnas: Columna[] = [
    { producto: primero, estado: estadoPrimero },
    { producto: segundo, estado: estadoSegundo },
  ];
  const dialogo = useRef<HTMLDialogElement>(null);
  const titulo = useId();
  useEffect(() => {
    const el = dialogo.current;
    const origen = document.activeElement;
    el?.showModal();
    return () => {
      el?.close();
      if (origen instanceof HTMLElement && origen.isConnected)
        origen.focus({ preventScroll: true });
    };
  }, []);
  function celdas(contenido: (f: ProductoResponse) => ReactNode) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {columnas.map((c) => (
          <div
            key={c.producto.nregistro}
            className={`min-w-0 rounded-lg border p-3 ${conReceta(c) ? 'border-amber-700 bg-amber-50/40' : 'border-black/10 bg-white'}`}
          >
            <p className="mb-2 text-sm font-semibold break-words">
              {nombreDe(c)}
              {conReceta(c) && <span className="ml-2 text-amber-900">· Con receta</span>}
            </p>
            <Contenido estado={c.estado}>{contenido}</Contenido>
          </div>
        ))}
      </div>
    );
  }
  return (
    <dialog
      ref={dialogo}
      aria-labelledby={titulo}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onCerrar();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') e.stopPropagation();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
      className="m-auto max-h-[92dvh] w-[min(96vw,64rem)] max-w-none overflow-hidden rounded-2xl bg-papel p-0 text-tinta shadow-2xl backdrop:bg-slate-950/60"
    >
      <div className="flex max-h-[92dvh] flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-black/10 bg-white px-4 py-3">
          <h2 id={titulo} className="text-xl font-semibold">
            Comparación de medicamentos
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            className="min-h-11 rounded-lg bg-cruz px-3 font-semibold text-white"
          >
            Volver al catálogo
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          <p className="text-sm text-tinta-suave">
            Información de la copia local de CIMA. Comparar estos datos no establece equivalencias
            ni elige un tratamiento.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {columnas.map((c) => {
              const ficha = fichaDe(c);
              return (
                <section
                  key={c.producto.nregistro}
                  aria-label={`Ficha comparada de ${nombreDe(c)}`}
                  className={`min-w-0 rounded-xl border-2 bg-white p-3 ${conReceta(c) ? 'border-amber-700' : 'border-cruz/30'}`}
                >
                  <p
                    className={`mb-2 text-sm font-semibold ${conReceta(c) ? 'text-amber-900' : 'text-cruz'}`}
                  >
                    {conReceta(c) ? 'Con receta' : 'Sin receta'}
                  </p>
                  <div className="flex items-start gap-3">
                    {ficha?.asset?.foto && (
                      <FotoOficial
                        key={ficha.asset.foto}
                        foto={ficha.asset.foto}
                        ampliable
                        alt={`Foto del envase de ${nombreDe(c)} publicada en CIMA`}
                      />
                    )}
                    <div className="min-w-0">
                      <h3 className="font-semibold break-words">{nombreDe(c)}</h3>
                      <p className="mt-1 text-sm text-tinta-suave">
                        Registro CIMA: {c.producto.nregistro}
                      </p>
                    </div>
                  </div>
                  {conReceta(c) && (
                    <div className="mt-3">
                      <AvisoReceta />
                    </div>
                  )}
                  {c.estado.tipo === 'cargando' && (
                    <CargaVisual texto={`Cargando ficha de ${c.producto.nombre}…`} compacta />
                  )}
                  {c.estado.tipo === 'error' && (
                    <p role="status" className="mt-3 text-sm">
                      {c.estado.noDisponible
                        ? 'No hay ficha disponible para este medicamento.'
                        : 'No se pudo cargar esta ficha. Vuelve al catálogo e inténtalo de nuevo.'}
                    </p>
                  )}
                  {ficha && (
                    <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                      {esEnlaceCima(ficha.enlaces.prospecto) && (
                        <a
                          className="font-semibold text-cruz underline"
                          href={ficha.enlaces.prospecto}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Prospecto oficial
                        </a>
                      )}
                      {esEnlaceCima(ficha.enlaces.fichaTecnica) && (
                        <a
                          className="font-semibold text-cruz underline"
                          href={ficha.enlaces.fichaTecnica}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Ficha técnica oficial
                        </a>
                      )}
                    </p>
                  )}
                </section>
              );
            })}
          </div>
          {CAMPOS.map((campo) => (
            <section key={campo.titulo} aria-label={campo.titulo}>
              <h3 className="mb-2 font-semibold">{campo.titulo}</h3>
              {celdas((f) => (
                <p className="text-base break-words">
                  {campo.valor(f)?.trim() || 'No consta en esta copia.'}
                </p>
              ))}
            </section>
          ))}
          {SECCIONES.map(([codigo, nombre]) => (
            <section key={codigo} aria-label={`${nombre} (${codigo})`}>
              <h3 className="mb-2 font-semibold">
                {nombre} · {codigo}
              </h3>
              {codigo === '4.2' && (
                <p className="mb-2 text-sm text-tinta-suave">
                  Texto oficial de cada ficha. No se calculan ni se comparan dosis equivalentes.
                </p>
              )}
              {celdas((f) => {
                const texto = f.secciones.find((s) => s.seccion === codigo)?.texto.trim();
                return texto ? (
                  <details>
                    <summary className="min-h-11 cursor-pointer py-2 font-semibold text-cruz">
                      Leer texto oficial
                    </summary>
                    <div className="mt-2 space-y-3">
                      {parrafos(texto).map((p, i) => (
                        <p key={i} className="text-base leading-relaxed break-words">
                          {p}
                        </p>
                      ))}
                    </div>
                  </details>
                ) : (
                  <p className="text-sm text-tinta-suave">
                    Sección no disponible en esta copia. Consulta la ficha técnica oficial.
                  </p>
                );
              })}
            </section>
          ))}
        </div>
        <footer className="shrink-0 border-t border-black/10 bg-white px-4 py-3 text-sm text-tinta-suave">
          {AVISO_LEGAL}
        </footer>
      </div>
    </dialog>
  );
}
