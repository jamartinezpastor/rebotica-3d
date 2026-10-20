import { useEffect, useRef, useState, type FormEvent } from 'react';
import { respuestaValida, type PreguntaTriaje } from '@rebotica/shared';

const GRUPOS = [
  { valor: 'adulto', etiqueta: 'Adulto' },
  { valor: 'nino', etiqueta: 'Niño' },
  { valor: 'bebe', etiqueta: 'Bebé' },
  { valor: 'embarazo', etiqueta: 'Embarazo' },
  { valor: 'lactancia', etiqueta: 'Lactancia' },
];
export function Pregunta({
  pregunta,
  ocupada,
  onResponder,
}: {
  pregunta: PreguntaTriaje;
  ocupada: boolean;
  onResponder: (valor: string | number | boolean) => void;
}) {
  const [numero, setNumero] = useState('');
  const [error, setError] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titulo.current?.focus();
  }, []);
  const opciones =
    pregunta.tipo === 'grupo'
      ? GRUPOS
      : pregunta.tipo === 'siNo'
        ? [
            { valor: true, etiqueta: 'Sí' },
            { valor: false, etiqueta: 'No' },
          ]
        : pregunta.opciones;
  const enviarNumero = (e: FormEvent) => {
    e.preventDefault();
    const valor = Number(numero);
    if (!numero.trim() || !respuestaValida(pregunta, valor)) {
      setError(true);
      return;
    }
    onResponder(valor);
  };
  return (
    <section aria-labelledby="pregunta-titulo" className="space-y-4">
      <h2
        ref={titulo}
        tabIndex={-1}
        id="pregunta-titulo"
        className="text-2xl font-semibold outline-none"
      >
        {pregunta.texto}
      </h2>
      {opciones ? (
        <div className="grid gap-3">
          {opciones.map((o) => (
            <button
              key={String(o.valor)}
              type="button"
              disabled={ocupada}
              onClick={() => onResponder(o.valor)}
              className="min-h-12 rounded-xl bg-white p-4 text-left text-lg font-semibold text-cruz ring-1 ring-cruz disabled:opacity-50"
            >
              {o.etiqueta}
            </button>
          ))}
        </div>
      ) : (
        <form onSubmit={enviarNumero} className="space-y-3" noValidate>
          <label className="block text-base" htmlFor="respuesta-numero">
            {pregunta.tipo === 'edad' ? 'Edad en meses' : 'Duración en horas'}
          </label>
          <p className="text-base text-tinta-suave">
            {pregunta.tipo === 'edad'
              ? 'Un año son 12 meses. En un bebé menor de un mes puedes indicar una fracción.'
              : 'Un día son 24 horas.'}{' '}
            Si no lo sabes, consulta con tu farmacéutico antes de continuar.
          </p>
          <input
            id="respuesta-numero"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            autoComplete="off"
            value={numero}
            disabled={ocupada}
            onChange={(e) => {
              setNumero(e.target.value);
              setError(false);
            }}
            aria-invalid={error}
            aria-describedby={error ? 'respuesta-error' : undefined}
            className="min-h-12 w-full rounded-xl border border-cruz bg-white p-3 text-lg"
          />
          {error && (
            <p id="respuesta-error" role="alert">
              Introduce un número válido mayor o igual que cero.
            </p>
          )}
          <button
            disabled={ocupada}
            className="min-h-12 w-full rounded-xl bg-cruz p-3 font-semibold text-white disabled:opacity-50"
          >
            Confirmar respuesta
          </button>
        </form>
      )}
    </section>
  );
}
