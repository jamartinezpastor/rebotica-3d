import { AGRUPACIONES, esAgrupacion, type Agrupacion } from './agrupacion';

export function SelectorAgrupacion({
  valor,
  onCambiar,
}: {
  valor: Agrupacion;
  onCambiar: (valor: Agrupacion) => void;
}) {
  return (
    <div className="fixed inset-x-3 top-18 z-10 mx-auto max-w-xl rounded-xl bg-white/95 p-3 shadow ring-1 ring-black/15">
      <label className="flex flex-wrap items-center gap-2 text-base font-semibold">
        Agrupar por
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
      {valor === 'infantil' && (
        <p className="mt-2 text-base text-tinta-suave">
          Solo se clasifica con reglas validadas. La edad y las restricciones concretas se consultan
          en la ficha.
        </p>
      )}
      {valor === 'consultas' && (
        <p className="mt-2 text-base text-tinta-suave">
          Asociaciones de protocolos revisados. Agrupar no sustituye el triaje ni la valoración
          profesional.
        </p>
      )}
    </div>
  );
}
