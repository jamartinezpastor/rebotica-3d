import type { ProductoResumen, ProductoResponse, PasilloResponse } from '@rebotica/shared';
import { productosDemo } from '../../src/escena/demo';
export const productosComparacion = productosDemo(80).map((p, i) => ({ ...p, receta: i >= 75 }));
export const catalogoComparacion: PasilloResponse = {
  id: 'catalogo',
  version: 1,
  titulo: 'Catálogo de comparación ficticio',
  estado: 'informativo',
  baldas: [
    {
      titulo: 'Grupo ficticio',
      principioActivo: 'Principio ficticio',
      orden: 1,
      productos: productosComparacion.slice(0, 75),
    },
  ],
  vitrina: [
    {
      principioActivo: 'Principio restringido ficticio',
      formas: ['COMPRIMIDO'],
      paraQueSeUsa: 'Indicación ficticia.',
      porQueNecesitaReceta: 'Precaución ficticia.',
      situacion: 'Situación ficticia.',
      productos: productosComparacion.slice(75),
    },
  ],
  ocultasPorPerfil: 0,
  consejos: [],
  parafarmacia: [],
};
export function fichaComparacion(p: ProductoResumen): ProductoResponse {
  return {
    nregistro: p.nregistro,
    nombre: p.nombre,
    receta: p.receta,
    principioActivo: p.principioActivo,
    forma: p.forma,
    formaCaja: p.formaCaja,
    dosis: p.dosis,
    categoria: p.categoria,
    laboratorio: `Laboratorio oficial ficticio ${p.nregistro}`,
    generico: p.generico,
    conduccion: p.conduccion,
    asset: p.asset,
    triangulo: false,
    problemaSuministro: false,
    presentaciones: [],
    secciones: [
      {
        seccion: '4.1',
        titulo: 'Indicaciones',
        texto: `Indicación oficial ficticia de ${p.nregistro}.`,
        resumenLlano: null,
      },
      {
        seccion: '4.2',
        titulo: 'Posología',
        texto: `Posología oficial ficticia de ${p.nregistro}.`,
        resumenLlano: null,
      },
      {
        seccion: '4.3',
        titulo: 'Contraindicaciones',
        texto: `Contraindicación oficial ficticia de ${p.nregistro}.`,
        resumenLlano: 'Resumen ficticio que no debe sustituir al texto oficial de la comparación.',
      },
    ],
    enlaces: {
      prospecto: `https://cima.aemps.es/cima/dochtml/p/${p.nregistro}/P.html`,
      fichaTecnica: `https://cima.aemps.es/cima/dochtml/ft/${p.nregistro}/FT.html`,
    },
    reglaDosis: null,
  };
}
