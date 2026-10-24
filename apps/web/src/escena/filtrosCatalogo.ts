import type { ProductoResumen } from '@rebotica/shared';
import type { BaldaEscena } from './Pasillo';

export interface FiltrosCatalogo {
  texto: string;
  forma: string;
  laboratorio: string;
  generico: 'todos' | 'si' | 'no';
}
export const FILTROS_INICIALES: FiltrosCatalogo = {
  texto: '',
  forma: '',
  laboratorio: '',
  generico: 'todos',
};
const normalizar = (valor: string) =>
  valor
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
export function hayFiltros(f: FiltrosCatalogo) {
  return !!(f.texto.trim() || f.forma || f.laboratorio || f.generico !== 'todos');
}

/** Índice local de nombres y principios activos. No modifica asociaciones ni necesita red. */
export function indiceBusqueda(baldas: readonly BaldaEscena[]) {
  return new Map(
    baldas.flatMap((b) =>
      b.productos.map(
        (p) => [p.nregistro, normalizar(`${p.nombre} ${p.principioActivo}`)] as const,
      ),
    ),
  );
}
export function filtrarCatalogo(
  baldas: readonly BaldaEscena[],
  f: FiltrosCatalogo,
  indice: ReadonlyMap<string, string>,
): BaldaEscena[] {
  const palabras = normalizar(f.texto).split(' ').filter(Boolean);
  const coincide = (p: ProductoResumen) =>
    palabras.every((t) => (indice.get(p.nregistro) ?? '').includes(t)) &&
    (!f.forma || p.forma?.trim() === f.forma) &&
    (!f.laboratorio || p.laboratorio?.trim() === f.laboratorio) &&
    (f.generico === 'todos' || p.generico === (f.generico === 'si'));
  return baldas.flatMap((b) => {
    const productos = b.productos.filter(coincide);
    return productos.length ? [{ ...b, productos }] : [];
  });
}
export function opcionesFiltros(baldas: readonly BaldaEscena[]) {
  const productos = baldas.flatMap((b) => b.productos);
  const unicos = (valores: (string | null)[]) =>
    [...new Set(valores.map((v) => v?.trim()).filter((v): v is string => !!v))].sort((a, b) =>
      a.localeCompare(b, 'es'),
    );
  return {
    formas: unicos(productos.map((p) => p.forma)),
    laboratorios: unicos(productos.map((p) => p.laboratorio)),
  };
}
