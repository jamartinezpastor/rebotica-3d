import { CONSULTAS_FRECUENTES, ConsultaMostrador, LIMITE_CONSULTA } from '@rebotica/shared';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';

type IdConsulta = (typeof CONSULTAS_FRECUENTES)[number]['id'];
const VACIO = {
  texto: '',
  chip: null as IdConsulta | null,
  mensaje: null as string | null,
};
const BOTON =
  'min-h-12 rounded-xl px-4 py-3 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cruz disabled:cursor-not-allowed disabled:opacity-50';

/** F4-01: entrada y revisión local. No interpreta síntomas ni abre un pasillo clínico. */
export function Mostrador({
  onContinuar,
  onRevision,
  directo = false,
}: {
  onContinuar?: (consulta: ConsultaMostrador) => void;
  onRevision?: (activa: boolean) => void;
  directo?: boolean;
} = {}) {
  const id = useId();
  const entrada = useRef<HTMLTextAreaElement>(null);
  const revision = useRef<HTMLHeadingElement>(null);
  const enfocarEntrada = useRef(false);
  const [borrador, setBorrador] = useState(VACIO);
  const [todas, setTodas] = useState(false);
  const [consulta, setConsulta] = useState<ConsultaMostrador | null>(null);

  useEffect(() => {
    // Vacía también el DOM antes de que el navegador congele la página en su caché de navegación.
    const borrar = () =>
      flushSync(() => {
        setBorrador(VACIO);
        setConsulta(null);
        setTodas(false);
        onRevision?.(false);
      });
    const restaurar = (e: PageTransitionEvent) => {
      if (e.persisted) borrar();
    };
    window.addEventListener('pagehide', borrar);
    window.addEventListener('pageshow', restaurar);
    return () => {
      window.removeEventListener('pagehide', borrar);
      window.removeEventListener('pageshow', restaurar);
    };
  }, [onRevision]);

  useEffect(() => {
    if (consulta) revision.current?.focus();
    else if (enfocarEntrada.current) {
      entrada.current?.focus();
      enfocarEntrada.current = false;
    }
  }, [consulta]);

  const enfocar = () => {
    if (entrada.current) entrada.current.focus();
    else enfocarEntrada.current = true;
  };
  const nueva = () => {
    setBorrador(VACIO);
    setConsulta(null);
    onRevision?.(false);
    enfocar();
  };
  const revisar = (evento: FormEvent) => {
    evento.preventDefault();
    const analizada = ConsultaMostrador.safeParse(
      borrador.chip
        ? { origen: 'chip', protocoloId: borrador.chip }
        : { origen: 'texto', texto: borrador.texto },
    );
    if (!analizada.success) {
      setBorrador((b) => ({
        ...b,
        mensaje: `Escribe una consulta de entre 1 y ${LIMITE_CONSULTA} caracteres.`,
      }));
      entrada.current?.focus();
      return;
    }
    if (directo && onContinuar) {
      onContinuar(analizada.data);
      return;
    }
    setConsulta(analizada.data);
    onRevision?.(true);
  };
  const elegir = (id: IdConsulta, etiqueta: string) => {
    if (directo && onContinuar) {
      onContinuar({ origen: 'chip', protocoloId: id });
      return;
    }
    setBorrador({ texto: etiqueta, chip: id, mensaje: null });
  };
  const textoRevision =
    consulta?.origen === 'texto'
      ? consulta.texto
      : CONSULTAS_FRECUENTES.find((c) => c.id === consulta?.protocoloId)?.etiqueta;
  const puedeRevisar = borrador.texto.trim().length > 0;

  return (
    <section aria-labelledby={`${id}-titulo`}>
      {consulta ? (
        <div className="space-y-4">
          <h2
            ref={revision}
            tabIndex={-1}
            id={`${id}-titulo`}
            className="text-3xl font-semibold outline-none"
          >
            Revisa tu consulta
          </h2>
          <p className="text-base text-tinta-suave">Comprueba que recoge lo que querías contar.</p>
          <p className="rounded-2xl bg-white p-4 text-lg whitespace-pre-wrap ring-1 ring-cruz/30">
            {textoRevision}
          </p>
          <p
            role="note"
            className="rounded-xl bg-amber-50 p-4 text-base text-amber-950 ring-1 ring-amber-700"
          >
            Esta consulta no se ha evaluado. Antes de ver productos debes completar las preguntas de
            seguridad. Para recibir consejo sobre tu salud, habla con tu farmacéutico.
          </p>
          {onContinuar && (
            <>
              <p className="text-base text-tinta-suave">
                Al pulsar Continuar se envía esta consulta al servidor. Si has escrito texto, Gemini
                identifica el motivo y las alarmas. No guardamos el texto ni las respuestas.
              </p>
              <button
                type="button"
                onClick={() => onContinuar(consulta)}
                className={`${BOTON} w-full bg-cruz text-white`}
              >
                Continuar
              </button>
            </>
          )}
          <p className="text-base text-tinta-suave">
            Al empezar una nueva consulta o salir de esta página se borra el texto.
          </p>
        </div>
      ) : (
        <>
          <form id={`${id}-form`} onSubmit={revisar} noValidate>
            <label
              id={`${id}-titulo`}
              htmlFor={`${id}-texto`}
              className="block text-base font-semibold"
            >
              Cuéntanos qué te pasa
            </label>
            <textarea
              ref={entrada}
              id={`${id}-texto`}
              value={borrador.texto}
              rows={2}
              maxLength={LIMITE_CONSULTA}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="sentences"
              enterKeyHint="send"
              aria-describedby={`${id}-limite${borrador.mensaje ? ` ${id}-error` : ''}`}
              aria-invalid={!!borrador.mensaje}
              placeholder="Por ejemplo: me duele la garganta desde ayer."
              onChange={(e) => {
                setBorrador({ texto: e.target.value, chip: null, mensaje: null });
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return;
                e.preventDefault();
                if (!e.repeat) e.currentTarget.form?.requestSubmit();
              }}
              className="mt-2 w-full resize-y rounded-2xl border border-cruz/40 bg-white p-4 text-lg placeholder:text-tinta-suave focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cruz"
            />
            <p id={`${id}-limite`} className="mt-1 text-right text-base text-tinta-suave">
              {borrador.texto.length}/{LIMITE_CONSULTA} caracteres
            </p>
            {puedeRevisar && (
              <button type="submit" className={`${BOTON} mt-3 w-full bg-cruz text-white`}>
                Realizar consulta
              </button>
            )}
            {borrador.mensaje && (
              <p id={`${id}-error`} role="alert" className="mt-3 text-base text-aviso">
                {borrador.mensaje}
              </p>
            )}
          </form>
          <fieldset className="mt-6">
            <legend className="mb-3 text-base font-semibold">Consultas frecuentes</legend>
            <div id={`${id}-chips`} className="grid grid-cols-2 gap-2">
              {(todas ? CONSULTAS_FRECUENTES : CONSULTAS_FRECUENTES.slice(0, 4)).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={borrador.chip === c.id}
                  onClick={() => elegir(c.id, c.etiqueta)}
                  className={`${BOTON} text-left ${borrador.chip === c.id ? 'bg-cruz text-white' : 'bg-white text-cruz ring-1 ring-cruz/30'}`}
                >
                  {c.etiqueta}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-expanded={todas}
              aria-controls={`${id}-chips`}
              onClick={() => setTodas(!todas)}
              className={`${BOTON} mt-2 w-full text-cruz underline`}
            >
              {todas ? 'Ver menos consultas' : 'Ver más consultas'}
            </button>
          </fieldset>
        </>
      )}
      {consulta && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-cruz/20 bg-papel px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <div className="mx-auto flex max-w-md gap-3">
            <button
              type="button"
              onClick={nueva}
              className={`${BOTON} flex-1 bg-white text-cruz ring-1 ring-cruz`}
            >
              Nueva consulta
            </button>
            <button
              type="button"
              onClick={() => {
                setConsulta(null);
                onRevision?.(false);
                enfocar();
              }}
              className={`${BOTON} flex-1 bg-cruz text-white`}
            >
              Editar consulta
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
