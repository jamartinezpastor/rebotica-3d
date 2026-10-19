import { useId } from 'react';
import type { ResultadoDosis } from '@rebotica/dosis';

type Calculada = Extract<ResultadoDosis, { tipo: 'calculada' }>;
export const numeroDosis = (valor: number) =>
  new Intl.NumberFormat('es-ES', {
    maximumSignificantDigits: 17,
    useGrouping: false,
  }).format(valor);

export function unidadDosis(unidad: Calculada['unidadToma'], cantidad: number): string {
  if (unidad === 'ml') return 'ml';
  const singular = unidad === 'capsula' ? 'cápsula' : unidad;
  return cantidad === 1 ? singular : `${singular}s`;
}

/** Esquema de la cantidad por toma. La cifra es autoritativa; no simula la escala de un envase real. */
export function DibujoDosis({ resultado }: { resultado: Calculada }) {
  const id = useId();
  const cantidad = resultado.cantidadToma;
  const texto = `${numeroDosis(cantidad)} ${unidadDosis(resultado.unidadToma, cantidad)} por toma`;
  return (
    <figure className="rounded-xl bg-white p-3 ring-1 ring-cruz/20">
      {resultado.unidadToma === 'ml' ? (
        <svg
          role="img"
          aria-label={`Jeringa dosificadora: ${texto}`}
          viewBox="0 0 280 90"
          className="mx-auto h-24 w-full max-w-80"
        >
          <path
            d="M20 25h28v40H20m14-40v40M48 33h170v24H48zM218 40h30v10h-30m30-5h15"
            fill="none"
            stroke="#1d2420"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M58 37h155v16H58z" fill="#0f8a4b" opacity=".75" />
          <text x="130" y="80" textAnchor="middle" fontSize="16" fill="#1d2420">
            {numeroDosis(cantidad)} ml
          </text>
        </svg>
      ) : (
        <svg
          role="img"
          aria-label={texto}
          viewBox="0 0 280 65"
          className="mx-auto h-20 w-full max-w-80"
        >
          {Array.from({ length: Math.min(6, Math.ceil(cantidad)) }, (_, i) => {
            const fraccion = Math.min(1, cantidad - i);
            const x = 8 + i * 44;
            const sobre = resultado.unidadToma === 'sobre';
            return (
              <g key={i}>
                <defs>
                  <clipPath id={`${id}-${i}`}>
                    <rect x={x} y="12" width={34 * fraccion} height="40" />
                  </clipPath>
                </defs>
                <rect
                  x={x}
                  y="12"
                  width="34"
                  height="40"
                  rx={sobre ? 2 : 17}
                  fill="#f3f6f4"
                  stroke="#315d44"
                  strokeWidth="2"
                />
                <rect
                  x={x}
                  y="12"
                  width="34"
                  height="40"
                  rx={sobre ? 2 : 17}
                  fill="#0f8a4b"
                  clipPath={`url(#${id}-${i})`}
                  opacity=".7"
                />
                {resultado.unidadToma === 'comprimido' && (
                  <path d={`M${x + 3} 32h28`} stroke="#ffffff" strokeWidth="2" />
                )}
              </g>
            );
          })}
        </svg>
      )}
      <figcaption className="mt-1 text-base text-tinta-suave">
        Esquema orientativo. Usa la presentación y el dispositivo dosificador indicados en el
        prospecto.
      </figcaption>
    </figure>
  );
}
