import type { ProductoResumen } from '@rebotica/shared';
import type { BaldaEscena } from './Pasillo';

export const AGRUPACIONES = [
  { id: 'original', texto: 'Orden del pasillo' },
  { id: 'laboratorio', texto: 'Farmacéutica / laboratorio' },
  { id: 'tipo', texto: 'Tipo de fármaco' },
  { id: 'infantil', texto: 'Uso infantil verificado' },
  { id: 'consultas', texto: 'Enfermedades y consultas comunes' },
  { id: 'principio', texto: 'Principio activo' },
  { id: 'forma', texto: 'Forma farmacéutica' },
  { id: 'generico', texto: 'Genéricos' },
] as const;
export type Agrupacion = (typeof AGRUPACIONES)[number]['id'];
export function esAgrupacion(valor: string | null): valor is Agrupacion {
  return AGRUPACIONES.some((a) => a.id === valor);
}
const clave = (texto: string) =>
  texto
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es');
const orden = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' });

function tituloDe(p: ProductoResumen, agrupacion: Agrupacion): string {
  switch (agrupacion) {
    case 'laboratorio':
      return p.laboratorio?.trim() || 'Laboratorio sin informar';
    case 'tipo':
      return p.categoria?.trim() || 'Tipo de fármaco sin informar';
    case 'principio':
      return p.principioActivo;
    case 'forma':
      return p.forma?.trim() || 'Forma farmacéutica sin informar';
    case 'generico':
      return p.generico ? 'Genéricos (EFG)' : 'Sin identificación EFG';
    case 'infantil': {
      const edad = p.clasificacion?.edadMinPediatricaMeses;
      return edad === undefined || edad === null
        ? 'Sin uso infantil verificado'
        : `Uso infantil: regla desde ${edad} meses`;
    }
    case 'consultas': {
      const nombres = [...new Set(p.clasificacion?.consultas.map((c) => c.titulo) ?? [])].sort(
        orden,
      );
      return nombres.length ? nombres.join(' · ') : 'Sin protocolo clínico validado';
    }
    default:
      return '';
  }
}

/** Hasta seis cajas por balda: caben todas las formas y no se pierden productos en la vista 3D. */
function repartir(baldas: readonly BaldaEscena[]): BaldaEscena[] {
  return baldas.flatMap((b) => {
    const partes = Math.max(1, Math.ceil(b.productos.length / 6));
    return Array.from({ length: partes }, (_, i) => ({
      ...b,
      titulo: partes > 1 ? `${b.titulo} (${i + 1}/${partes})` : b.titulo,
      productos: b.productos.slice(i * 6, i * 6 + 6),
    }));
  });
}

/** Reordena el catálogo servido, sin añadir recomendaciones ni mezclar la vitrina con las baldas. */
export function agruparBaldas(
  baldas: readonly BaldaEscena[],
  agrupacion: Agrupacion,
): BaldaEscena[] {
  if (agrupacion === 'original') return repartir(baldas);
  const grupos = new Map<string, BaldaEscena>();
  const vistos = new Set<string>();
  for (const b of baldas)
    for (const p of b.productos) {
      if (vistos.has(p.nregistro)) continue;
      vistos.add(p.nregistro);
      const titulo = tituloDe(p, agrupacion);
      const id = `${p.receta}:${clave(titulo)}`;
      const grupo = grupos.get(id) ?? { titulo, receta: p.receta, productos: [] };
      grupo.productos.push(p);
      grupos.set(id, grupo);
    }
  const resultado = [...grupos.values()].sort(
    (a, b) => Number(a.receta) - Number(b.receta) || orden(a.titulo, b.titulo),
  );
  for (const b of resultado)
    b.productos.sort((a, p) => orden(a.nombre, p.nombre) || orden(a.nregistro, p.nregistro));
  return repartir(resultado);
}
