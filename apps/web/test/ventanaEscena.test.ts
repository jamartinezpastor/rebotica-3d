import { describe, expect, it } from 'vitest';
import { ventanaEstanterias } from '../src/escena/ventanaEscena';
import { modeloPasillo, datosRiel } from '../src/escena/Pasillo';
import { baldasDemo, productosDemo, vitrinaDemo } from '../src/escena/demo';
import { geometriaEstanteria } from '../src/escena/geometria';
import { agruparBaldas } from '../src/escena/agrupacion';
import { destinosGrupos } from '../src/escena/navegacionCatalogo';
import { tamanoCara } from '../src/escena/arteEnvase';
describe('ventana de estanterías y calidad', () => {
  it('un resultado de 278 medicamentos mantiene todos los destinos con recursos próximos acotados', () => {
    const productos = productosDemo(278).map((p, i) => ({ ...p, receta: i >= 30 }));
    const baldas = agruparBaldas(
      [
        { titulo: 'Sin receta', productos: productos.slice(0, 30) },
        { titulo: 'Con receta', receta: true, productos: productos.slice(30) },
      ],
      'original',
    );
    const geometria = geometriaEstanteria();
    const modelo = modeloPasillo(baldas, geometria);
    const alcanzables = new Set<string>();
    expect(datosRiel(modelo, geometria).puntos.flat()).toHaveLength(278);
    for (let centro = 0; centro < modelo.length; centro++) {
      const ventana = ventanaEstanterias(modelo.length, centro, 2);
      expect(ventana.length).toBeLessThanOrEqual(5);
      const cajas = ventana.flatMap((i) => modelo[i]!.cajas);
      expect(cajas.length).toBeLessThanOrEqual(90);
      for (const caja of cajas) alcanzables.add(caja.item.nregistro);
    }
    expect(alcanzables.size).toBe(278);
    expect(modelo.every((est) => est.cajas.every((c) => c.item.receta === est.receta))).toBe(true);
  });
  it('acota los recursos en todas las posiciones sin hacer inaccesible ninguna caja o vitrina', () => {
    const geometria = geometriaEstanteria();
    const modelo = modeloPasillo([...baldasDemo(195), ...vitrinaDemo()], geometria);
    const alcanzables = new Set<string>();
    for (let centro = 0; centro < modelo.length; centro++) {
      const ventana = ventanaEstanterias(modelo.length, centro, 1);
      expect(ventana.length).toBeLessThanOrEqual(3);
      for (const i of ventana)
        for (const c of modelo[i]?.cajas ?? []) alcanzables.add(c.item.nregistro);
    }
    expect(alcanzables.size).toBe(200);
    expect(datosRiel(modelo, geometria).puntos.flat()).toHaveLength(200);
    expect(modelo.at(-1)?.receta).toBe(true);
  });
  it('conserva el original de la ficha aunque la cámara salga de su ventana', () => {
    expect(ventanaEstanterias(20, 15, 1, 0)).toEqual([0, 14, 15, 16]);
    expect(ventanaEstanterias(0, 0, 2)).toEqual([]);
    expect(ventanaEstanterias(3, 20, 1)).toEqual([1, 2]);
  });
  it('reduce píxeles de textura en calidad ligera sin alterar proporciones ni la ficha', () => {
    const ligera = tamanoCara(0.15, 0.2, 'ligera');
    const normal = tamanoCara(0.15, 0.2, 'estanteria');
    expect(ligera.ancho * ligera.alto).toBeLessThan(normal.ancho * normal.alto * 0.3);
    expect(ligera.ancho / ligera.alto).toBeCloseTo(normal.ancho / normal.alto, 2);
    expect(tamanoCara(0.15, 0.2, 'ficha').alto).toBe(1024);
  });
  it('ofrece un destino por grupo completo y distingue grupos iguales con y sin receta', () => {
    const originales = [
      { titulo: 'Mismo grupo', productos: baldasDemo(40).flatMap((b) => b.productos) },
      ...vitrinaDemo().map((b) => ({ ...b, titulo: 'Mismo grupo' })),
    ];
    const baldas = agruparBaldas(originales, 'original');
    expect(baldas.length).toBeGreaterThan(2);
    expect(destinosGrupos(baldas)).toEqual([
      { registro: 'demo-1', texto: 'Mismo grupo' },
      { registro: 'receta-demo-1', texto: 'Con receta · Mismo grupo' },
    ]);
  });
});
