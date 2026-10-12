import { describe, expect, it } from 'vitest';
import {
  ajustarTexto,
  colorTexto,
  coloresDe,
  contraste,
  datosEnvase,
  dibujarCara,
  dibujarEnvolvente,
  legibleSobrePapel,
  tamanoCara,
  type Cara,
  type Contexto2D,
  type DatosEnvase,
} from '../src/escena/arteEnvase';
import { dimensionesCaja } from '../src/escena/cajas';
import { crearGeometriaCaja, medidasCara } from '../src/escena/geometriaCaja';

/** Contexto 2D de mentira: mide con una anchura fija por carácter y anota lo que se escribe. */
function contextoFalso() {
  const textos: { texto: string; fuente: string; x: number; y: number }[] = [];
  const rellenos: string[] = [];
  const ctx = {
    fillStyle: '' as string,
    strokeStyle: '' as string,
    lineWidth: 1,
    font: '700 10px sans-serif',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    fillRect() {
      rellenos.push(String(this.fillStyle));
    },
    strokeRect() {},
    fillText(texto: string, x: number, y: number) {
      textos.push({ texto, fuente: this.font, x, y });
    },
    measureText(texto: string) {
      const px = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? 10);
      return { width: texto.length * px * 0.55 } as TextMetrics;
    },
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {},
    stroke() {},
  };
  return { ctx: ctx as unknown as Contexto2D, textos, rellenos };
}

const datos: DatosEnvase = {
  nombre: 'ALMAGATO STADAPHARM 1,5 G SUSPENSION ORAL',
  principioActivo: 'Almagato',
  dosis: '1,5 g',
  forma: 'Suspensión oral',
  categoria: 'Antiácidos',
  laboratorio: 'Laboratorio Stada S.L.',
  generico: true,
  conduccion: true,
  paleta: ['#1f4fa8', '#f2c200'],
};

// Una cara estrecha puede partir un texto en varias líneas: se comparan unidas por espacios.
const texto = (t: { texto: string }[]) => t.map((x) => x.texto).join(' ');

describe('dibujarCara · cada cara lleva información del producto', () => {
  it('frente: nombre, principio activo, dosis, forma y distintivo de genérico', () => {
    const { ctx, textos } = contextoFalso();
    dibujarCara(ctx, 'frente', 520, 300, datos);
    const t = texto(textos);
    expect(t).toContain('ALMAGATO');
    expect(t).toContain('Almagato');
    expect(t).toContain('1,5 g');
    expect(t).toContain('Suspensión oral');
    expect(t).toContain('EFG');
    // El pictograma de conducción lleva su signo de admiración.
    expect(textos.some((x) => x.texto === '!')).toBe(true);
  });

  it('trasera: todos los datos con su etiqueta, incluidos laboratorio y categoría', () => {
    const { ctx, textos } = contextoFalso();
    dibujarCara(ctx, 'trasera', 520, 300, datos);
    const t = texto(textos);
    for (const esperado of [
      'PRINCIPIO ACTIVO',
      'Almagato',
      'DOSIS',
      '1,5 g',
      'FORMA FARMACÉUTICA',
      'Suspensión oral',
      'CATEGORÍA',
      'Antiácidos',
      'LABORATORIO TITULAR',
      'Laboratorio Stada S.L.',
      'Genérico (EFG)',
      'Puede afectar a la conducción',
    ]) {
      expect(t).toContain(esperado);
    }
  });

  it('laterales, tapa y base también llevan datos del producto', () => {
    const casos: [Cara, string[]][] = [
      ['izquierda', ['ALMAGATO', '1,5 g · Suspensión oral']],
      ['derecha', ['Antiácidos', 'Laboratorio Stada S.L.']],
      ['superior', ['ALMAGATO', '1,5 g']],
      ['inferior', ['Laboratorio Stada S.L.', 'Antiácidos']],
    ];
    for (const [cara, esperados] of casos) {
      const { ctx, textos } = contextoFalso();
      dibujarCara(ctx, cara, 200, 300, datos);
      const t = texto(textos);
      for (const e of esperados) expect(t, `${cara}: ${e}`).toContain(e);
    }
  });

  it('una cara sin datos opcionales no escribe «null» ni deja huecos con texto', () => {
    const minimo: DatosEnvase = {
      ...datos,
      dosis: null,
      forma: null,
      categoria: null,
      laboratorio: null,
      generico: false,
      conduccion: false,
    };
    for (const cara of [
      'frente',
      'trasera',
      'izquierda',
      'derecha',
      'superior',
      'inferior',
    ] as Cara[]) {
      const { ctx, textos } = contextoFalso();
      dibujarCara(ctx, cara, 300, 200, minimo);
      const t = texto(textos);
      expect(t, cara).not.toMatch(/null|undefined/);
      expect(t, cara).not.toContain('EFG');
    }
  });

  it('el lateral de un cilindro combina la trasera y el frente', () => {
    const { ctx, textos } = contextoFalso();
    dibujarEnvolvente(ctx, 600, 300, datos);
    const t = texto(textos);
    expect(t).toContain('LABORATORIO TITULAR'); // de la trasera
    expect(t).toContain('1,5 g'); // del frente
  });

  it('pinta con los colores de la paleta del envase', () => {
    const { ctx, rellenos } = contextoFalso();
    dibujarCara(ctx, 'frente', 520, 300, datos);
    expect(rellenos).toContain('#1f4fa8');
    expect(rellenos).toContain('#f2c200');
  });
});

describe('ajustarTexto', () => {
  it('reduce la letra hasta que el texto cabe', () => {
    const { ctx } = contextoFalso();
    const corto = ajustarTexto(ctx, 'Hola', 400, 100, { maxLineas: 1, tamanoMax: 40 });
    const largo = ajustarTexto(ctx, 'Un nombre bastante largo de medicamento', 400, 100, {
      maxLineas: 1,
      tamanoMax: 40,
    });
    expect(corto.tamano).toBe(40);
    expect(largo.tamano).toBeLessThan(40);
    expect(largo.lineas).toHaveLength(1);
  });

  it('parte en varias líneas si se permite y nunca supera el máximo', () => {
    const { ctx } = contextoFalso();
    const r = ajustarTexto(ctx, 'uno dos tres cuatro cinco seis siete ocho', 120, 200, {
      maxLineas: 3,
      tamanoMax: 24,
    });
    expect(r.lineas.length).toBeLessThanOrEqual(3);
    for (const l of r.lineas) {
      ctx.font = `700 ${r.tamano}px sans-serif`;
      expect(ctx.measureText(l).width).toBeLessThanOrEqual(120 + 1e-6);
    }
  });

  it('si ni al tamaño mínimo cabe, recorta con puntos suspensivos', () => {
    const { ctx } = contextoFalso();
    const r = ajustarTexto(ctx, 'palabraincreiblementelargaquenocabeenlacaja', 40, 30, {
      maxLineas: 1,
      tamanoMax: 20,
      tamanoMin: 8,
    });
    expect(r.tamano).toBe(8);
    expect(r.lineas[0]?.endsWith('…')).toBe(true);
  });
});

describe('colores y contraste', () => {
  it('el texto es blanco sobre fondos oscuros y tinta sobre claros', () => {
    expect(colorTexto('#1f4fa8')).toBe('#ffffff');
    expect(colorTexto('#f2c200')).not.toBe('#ffffff');
    expect(colorTexto('#ffffff')).not.toBe('#ffffff');
  });

  it('legibleSobrePapel oscurece lo que no llega a contraste 4,5', () => {
    expect(contraste(legibleSobrePapel('#f2c200'), '#fbfaf6')).toBeGreaterThanOrEqual(4.5);
    expect(legibleSobrePapel('#1f4fa8')).toBe('#1f4fa8');
  });

  it('coloresDe deriva un segundo color si la paleta solo tiene uno', () => {
    const { p0, p1 } = coloresDe({ paleta: ['#336699'] });
    expect(p0).toBe('#336699');
    expect(p1).not.toBe(p0);
    expect(coloresDe({ paleta: [] }).p0).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('datosEnvase y tamaños', () => {
  const producto = {
    nregistro: '1',
    nombre: 'PRODUCTO',
    principioActivo: 'ACETILCISTEINA',
    forma: 'COMPRIMIDO EFERVESCENTE',
    formaCaja: 'caja-plana' as const,
    dosis: '600 mg',
    categoria: 'Mucolíticos',
    laboratorio: 'Lab',
    generico: true,
    conduccion: false,
    asset: { colorDominante: '#336699', paleta: ['#336699', '#e8b030'], foto: null },
    calculadora: false,
  };

  it('pasa a frase el principio activo y la forma que CIMA escribe en mayúsculas', () => {
    const d = datosEnvase(producto);
    expect(d.principioActivo).toBe('Acetilcisteina');
    expect(d.forma).toBe('Comprimido efervescente');
    expect(d.paleta).toEqual(['#336699', '#e8b030']);
  });

  it('sin asset usa una paleta neutra', () => {
    const d = datosEnvase({ ...producto, asset: null });
    expect(d.paleta.length).toBeGreaterThanOrEqual(1);
  });

  it('el lienzo conserva la proporción de la cara y se acota a 1024 px', () => {
    const m = medidasCara('caja-plana', 'frente');
    const e = tamanoCara(m.ancho, m.alto, 'estanteria');
    const f = tamanoCara(m.ancho, m.alto, 'ficha');
    expect(e.ancho / e.alto).toBeCloseTo(m.ancho / m.alto, 1);
    expect(f.ancho).toBeLessThanOrEqual(1024);
    expect(f.ancho).toBeGreaterThan(e.ancho);
  });
});

describe('geometría de la caja', () => {
  it('cada forma tiene una ranura por grupo y solo una es el frente (o el lateral)', () => {
    for (const forma of ['caja-plana', 'caja-alta', 'caja-cuadrada', 'tubo', 'cilindro'] as const) {
      const { geometria, ranuras } = crearGeometriaCaja(forma);
      expect(ranuras).toHaveLength(geometria.groups.length);
      const principal = ranuras.filter((r) => r === 'frente' || r === 'lateral');
      expect(principal).toHaveLength(1);
    }
  });

  it('una caja tiene las seis caras distintas', () => {
    const { ranuras } = crearGeometriaCaja('caja-plana');
    expect(new Set(ranuras).size).toBe(6);
    expect([...ranuras].sort()).toEqual(
      ['derecha', 'frente', 'inferior', 'izquierda', 'superior', 'trasera'].sort(),
    );
  });

  it('las medidas de cada cara salen de las dimensiones reales de la caja', () => {
    const d = dimensionesCaja('caja-alta');
    expect(medidasCara('caja-alta', 'frente')).toEqual({ ancho: d.ancho, alto: d.alto });
    expect(medidasCara('caja-alta', 'izquierda')).toEqual({ ancho: d.fondo, alto: d.alto });
    expect(medidasCara('caja-alta', 'superior')).toEqual({ ancho: d.ancho, alto: d.fondo });
    const c = dimensionesCaja('cilindro');
    expect(medidasCara('cilindro', 'lateral').ancho).toBeCloseTo(Math.PI * c.ancho);
  });
});
