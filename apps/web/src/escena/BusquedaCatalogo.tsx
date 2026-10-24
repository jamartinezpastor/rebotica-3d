import { FILTROS_INICIALES, hayFiltros, type FiltrosCatalogo } from './filtrosCatalogo';

export function BusquedaCatalogo({
  valor,
  onCambiar,
  opciones,
  coincidencias,
  total,
}: {
  valor: FiltrosCatalogo;
  onCambiar: (valor: FiltrosCatalogo) => void;
  opciones: { formas: string[]; laboratorios: string[] };
  coincidencias: number;
  total: number;
}) {
  const estilo = 'min-h-11 w-full rounded-lg border border-black/20 bg-white px-3 text-base';
  return (
    <div className="mb-3 space-y-2">
      <div className="flex items-start gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Buscar medicamentos</span>
          <input
            type="search"
            value={valor.texto}
            onChange={(e) => onCambiar({ ...valor, texto: e.target.value })}
            placeholder="Nombre o principio activo"
            maxLength={150}
            className={estilo}
          />
        </label>
        <details className="group" name="herramientas-catalogo">
          <summary className="flex min-h-11 cursor-pointer items-center rounded-lg px-3 font-semibold text-cruz ring-1 ring-cruz/30">
            Filtros
          </summary>
          <div className="absolute inset-x-0 top-full z-20 max-h-[50dvh] space-y-3 overflow-y-auto rounded-xl bg-white p-4 shadow-lg ring-1 ring-black/15">
            <label className="block space-y-1">
              <span>Forma farmacéutica</span>
              <select
                value={valor.forma}
                onChange={(e) => onCambiar({ ...valor, forma: e.target.value })}
                className={estilo}
              >
                <option value="">Todas las formas</option>
                {opciones.formas.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span>Laboratorio</span>
              <select
                value={valor.laboratorio}
                onChange={(e) => onCambiar({ ...valor, laboratorio: e.target.value })}
                className={estilo}
              >
                <option value="">Todos los laboratorios</option>
                {opciones.laboratorios.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span>Identificación EFG</span>
              <select
                value={valor.generico}
                onChange={(e) =>
                  onCambiar({
                    ...valor,
                    generico:
                      e.target.value === 'si' ? 'si' : e.target.value === 'no' ? 'no' : 'todos',
                  })
                }
                className={estilo}
              >
                <option value="todos">Todos los medicamentos</option>
                <option value="si">Genéricos (EFG)</option>
                <option value="no">Sin identificación EFG</option>
              </select>
            </label>
          </div>
        </details>
      </div>
      {hayFiltros(valor) && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <p role="status">
            {coincidencias} de {total} medicamentos
          </p>
          <button
            type="button"
            onClick={() => onCambiar({ ...FILTROS_INICIALES })}
            className="min-h-11 px-2 font-semibold text-cruz underline"
          >
            Quitar filtros
          </button>
        </div>
      )}
    </div>
  );
}
