import { AVISO_FICHA, type ProductoResumen } from '@rebotica/shared';
import { lazy, Suspense, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { esEnlaceCima, pestanasDe, type IdPestana, type SeccionMostrada } from './fichaSecciones';
import { useFicha } from './useFicha';
import { AvisoReceta } from './AvisoReceta';
import { instalarCierreExterior } from './cierreExterior';
import { FotoOficial } from './FotoOficial';
import { CargaVisual } from './CargaVisual';
import { NotasSeguridad, Suministro } from './InformacionCima';
import { IconoFicha } from './IconoFicha';
type PestanaFicha = IdPestana | 'suministro' | 'seguridad';
const CalculadoraDosis = lazy(() => import('./CalculadoraDosis'));

export interface PanelFichaProps {
  producto: ProductoResumen;
  onVolver: () => void;
  /** En 3D la hoja deja libre la parte alta, donde gira la caja; en lista ocupa más. */
  modo?: '3d' | 'lista';
  onComparar?: () => void;
  comparado?: boolean;
  totalComparados?: number;
}

function Parrafos({ lista }: { lista: string[] }) {
  return (
    <div className="space-y-2">
      {lista.map((p, i) => (
        <p key={i} className="text-base leading-relaxed">
          {p}
        </p>
      ))}
    </div>
  );
}

function Seccion({ seccion }: { seccion: SeccionMostrada }) {
  return (
    <details className="rounded-xl bg-black/[0.03] p-3">
      <summary className="min-h-11 cursor-pointer content-center text-base font-semibold">
        {seccion.titulo}
      </summary>
      <div className="mt-2 space-y-3">
        {seccion.resumenLlano && (
          <div>
            <p className="text-sm font-medium text-cruz">En palabras sencillas</p>
            <p className="text-base leading-relaxed">{seccion.resumenLlano}</p>
          </div>
        )}
        {seccion.parrafos.length > 0 &&
          (seccion.resumenLlano ? (
            <details>
              <summary className="cursor-pointer text-sm text-tinta-suave">
                Texto oficial de la ficha técnica
              </summary>
              <div className="mt-2">
                <Parrafos lista={seccion.parrafos} />
              </div>
            </details>
          ) : (
            <Parrafos lista={seccion.parrafos} />
          ))}
      </div>
    </details>
  );
}

/**
 * Ficha de un producto (plan §Ficha 3D): pestañas Uso, Precauciones y Dosis con el texto de la
 * ficha técnica, enlace al prospecto oficial y aviso legal. En 3D la caja gira encima.
 *
 * La pestaña Dosis muestra siempre la posología oficial en texto: la calculadora solo aparece
 * con una regla validada y vigente (principio 3).
 */
export function PanelFicha({
  producto,
  onVolver,
  modo = '3d',
  onComparar,
  comparado = false,
  totalComparados = 0,
}: PanelFichaProps) {
  const raiz = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const estado = useFicha(producto.nregistro);
  const [activa, setActiva] = useState<PestanaFicha>('uso');
  const [apertura, setApertura] = useState(0);
  const abrirPestana = (pestana: PestanaFicha) => {
    setActiva(pestana);
    // También reinicia los desplegables al volver a pulsar el icono activo.
    setApertura((valor) => valor + 1);
  };

  // Al abrir la ficha el foco pasa a ella: el lector de pantalla anuncia su título.
  useEffect(() => {
    const anterior = document.activeElement;
    raiz.current?.focus({ preventScroll: true });
    return () => {
      if (anterior instanceof HTMLElement && anterior.isConnected)
        anterior.focus({ preventScroll: true });
    };
  }, [producto.nregistro]);

  useEffect(() => {
    if (panel.current) return instalarCierreExterior(panel.current, onVolver);
  }, [onVolver]);

  const pestanas = estado.tipo === 'listo' ? pestanasDe(estado.ficha) : [];
  const orden: PestanaFicha[] = ['uso', 'precauciones', 'dosis', 'suministro', 'seguridad'];
  const etiquetas: Record<PestanaFicha, string> = {
    uso: 'Uso',
    precauciones: 'Avisos y precauciones',
    dosis: 'Dosis',
    suministro: 'Suministro',
    seguridad: 'Seguridad: notas de seguridad',
  };
  const etiquetasBreves: Record<PestanaFicha, string> = {
    uso: 'Uso',
    precauciones: 'Avisos',
    dosis: 'Dosis',
    suministro: 'Suministro',
    seguridad: 'Seguridad',
  };

  const alTeclear = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = orden.indexOf(activa);
    let siguiente: PestanaFicha | null = null;
    if (e.key === 'ArrowRight') siguiente = orden[(i + 1) % orden.length] ?? null;
    if (e.key === 'ArrowLeft') siguiente = orden[(i + orden.length - 1) % orden.length] ?? null;
    if (e.key === 'Home') siguiente = orden[0] ?? null;
    if (e.key === 'End') siguiente = orden.at(-1) ?? null;
    if (!siguiente) return;
    e.preventDefault();
    abrirPestana(siguiente);
    document.getElementById(`${id}-tab-${siguiente}`)?.focus();
  };

  const ficha = estado.tipo === 'listo' ? estado.ficha : null;
  const pestanaActiva = pestanas.find((p) => p.id === activa);

  const tecladoDialogo = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onVolver();
    }
    // En lista el fondo queda inerte. En 3D se conserva el acceso al giro de la caja.
    if (modo !== 'lista' || e.key !== 'Tab') return;
    const controles = Array.from(
      raiz.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], summary, input:not(:disabled), select:not(:disabled), [tabindex="0"]',
      ) ?? [],
    ).filter(
      (el) =>
        el.tabIndex >= 0 &&
        !el.closest('dialog:not([open]), [hidden], [inert]') &&
        Array.from(raiz.current?.querySelectorAll('details:not([open])') ?? []).every(
          (detalle) =>
            !detalle.contains(el) || detalle.querySelector(':scope > summary')?.contains(el),
        ),
    );
    const primero = controles[0];
    const ultimo = controles.at(-1);
    if (
      e.shiftKey &&
      (document.activeElement === primero || document.activeElement === raiz.current)
    ) {
      e.preventDefault();
      ultimo?.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero?.focus();
    }
  };

  return (
    <section
      ref={raiz}
      tabIndex={-1}
      role="dialog"
      aria-modal={modo === 'lista' ? true : undefined}
      aria-label={`Ficha de ${producto.nombre}`}
      onKeyDown={tecladoDialogo}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center outline-none"
    >
      <div
        ref={panel}
        className={`panel-ficha pointer-events-auto flex w-full max-w-md flex-col rounded-t-2xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] ring-1 ring-black/10 ${
          modo === '3d' ? 'max-h-[52dvh]' : 'max-h-[88dvh]'
        }`}
      >
        <div className="ficha-acciones flex shrink-0 items-center justify-between gap-3 border-b border-black/10 px-4 py-2">
          {onComparar ? (
            <button
              type="button"
              onClick={onComparar}
              aria-pressed={comparado}
              disabled={!comparado && totalComparados >= 2}
              className="min-h-11 rounded-lg px-2 text-sm font-semibold text-cruz ring-1 ring-cruz/30 disabled:text-tinta-suave disabled:opacity-60"
            >
              {comparado
                ? 'Quitar de comparación'
                : totalComparados >= 2
                  ? 'Comparación completa'
                  : 'Añadir a comparación'}
            </button>
          ) : (
            <p className="text-sm font-semibold text-tinta-suave">Ficha del medicamento</p>
          )}
          <button
            type="button"
            onClick={onVolver}
            aria-label="Volver al pasillo"
            className="min-h-11 rounded-lg bg-cruz px-3 text-base font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cruz"
          >
            Volver
          </button>
        </div>
        <div className="ficha-contenido min-h-0 flex-1 overflow-y-auto">
          <header className="px-4 pt-3">
            {onComparar && comparado && (
              <p role="status" className="mb-2 text-sm text-cruz">
                Medicamentos en comparación: {totalComparados} de 2.
              </p>
            )}
            {ficha?.borradorDosis && !ficha.reglaDosis && (
              <p
                role="status"
                className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-base text-aviso ring-1 ring-amber-200"
              >
                Demostración: pendiente de validación farmacéutica
              </p>
            )}
            {(producto.receta || ficha?.receta) && <AvisoReceta />}
            <div className="flex items-start gap-3">
              {ficha?.asset?.foto && (
                <FotoOficial
                  key={ficha.asset.foto}
                  foto={ficha.asset.foto}
                  ampliable
                  alt="Foto del envase publicada en CIMA"
                />
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-lg leading-snug font-semibold break-words">
                  {producto.nombre}
                </h2>
                <p className="mt-1 text-sm font-medium text-cruz">
                  {[producto.principioActivo, producto.forma].filter(Boolean).join(' · ')}
                </p>
                {(ficha?.categoria ?? producto.categoria) && (
                  <p className="text-sm text-tinta-suave">
                    {ficha?.categoria ?? producto.categoria}
                  </p>
                )}
                {(ficha?.laboratorio ?? producto.laboratorio) && (
                  <p className="text-sm text-tinta-suave">
                    {ficha?.laboratorio ?? producto.laboratorio}
                  </p>
                )}
              </div>
            </div>
            {ficha?.problemaSuministro && (
              <p
                role="status"
                className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-aviso ring-1 ring-amber-200"
              >
                Hay problemas de suministro notificados. Consulta la pestaña Suministro.
              </p>
            )}
          </header>

          <div
            role="tablist"
            aria-label="Información del producto"
            className="ficha-pestanas sticky top-0 z-10 mt-2 grid grid-cols-5 gap-1 bg-white px-4 py-2"
          >
            {orden.map((p) => (
              <button
                key={p}
                id={`${id}-tab-${p}`}
                type="button"
                role="tab"
                aria-label={etiquetas[p]}
                title={etiquetas[p]}
                aria-selected={activa === p}
                aria-controls={`${id}-panel`}
                tabIndex={activa === p ? 0 : -1}
                onClick={() => abrirPestana(p)}
                onKeyDown={alTeclear}
                className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-lg py-2 text-[11px] leading-tight font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cruz ${
                  activa === p ? 'bg-cruz text-white' : 'bg-black/5 text-tinta'
                }`}
              >
                <IconoFicha tipo={p} />
                <span>{etiquetasBreves[p]}</span>
              </button>
            ))}
          </div>

          <div
            key={`${producto.nregistro}-${activa}-${apertura}`}
            id={`${id}-panel`}
            role="tabpanel"
            aria-labelledby={`${id}-tab-${activa}`}
            tabIndex={0}
            className="mt-3 space-y-3 px-4 pb-3"
          >
            {estado.tipo === 'cargando' && <CargaVisual texto="Cargando la ficha…" compacta />}
            {estado.tipo === 'error' && (
              <p role="status" className="text-base text-tinta-suave">
                {estado.noDisponible
                  ? 'No hay ficha disponible para este producto.'
                  : 'No se pudo cargar la ficha de este producto. Inténtalo de nuevo en unos minutos.'}
              </p>
            )}
            {ficha && activa === 'suministro' && <Suministro ficha={ficha} />}
            {ficha && activa === 'seguridad' && <NotasSeguridad ficha={ficha} />}
            {ficha && activa === 'dosis' && !ficha.reglaDosis && (
              <p className="rounded-lg bg-cruz-claro px-3 py-2 text-sm text-tinta">
                Esta es la posología oficial de la ficha técnica, no una pauta personalizada. La
                dosis depende de la edad, el peso y la situación de cada persona: consulta a tu
                médico o farmacéutico.
              </p>
            )}
            {ficha && activa === 'dosis' && !ficha.reglaDosis && ficha.borradorDosis && (
              <p className="text-sm text-tinta-suave">
                Regla {ficha.borradorDosis.id}, versión {ficha.borradorDosis.version}, en borrador.
                No habilita la calculadora.
              </p>
            )}
            {ficha && activa === 'dosis' && ficha.reglaDosis !== null && (
              <details className="rounded-xl bg-black/[0.03] p-3">
                <summary className="min-h-11 cursor-pointer content-center text-base font-semibold">
                  Calculadora de dosis
                </summary>
                <div className="mt-2">
                  <Suspense fallback={<p role="status">Preparando la calculadora…</p>}>
                    <CalculadoraDosis ficha={ficha} />
                  </Suspense>
                </div>
              </details>
            )}
            {ficha && pestanaActiva && pestanaActiva.secciones.length === 0 && (
              <p className="text-base text-tinta-suave">
                No hay información de este apartado. Consulta el prospecto oficial.
              </p>
            )}
            {pestanaActiva?.secciones.map((s) => (
              <Seccion key={s.seccion} seccion={s} />
            ))}
          </div>
        </div>

        <footer className="shrink-0 space-y-1.5 border-t border-black/10 px-4 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
          {ficha && (
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-base">
              {esEnlaceCima(ficha.enlaces.prospecto) && (
                <a
                  href={ficha.enlaces.prospecto}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-cruz underline"
                >
                  Prospecto oficial en CIMA
                </a>
              )}
              {esEnlaceCima(ficha.enlaces.fichaTecnica) && (
                <a
                  href={ficha.enlaces.fichaTecnica}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-cruz underline"
                >
                  Ficha técnica oficial
                </a>
              )}
            </p>
          )}
          <p className="text-sm text-tinta-suave">{AVISO_FICHA}</p>
        </footer>
      </div>
    </section>
  );
}
