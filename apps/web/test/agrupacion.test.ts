import { describe, expect, it } from 'vitest';
import { agruparBaldas, AGRUPACIONES } from '../src/escena/agrupacion';
import { productosDemo, vitrinaDemo } from '../src/escena/demo';
import { modeloPasillo } from '../src/escena/Pasillo';
import { geometriaEstanteria } from '../src/escena/geometria';

describe('agrupaciones compartidas de lista y estantería', () => {
  it.each(AGRUPACIONES)('conserva todos los productos y la separación de receta: $id', ({ id }) => {
    const originales = [
      { titulo: 'Muchos productos', productos: productosDemo(45) },
      ...vitrinaDemo(),
    ];
    const antes = JSON.stringify(originales);
    const baldas = agruparBaldas(originales, id);
    expect(baldas.every((b) => b.productos.length <= 6)).toBe(true);
    expect(baldas.every((b) => b.productos.every((p) => p.receta === Boolean(b.receta)))).toBe(
      true,
    );
    const lista = baldas.flatMap((b) => b.productos.map((p) => p.nregistro)).sort();
    const escena = modeloPasillo(baldas, geometriaEstanteria())
      .flatMap((e) => e.cajas.map((c) => c.item.nregistro))
      .sort();
    expect(lista).toHaveLength(50);
    expect(escena).toEqual(lista);
    expect(JSON.stringify(originales)).toBe(antes);
  });

  it('normaliza laboratorios y mantiene grupos para datos ausentes', () => {
    const p = productosDemo(3);
    p[0]!.laboratorio = ' Laboratorio A ';
    p[1]!.laboratorio = 'LABORATORIO A';
    p[2]!.laboratorio = null;
    const b = agruparBaldas([{ titulo: 'A', productos: p }], 'laboratorio');
    expect(b.map((g) => g.productos.length).sort()).toEqual([1, 2]);
    expect(b.some((g) => g.titulo === 'Laboratorio sin informar')).toBe(true);
  });

  it('no deduce uso infantil del nombre ni de una presentación líquida', () => {
    const p = productosDemo(2);
    p[0]!.nombre = 'JARABE INFANTIL FICTICIO';
    p[0]!.forma = 'JARABE';
    p[1]!.clasificacion = { edadMinPediatricaMeses: 24, consultas: [] };
    const b = agruparBaldas([{ titulo: 'A', productos: p }], 'infantil');
    expect(b.find((g) => g.titulo === 'Sin uso infantil verificado')?.productos).toEqual([p[0]]);
    expect(b.find((g) => g.titulo === 'Uso infantil: regla desde 24 meses')?.productos).toEqual([
      p[1],
    ]);
  });

  it('usa asociaciones revisadas sin duplicar cajas para varias consultas', () => {
    const p = productosDemo(1)[0]!;
    p.clasificacion = {
      edadMinPediatricaMeses: null,
      consultas: [
        { id: 'b', titulo: 'Consulta ficticia B' },
        { id: 'a', titulo: 'Consulta ficticia A' },
      ],
    };
    const b = agruparBaldas(
      [
        { titulo: 'A', productos: [p] },
        { titulo: 'Repetida', productos: [p] },
      ],
      'consultas',
    );
    expect(b).toHaveLength(1);
    expect(b[0]?.titulo).toBe('Consulta ficticia A · Consulta ficticia B');
    expect(b[0]?.productos).toHaveLength(1);
  });
});
