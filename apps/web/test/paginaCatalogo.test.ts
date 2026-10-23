import { expect, it } from 'vitest';
import { productosDemo } from '../src/escena/demo';
import { paginaCatalogo, PRODUCTOS_POR_PAGINA } from '../src/escena/paginaCatalogo';

it('las páginas conservan todos los registros, en orden y separados por receta', () => {
  const productos = productosDemo(200).map((p, i) => ({ ...p, receta: i >= 73 }));
  const baldas = [
    { titulo: 'Sin receta', productos: productos.slice(0, 73) },
    { titulo: 'Con receta', receta: true, productos: productos.slice(73) },
  ];
  const recuperados = [];
  for (let pagina = 0; pagina < Math.ceil(productos.length / PRODUCTOS_POR_PAGINA); pagina++) {
    const resultado = paginaCatalogo(baldas, pagina);
    const tramo = resultado.flatMap((b) => b.productos);
    expect(tramo.length).toBeLessThanOrEqual(PRODUCTOS_POR_PAGINA);
    for (const balda of resultado)
      expect(balda.productos.every((p) => p.receta === !!balda.receta)).toBe(true);
    recuperados.push(...tramo.map((p) => p.nregistro));
  }
  expect(recuperados).toEqual(productos.map((p) => p.nregistro));
});
