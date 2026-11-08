export interface DestinoEstanteria {
  titulo: string;
  receta: boolean;
  registro?: string;
}

export function DialEstanterias({
  estanterias,
  actual,
  onIr,
}: {
  estanterias: readonly DestinoEstanteria[];
  actual: number;
  onIr: (indice: number) => void;
}) {
  if (estanterias.length < 2) return null;
  const posicion = Math.max(0, Math.min(actual, estanterias.length - 1));
  const elegida = estanterias[posicion]!;
  const zona = elegida.receta ? 'Con receta' : 'Sin receta';
  // Se conserva cada paso del dial; solo se reduce la densidad del dibujo en catálogos grandes.
  const marcas = Math.min(estanterias.length, 121);
  return (
    <nav
      aria-label="Navegar por estanterías"
      className="dial-estanterias pointer-events-auto mx-auto w-full max-w-xl rounded-2xl bg-white/95 px-4 pt-1 pb-2 shadow-lg ring-1 ring-black/10"
      data-receta={elegida.receta}
    >
      <div className="flex min-w-0 items-center gap-3">
        <select
          aria-label="Elegir estantería"
          value={posicion}
          onChange={(e) => onIr(Number(e.target.value))}
          className="min-h-11 min-w-0 flex-1 truncate rounded-lg bg-transparent text-base font-medium focus-visible:outline-2 focus-visible:outline-cruz sm:text-sm"
        >
          {estanterias.map((estanteria, i) => (
            <option key={i} value={i} disabled={!estanteria.registro}>
              {i + 1}. {estanteria.receta ? 'Con receta' : 'Sin receta'} · {estanteria.titulo}
            </option>
          ))}
        </select>
        <span className="shrink-0 text-xs tabular-nums text-tinta-suave" aria-hidden="true">
          {posicion + 1} / {estanterias.length}
        </span>
      </div>
      <div className="relative h-11">
        <div
          className="pointer-events-none absolute inset-x-[2px] inset-y-0 flex items-center justify-between"
          aria-hidden="true"
        >
          {Array.from({ length: marcas }, (_, i) => {
            const indice = Math.round((i * (estanterias.length - 1)) / (marcas - 1));
            return (
              <span
                key={i}
                className={`${i % 5 === 0 || i === marcas - 1 ? 'h-6' : 'h-3'} w-px ${estanterias[indice]?.receta ? 'bg-amber-600/60' : 'bg-cruz/35'}`}
              />
            );
          })}
        </div>
        <input
          type="range"
          aria-label="Ir a estantería"
          aria-valuetext={`Estantería ${posicion + 1} de ${estanterias.length}. ${zona}. ${elegida.titulo}`}
          min={0}
          max={estanterias.length - 1}
          step={1}
          value={posicion}
          onChange={(e) => onIr(Number(e.target.value))}
          className="dial-estanterias-control relative block h-11 w-full rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cruz"
        />
      </div>
      <div className="flex justify-between text-[11px] text-tinta-suave" aria-hidden="true">
        <span>Inicio</span>
        <span className={elegida.receta ? 'font-semibold text-amber-800' : 'text-cruz'}>
          {zona}
        </span>
        <span>Fin</span>
      </div>
    </nav>
  );
}
