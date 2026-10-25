import { calcularDosis, type CondicionPaciente } from '@rebotica/dosis';
import type { ProductoResponse } from '@rebotica/shared';
import { useEffect, useId, useState } from 'react';
import { flushSync } from 'react-dom';
import { prepararCalculadora } from './prepararCalculadora';
import { DibujoDosis, numeroDosis, unidadDosis } from './DibujoDosis';

const CONDICIONES: { id: CondicionPaciente; texto: string }[] = [
  { id: 'embarazo', texto: 'Embarazo' },
  { id: 'lactancia', texto: 'Lactancia' },
  { id: 'hepatopatiaGrave', texto: 'Enfermedad hepática grave' },
  { id: 'insuficienciaRenal', texto: 'Insuficiencia renal' },
  { id: 'anticoagulantes', texto: 'Toma anticoagulantes' },
  { id: 'alergiaAINE', texto: 'Alergia a antiinflamatorios' },
  { id: 'ulceraPeptica', texto: 'Úlcera péptica' },
];
const edadTexto = (meses: number) =>
  meses < 24
    ? `${meses} meses`
    : `${Math.floor(meses / 12)} años${meses % 12 ? ` y ${meses % 12} meses` : ''}`;
const noDisponible = (
  <p role="note" className="rounded-xl bg-amber-50 p-3 text-base text-amber-950">
    La calculadora no está disponible para esta ficha. Consulta la posología oficial y a tu médico o
    farmacéutico.
  </p>
);

export default function CalculadoraDosis({ ficha }: { ficha: ProductoResponse }) {
  const preparada = prepararCalculadora(ficha);
  return preparada ? (
    <Formulario
      key={`${ficha.nregistro}:${preparada.regla.version}:${preparada.fuenteActual.hashSeccion}`}
      preparada={preparada}
    />
  ) : (
    noDisponible
  );
}

function Formulario({
  preparada,
}: {
  preparada: NonNullable<ReturnType<typeof prepararCalculadora>>;
}) {
  const id = useId();
  const [edad, setEdad] = useState('');
  const [peso, setPeso] = useState('');
  const [motivo, setMotivo] = useState('');
  const [condiciones, setCondiciones] = useState<CondicionPaciente[]>([]);
  const [pesoConfirmado, setPesoConfirmado] = useState(false);
  useEffect(() => {
    const limpiar = () =>
      flushSync(() => {
        setEdad('');
        setPeso('');
        setMotivo('');
        setCondiciones([]);
        setPesoConfirmado(false);
      });
    const restaurar = (e: PageTransitionEvent) => {
      if (e.persisted) limpiar();
    };
    window.addEventListener('pagehide', limpiar);
    window.addEventListener('pageshow', restaurar);
    return () => {
      window.removeEventListener('pagehide', limpiar);
      window.removeEventListener('pageshow', restaurar);
    };
  }, []);
  const { regla, fuenteActual } = preparada;
  const cambiarEdad = (valor: string) => {
    setEdad(valor);
    setPesoConfirmado(false);
  };
  const cambiarPeso = (valor: string) => {
    setPeso(valor);
    setPesoConfirmado(false);
  };
  const edadMeses = Number(edad);
  const pesoKg = Number(peso);
  const completos = edad !== '' && peso !== '' && motivo !== '';
  const validos =
    Number.isInteger(edadMeses) &&
    edadMeses >= 0 &&
    edadMeses <= 1200 &&
    Number.isFinite(pesoKg) &&
    pesoKg >= 3 &&
    pesoKg <= 150;
  const resultado =
    completos && validos
      ? calcularDosis(regla, {
          edadMeses,
          pesoKg,
          motivo,
          condiciones,
          pesoConfirmado,
          fuenteActual,
        })
      : null;
  return (
    <section
      aria-label="Calculadora de dosis"
      className="space-y-4 rounded-xl border border-cruz/30 bg-cruz-claro/40 p-3"
    >
      <h3 className="text-lg font-semibold">Calculadora de dosis</h3>
      <p className="text-base">
        Introduce los datos para consultar la regla revisada de esta presentación. Los datos se
        calculan en tu dispositivo.
      </p>
      <details className="text-base">
        <summary className="min-h-11 cursor-pointer font-semibold">
          Fuente y versión de la regla
        </summary>
        <p>
          Regla {regla.id}, versión {regla.version}. Revisada por {regla.fuente.validadoPor} el{' '}
          {regla.fuente.fecha}.
        </p>
        <p className="mt-2 text-sm break-words">
          Registro CIMA: {fuenteActual.nregistro}. Sección 4.2. Huella: {fuenteActual.hashSeccion}.
        </p>
        <blockquote className="mt-2 border-l-2 border-cruz pl-3">{regla.fuente.cita}</blockquote>
      </details>
      <div>
        <label htmlFor={`${id}-edad`} className="block text-base font-semibold">
          Edad: {edad === '' ? 'sin indicar' : edadTexto(edadMeses)}
        </label>
        <input
          id={`${id}-edad`}
          type="range"
          min="0"
          max="1200"
          step="1"
          value={edad || 0}
          aria-valuetext={edad === '' ? 'Sin indicar' : edadTexto(edadMeses)}
          onChange={(e) => cambiarEdad(e.target.value)}
          className="min-h-11 w-full accent-cruz"
        />
        <label className="flex items-center gap-2 text-base">
          Edad en meses
          <input
            type="number"
            min="0"
            max="1200"
            step="1"
            value={edad}
            onChange={(e) => cambiarEdad(e.target.value)}
            className="min-h-11 w-28 rounded-lg border border-black/25 bg-white px-2"
          />
        </label>
      </div>
      <div>
        <label htmlFor={`${id}-peso`} className="block text-base font-semibold">
          Peso: {peso === '' ? 'sin indicar' : `${numeroDosis(pesoKg)} kg`}
        </label>
        <input
          id={`${id}-peso`}
          type="range"
          min="3"
          max="150"
          step="0.1"
          value={peso || 3}
          aria-valuetext={peso === '' ? 'Sin indicar' : `${numeroDosis(pesoKg)} kg`}
          onChange={(e) => cambiarPeso(e.target.value)}
          className="min-h-11 w-full accent-cruz"
        />
        <label className="flex items-center gap-2 text-base">
          Peso en kg
          <input
            type="number"
            min="3"
            max="150"
            step="0.1"
            value={peso}
            onChange={(e) => cambiarPeso(e.target.value)}
            className="min-h-11 w-28 rounded-lg border border-black/25 bg-white px-2"
          />
        </label>
      </div>
      <label className="block text-base font-semibold">
        Motivo de consulta
        <select
          value={motivo}
          onChange={(e) => {
            setMotivo(e.target.value);
            setPesoConfirmado(false);
          }}
          className="mt-1 min-h-11 w-full rounded-lg border border-black/25 bg-white px-2 text-base"
        >
          <option value="">Selecciona el motivo</option>
          {Object.keys(regla.diasMaxSinConsultar).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className="text-base font-semibold">Situaciones y otros medicamentos</legend>
        {CONDICIONES.map((c) => (
          <label key={c.id} className="flex min-h-11 items-center gap-3 text-base">
            <input
              type="checkbox"
              checked={condiciones.includes(c.id)}
              onChange={(e) => {
                setCondiciones((actual) =>
                  e.target.checked ? [...actual, c.id] : actual.filter((v) => v !== c.id),
                );
                setPesoConfirmado(false);
              }}
              className="h-5 w-5 accent-cruz"
            />
            {c.texto}
          </label>
        ))}
      </fieldset>
      <div role="status" aria-live="polite" aria-atomic="true" className="space-y-3">
        {!completos && (
          <p className="text-base">Indica edad, peso y motivo para ver el resultado.</p>
        )}
        {completos && !validos && (
          <p className="text-base">
            Revisa los datos: edad entre 0 y 1200 meses y peso entre 3 y 150 kg.
          </p>
        )}
        {resultado?.tipo === 'derivar' && (
          <p className="rounded-xl border border-amber-700 bg-amber-50 p-3 text-base text-amber-950">
            {resultado.mensaje}
          </p>
        )}
        {resultado?.tipo === 'noDisponible' && (
          <p className="text-base">
            No se puede obtener una pauta segura con estos datos. Consulta la posología oficial y a
            un profesional.
          </p>
        )}
        {resultado?.tipo === 'confirmarPeso' && (
          <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-amber-950">
            <p className="text-base">{resultado.mensaje}</p>
            <button
              type="button"
              onClick={() => setPesoConfirmado(true)}
              className="min-h-11 rounded-lg bg-cruz px-3 text-base font-semibold text-white"
            >
              Confirmar edad y peso
            </button>
          </div>
        )}
        {resultado?.tipo === 'calculada' && (
          <>
            <p className="text-2xl font-semibold">
              {numeroDosis(resultado.cantidadToma)}{' '}
              {unidadDosis(resultado.unidadToma, resultado.cantidadToma)} por toma
            </p>
            <p className="text-base">
              {numeroDosis(resultado.mgToma)} mg por toma. Deja al menos{' '}
              {numeroDosis(resultado.intervaloHoras)} horas entre tomas.
            </p>
            <p className="text-base">
              Máximo {resultado.maxTomasDia} tomas en 24 horas y {numeroDosis(resultado.maxMgDia)}{' '}
              mg al día.
            </p>
            <p className="text-base">
              Consulta si necesitas continuar más de {resultado.diasMaxSinConsultar} días para este
              motivo.
            </p>
            <DibujoDosis resultado={resultado} />
            {resultado.avisos.length > 0 && (
              <p className="rounded-lg bg-amber-50 p-3 text-base text-amber-950">
                Consulta con un profesional por:{' '}
                {resultado.avisos.map((a) => CONDICIONES.find((c) => c.id === a)?.texto).join(', ')}
                .
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
