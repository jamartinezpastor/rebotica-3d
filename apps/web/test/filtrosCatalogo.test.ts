import { describe, expect, it } from 'vitest';
import { productosDemo } from '../src/escena/demo';
import {
  FILTROS_INICIALES,
  filtrarCatalogo,
  indiceBusqueda,
  opcionesFiltros,
} from '../src/escena/filtrosCatalogo';
import type { BaldaEscena } from '../src/escena/Pasillo';

const originales = productosDemo(4);
const productos = originales.map((p, i) => ({
  ...p,
  nombre: `Marca ficticia ${i}`,
  principioActivo: i < 2 ? 'Áctivo Alfa' : 'Activo Beta',
  forma: i % 2 ? 'JARABE' : 'COMPRIMIDO',
  laboratorio: i < 2 ? 'Laboratorio A' : 'Laboratorio B',
  generico: i % 2 === 0,
  receta: i >= 2,
}));
const baldas: BaldaEscena[] = [
  { titulo: 'Sin receta', productos: productos.slice(0, 2) },
  {
    titulo: 'Con receta',
    receta: true,
    descripcion: 'Aviso conservado',
    productos: productos.slice(2),
  },
];
const indice = indiceBusqueda(baldas);
const ids = (resultado: BaldaEscena[]) =>
  resultado.flatMap((b) => b.productos.map((p) => p.nregistro));
describe('búsqueda y filtros explícitos del catálogo', () => {
  it('incluye todo por defecto y conserva datos, separación de receta y orden', () => {
    const resultado = filtrarCatalogo(baldas, FILTROS_INICIALES, indice);
    expect(resultado).toEqual(baldas);
    expect(resultado[1]?.productos[0]).toBe(productos[2]);
  });
  it('busca nombre y principio activo con varias palabras, sin tildes ni mayúsculas', () => {
    expect(
      ids(filtrarCatalogo(baldas, { ...FILTROS_INICIALES, texto: '  ALFA marca 1 ' }, indice)),
    ).toEqual([productos[1]?.nregistro]);
    expect(
      ids(filtrarCatalogo(baldas, { ...FILTROS_INICIALES, texto: 'áctivo béta' }, indice)),
    ).toEqual(productos.slice(2).map((p) => p.nregistro));
  });
  it('combina los filtros y no usa el laboratorio como texto de búsqueda', () => {
    expect(
      ids(
        filtrarCatalogo(
          baldas,
          { texto: 'beta', forma: 'COMPRIMIDO', laboratorio: 'Laboratorio B', generico: 'si' },
          indice,
        ),
      ),
    ).toEqual([productos[2]?.nregistro]);
    expect(filtrarCatalogo(baldas, { ...FILTROS_INICIALES, texto: 'laboratorio' }, indice)).toEqual(
      [],
    );
    expect(
      filtrarCatalogo(baldas, { ...FILTROS_INICIALES, forma: 'JARABE', generico: 'si' }, indice),
    ).toEqual([]);
  });
  it('sin identificación EFG también incluye medicamentos con receta', () => {
    expect(ids(filtrarCatalogo(baldas, { ...FILTROS_INICIALES, generico: 'no' }, indice))).toEqual([
      productos[1]?.nregistro,
      productos[3]?.nregistro,
    ]);
  });
  it('no descarta metadatos ausentes hasta que se elige el filtro correspondiente', () => {
    const incompletas: BaldaEscena[] = [
      {
        titulo: 'Datos ausentes',
        productos: originales.map((p) => ({ ...p, forma: null, laboratorio: null })),
      },
    ];
    expect(
      ids(filtrarCatalogo(incompletas, FILTROS_INICIALES, indiceBusqueda(incompletas))),
    ).toHaveLength(4);
    expect(opcionesFiltros(incompletas)).toEqual({ formas: [], laboratorios: [] });
    expect(
      filtrarCatalogo(
        incompletas,
        { ...FILTROS_INICIALES, forma: 'JARABE' },
        indiceBusqueda(incompletas),
      ),
    ).toEqual([]);
  });
  it('ofrece valores únicos ordenados del conjunto completo y no modifica las baldas', () => {
    const copia = structuredClone(baldas);
    expect(opcionesFiltros(baldas)).toEqual({
      formas: ['COMPRIMIDO', 'JARABE'],
      laboratorios: ['Laboratorio A', 'Laboratorio B'],
    });
    filtrarCatalogo(baldas, { ...FILTROS_INICIALES, texto: 'ausente' }, indice);
    expect(baldas).toEqual(copia);
  });
});
