import type { BaldaEscena } from './Pasillo';

export const BALDAS_POR_ESTANTERIA = 3;

/** El dial y la escena comparten el orden y la separación de las vitrinas. */
export function agruparEstanterias(baldas: readonly BaldaEscena[]): BaldaEscena[][] {
  return [false, true].flatMap((receta) => {
    const grupo = baldas.filter((b) => !!b.receta === receta);
    return Array.from({ length: Math.ceil(grupo.length / BALDAS_POR_ESTANTERIA) }, (_, i) =>
      grupo.slice(i * BALDAS_POR_ESTANTERIA, (i + 1) * BALDAS_POR_ESTANTERIA),
    );
  });
}

export function destinosEstanterias(baldas: readonly BaldaEscena[]) {
  return agruparEstanterias(baldas).map((grupo) => {
    const productos = grupo.flatMap((b) => b.productos);
    const registro = (grupo[1]?.productos[0] ?? productos[0])?.nregistro;
    return {
      titulo: [...new Set(grupo.map((b) => b.grupo ?? b.titulo))].join(' · '),
      receta: !!grupo[0]?.receta,
      registro,
      registros: productos.map((p) => p.nregistro),
    };
  });
}
