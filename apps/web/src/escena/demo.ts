import type { FormaCaja, ProductoResumen } from '@rebotica/shared';

const FORMAS: FormaCaja[] = ['caja-plana', 'caja-alta', 'caja-cuadrada', 'tubo', 'cilindro'];
const COLORES = ['#3a6fb0', '#c9a227', '#b5483a', '#2b8a6e', '#7a5aa6', '#d9822b', '#4a9bb8'];

/**
 * Productos ficticios para la vista de desarrollo `/escena`: ninguno procede de CIMA. Sin atlas
 * real, las cajas se ven con el color lateral. Las reales llegan con los datos de `/api/pasillos`.
 */
export function productosDemo(cantidad = 20): ProductoResumen[] {
  return Array.from({ length: cantidad }, (_, i) => ({
    nregistro: `demo-${i + 1}`,
    nombre: `Producto de demostración ${i + 1}`,
    principioActivo: 'principio ficticio',
    forma: null,
    formaCaja: FORMAS[i % FORMAS.length] ?? 'caja-plana',
    dosis: null,
    generico: false,
    conduccion: false,
    asset: {
      atlasUrl: '/demo/sin-atlas.ktx2',
      uv: [0, 0, 0.14, 0.25] as [number, number, number, number],
      colorDominante: COLORES[i % COLORES.length] ?? '#3a6fb0',
    },
    calculadora: false,
  }));
}
