import { ExplorarRespuesta, type ProductoResumen } from '@rebotica/shared';

/** Todos los productos recibidos, agrupados sin mezclar la condición de prescripción. */
export function pasilloInformativo(productos: ProductoResumen[], id: string, titulo: string) {
  const grupos = (receta: boolean) => {
    const mapa = new Map<string, ProductoResumen[]>();
    for (const producto of productos) {
      if (producto.receta !== receta) continue;
      const clave = producto.principioActivo
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
      const grupo = mapa.get(clave) ?? [];
      grupo.push(producto);
      mapa.set(clave, grupo);
    }
    return [...mapa.values()].sort((a, b) =>
      a[0]!.principioActivo.localeCompare(b[0]!.principioActivo, 'es'),
    );
  };
  return ExplorarRespuesta.parse({
    id,
    version: 1,
    titulo,
    estado: 'informativo',
    baldas: grupos(false).map((ps, i) => ({
      titulo: ps[0]!.principioActivo,
      principioActivo: ps[0]!.principioActivo,
      orden: i + 1,
      productos: ps,
    })),
    ocultasPorPerfil: 0,
    vitrina: grupos(true).map((ps) => ({
      principioActivo: ps[0]!.principioActivo,
      productos: ps,
      formas: [...new Set(ps.flatMap((p) => (p.forma ? [p.forma] : [])))],
      paraQueSeUsa: 'Consulta las indicaciones completas en la ficha oficial.',
      porQueNecesitaReceta: 'Requiere prescripción médica.',
      situacion: 'Su aparición aquí no indica que sea adecuado para ti.',
    })),
    consejos: [],
    parafarmacia: [],
  });
}
