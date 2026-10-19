import type { FormaCaja, ProductoResumen } from '@rebotica/shared';
import type { BaldaEscena } from './Pasillo';

const FORMAS: FormaCaja[] = ['caja-plana', 'caja-alta', 'caja-cuadrada', 'tubo', 'cilindro'];
const FORMAS_TEXTO = ['COMPRIMIDO', 'JARABE', 'SOBRE', 'CREMA', 'SOLUCIÓN PARA PULVERIZACIÓN'];
const COLORES = ['#3a6fb0', '#c9a227', '#b5483a', '#2b8a6e', '#7a5aa6', '#d9822b', '#4a9bb8'];

/**
 * Productos ficticios para la vista de desarrollo `/escena`: ninguno procede de CIMA. Las cajas
 * reales llegan con los datos de `/api/pasillos`.
 */
export function productosDemo(cantidad = 20): ProductoResumen[] {
  return Array.from({ length: cantidad }, (_, i) => {
    const color = COLORES[i % COLORES.length] ?? '#3a6fb0';
    const otro = COLORES[(i + 3) % COLORES.length] ?? '#c9a227';
    return {
      receta: false,
      nregistro: `demo-${i + 1}`,
      nombre: `PRODUCTO DE DEMOSTRACIÓN ${i + 1}`,
      principioActivo: 'principio ficticio',
      forma: FORMAS_TEXTO[i % FORMAS_TEXTO.length] ?? 'COMPRIMIDO',
      formaCaja: FORMAS[i % FORMAS.length] ?? 'caja-plana',
      dosis: `${(i % 5) * 100 + 100} mg`,
      categoria: `Tipo ficticio ${String.fromCharCode(65 + (i % 3))}`,
      laboratorio: `Laboratorio ficticio ${String.fromCharCode(65 + (i % 4))}`,
      generico: i % 3 === 0,
      conduccion: i % 4 === 0,
      asset: { colorDominante: color, paleta: [color, otro], foto: null },
      calculadora: false,
    };
  });
}

/** Vitrina ficticia opcional para revisar su aspecto sin descargar datos clínicos. */
export function vitrinaDemo(): BaldaEscena[] {
  return [
    {
      titulo: 'Principio restringido ficticio',
      receta: true,
      productos: productosDemo(5).map((p, i) => ({
        ...p,
        receta: true,
        nregistro: `receta-demo-${i + 1}`,
        nombre: `PRODUCTO CON RECETA DE DEMOSTRACIÓN ${i + 1}`,
      })),
    },
  ];
}

/**
 * Baldas ficticias (de seis productos como mucho cada una, en grupos de tres por estantería)
 * con `total` productos repartidos. Con `total` = 40 reproduce el caso de medición del plan.
 */
export function baldasDemo(total = 36): BaldaEscena[] {
  const productos = productosDemo(total);
  const baldas = Math.max(1, Math.ceil(total / 6));
  return Array.from({ length: baldas }, (_, i) => ({
    titulo: `Grupo ficticio ${String.fromCharCode(65 + (i % 26))}`,
    productos: productos.slice(i * 6, i * 6 + 6),
  }));
}
