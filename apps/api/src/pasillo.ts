import { PasilloResponse, type BaldaPasillo, type GrupoPaciente } from '@rebotica/shared';
import type { Protocolo } from '@rebotica/protocolos';
import type { crearCatalogo } from './catalogo';

export async function construirPasillo(
  catalogo: ReturnType<typeof crearCatalogo>,
  protocolo: Protocolo,
  estado: 'borrador' | 'validado',
  {
    grupo,
    edadMeses,
    condiciones = [],
  }: { grupo?: GrupoPaciente; edadMeses?: number; condiciones?: string[] },
): Promise<PasilloResponse> {
  const visibles = protocolo.baldas
    .filter((b) => {
      if (grupo && b.gruposExcluidos.includes(grupo)) return false;
      if (edadMeses !== undefined && b.edadMinMeses !== undefined && edadMeses < b.edadMinMeses)
        return false;
      return !b.condicionesExcluidas.some((c) => condiciones.includes(c));
    })
    .sort((a, b) => a.orden - b.orden);
  const baldas: BaldaPasillo[] = [];
  for (const b of visibles)
    baldas.push({
      titulo: b.titulo,
      principioActivo: b.principioActivo,
      orden: b.orden,
      productos: await catalogo.productosDe(b.principioActivo),
    });
  const vitrina = [];
  for (const g of protocolo.vitrina)
    vitrina.push({
      productos: await catalogo.productosDe(g.principioActivo, true),
      principioActivo: g.principioActivo,
      formas: await catalogo.formasConReceta(g.principioActivo),
      paraQueSeUsa: g.paraQueSeUsa,
      porQueNecesitaReceta: g.porQueNecesitaReceta,
      situacion: g.situacion,
    });
  return PasilloResponse.parse({
    id: protocolo.id,
    version: protocolo.version,
    titulo: protocolo.titulo,
    estado,
    baldas,
    ocultasPorPerfil: protocolo.baldas.length - visibles.length,
    vitrina,
    consejos: protocolo.consejos,
    parafarmacia: protocolo.parafarmacia,
  });
}
