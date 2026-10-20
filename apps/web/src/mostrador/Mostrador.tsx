import { CONSULTAS_FRECUENTES, ConsultaMostrador, LIMITE_CONSULTA } from '@rebotica/shared';
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { useDictado } from './useDictado';

type IdConsulta = (typeof CONSULTAS_FRECUENTES)[number]['id'];
const VACIO = {
  texto: '',
  chip: null as IdConsulta | null,
  mensaje: null as string | null,
  bloqueado: false,
};
const BOTON =
  'min-h-12 rounded-xl px-4 py-3 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cruz disabled:cursor-not-allowed disabled:opacity-50';

/** F4-01: entrada y revisión local. No interpreta síntomas ni abre un pasillo clínico. */
export function Mostrador({
  onContinuar,
  onRevision,
}: {
  onContinuar?: (consulta: ConsultaMostrador) => void;
  onRevision?: (activa: boolean) => void;
} = {}) {
  const id = useId();
  const entrada = useRef<HTMLTextAreaElement>(null);
  const revision = useRef<HTMLHeadingElement>(null);
  const enfocarEntrada = useRef(false);
  const [borrador, setBorrador] = useState(VACIO);
  const [todas, setTodas] = useState(false);
  const [consulta, setConsulta] = useState<ConsultaMostrador | null>(null);
  const recibirTexto = useCallback((texto: string) => {
    setBorrador((anterior) => {
      if (anterior.bloqueado) return anterior;
      const unido = [anterior.texto.trimEnd(), texto].filter(Boolean).join(' ');
      if (unido.length > LIMITE_CONSULTA)
        return {
          ...anterior,
          bloqueado: true,
          mensaje:
            'El último fragmento del dictado no se ha añadido porque supera el límite. Acorta el texto o empieza una nueva consulta antes de continuar.',
        };
      return { texto: unido, chip: null, mensaje: null, bloqueado: false };
    });
  }, []);
  const dictado = useDictado(recibirTexto);
  const { cancelar } = dictado;
  const activo = dictado.fase !== 'reposo';

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
    if (borrador.bloqueado) cancelar();
  }, [borrador.bloqueado, cancelar]);
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
    cancelar();
    setBorrador(VACIO);
    setConsulta(null);
    onRevision?.(false);
    enfocar();
  };
  const revisar = (evento: FormEvent) => {
    evento.preventDefault();
    if (activo || borrador.bloqueado) return;
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
    cancelar();
    setConsulta(analizada.data);
    onRevision?.(true);
  };
  const elegir = (id: IdConsulta, etiqueta: string) => {
    cancelar();
    setBorrador({ texto: etiqueta, chip: id, mensaje: null, bloqueado: false });
  };
  const textoRevision =
    consulta?.origen === 'texto'
      ? consulta.texto
      : CONSULTAS_FRECUENTES.find((c) => c.id === consulta?.protocoloId)?.etiqueta;
  const puedeRevisar = !activo && !borrador.bloqueado && borrador.texto.trim().length > 0;

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
                Al pulsar Continuar se envía esta consulta al servidor. Si has escrito texto, Claude
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
          <h2 id={`${id}-titulo`} className="text-3xl leading-tight font-semibold">
            Hola, ¿qué te pasa?
          </h2>
          <p className="mt-3 text-base text-tinta-suave">
            Cuéntalo con tus palabras o elige una consulta frecuente.
          </p>
          <p
            role="note"
            className="mt-4 rounded-xl bg-amber-50 p-3 text-base text-amber-950 ring-1 ring-amber-700"
          >
            Para orientar tu consulta necesitas completar un triaje con un protocolo validado.
          </p>
          <form id={`${id}-form`} onSubmit={revisar} noValidate className="mt-5">
            <label htmlFor={`${id}-texto`} className="block text-base font-semibold">
              Describe tu consulta
            </label>
            <textarea
              ref={entrada}
              id={`${id}-texto`}
              value={borrador.texto}
              rows={4}
              maxLength={LIMITE_CONSULTA}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="sentences"
              aria-describedby={`${id}-privacidad ${id}-limite${borrador.mensaje ? ` ${id}-error` : ''}`}
              aria-invalid={!!borrador.mensaje}
              placeholder="Por ejemplo: me duele la garganta desde ayer."
              onChange={(e) => {
                cancelar();
                setBorrador({ texto: e.target.value, chip: null, mensaje: null, bloqueado: false });
              }}
              className="mt-2 w-full resize-y rounded-2xl border border-cruz/40 bg-white p-4 text-lg placeholder:text-tinta-suave focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cruz"
            />
            <p id={`${id}-limite`} className="mt-1 text-right text-base text-tinta-suave">
              {borrador.texto.length}/{LIMITE_CONSULTA} caracteres
            </p>
            <p id={`${id}-privacidad`} className="mt-2 text-base text-tinta-suave">
              No incluyas tu nombre ni datos de contacto. El texto permanece en esta página hasta
              que revises la consulta y pulses Continuar.
            </p>
            {borrador.mensaje && (
              <p id={`${id}-error`} role="alert" className="mt-3 text-base text-aviso">
                {borrador.mensaje}
              </p>
            )}
            <div className="mt-3">
              <button
                type="button"
                aria-describedby={`${id}-voz`}
                aria-pressed={activo}
                disabled={dictado.disponibilidad !== 'disponible' || dictado.fase === 'finalizando'}
                onClick={() => (activo ? dictado.detener() : dictado.empezar())}
                className={`${BOTON} w-full bg-white text-cruz ring-1 ring-cruz`}
              >
                {dictado.fase === 'finalizando'
                  ? 'Terminando dictado…'
                  : activo
                    ? 'Detener dictado'
                    : 'Dictar consulta'}
              </button>
              <p id={`${id}-voz`} className="mt-2 text-base text-tinta-suave">
                {dictado.disponibilidad === 'comprobando'
                  ? 'Comprobando el dictado local…'
                  : dictado.disponibilidad === 'noDisponible'
                    ? 'El dictado local no está disponible en este navegador. Puedes escribir o elegir una consulta frecuente.'
                    : 'Dictado en español en este dispositivo. El micrófono solo se activa al pulsar Dictar consulta.'}
              </p>
              <p role="status" className="mt-2 text-base text-cruz">
                {dictado.fase === 'iniciando'
                  ? 'Esperando permiso del micrófono…'
                  : dictado.fase === 'escuchando'
                    ? 'Escuchando. Habla y revisa después el texto.'
                    : dictado.fase === 'finalizando'
                      ? 'Preparando el texto del dictado…'
                      : ''}
              </p>
              {dictado.mensaje && (
                <p role="alert" className="mt-2 text-base text-aviso">
                  {dictado.mensaje}
                </p>
              )}
            </div>
          </form>
          <fieldset className="mt-6">
            <legend className="mb-3 text-base font-semibold">Consultas frecuentes</legend>
            <div id={`${id}-chips`} className="grid grid-cols-2 gap-2">
              {(todas ? CONSULTAS_FRECUENTES : CONSULTAS_FRECUENTES.slice(0, 10)).map((c) => (
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
              {todas ? 'Ver menos consultas' : 'Ver todas las consultas'}
            </button>
          </fieldset>
        </>
      )}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-cruz/20 bg-papel px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="mx-auto flex max-w-md gap-3">
          <button
            type="button"
            onClick={nueva}
            className={`${BOTON} flex-1 bg-white text-cruz ring-1 ring-cruz`}
          >
            Nueva consulta
          </button>
          {consulta ? (
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
          ) : (
            <button
              type="submit"
              form={`${id}-form`}
              disabled={!puedeRevisar}
              className={`${BOTON} flex-1 bg-cruz text-white`}
            >
              Revisar consulta
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
