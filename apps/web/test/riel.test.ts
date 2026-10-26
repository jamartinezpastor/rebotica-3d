import { describe, expect, it } from 'vitest';
import {
  ControlRiel,
  PX_POR_FILA,
  ajusteTrasLanzamiento,
  distanciaRiel,
  metrosPorPixel,
  pasoMuelle,
  puntoMasCercano,
  puntoSiguiente,
} from '../src/escena/riel';

// Tres baldas con productos separados 0,2 m; la de arriba tiene menos.
const PUNTOS = [
  [0, 0.2, 0.4, 0.6, 0.8, 1.0],
  [0.1, 0.3, 0.5, 0.7, 0.9],
  [0.05, 0.45],
];

function control(opciones: { instantaneo?: boolean; filaInicial?: number } = {}) {
  const c = new ControlRiel({ puntos: PUNTOS, ...opciones });
  c.encuadrar(0.002); // 500 px = 1 m
  return c;
}

/** Deja correr la simulación hasta que se detiene (con tope de seguridad). */
function reposar(c: ControlRiel, segundos = 4) {
  for (let t = 0; t < segundos; t += 1 / 60) c.actualizar(1 / 60);
}

/** Arrastre horizontal: `px` píxeles en `ms` milisegundos y soltar. */
function arrastrarX(c: ControlRiel, px: number, ms: number) {
  c.empezarArrastre();
  const pasos = Math.max(2, Math.round(ms / 16));
  for (let i = 0; i < pasos; i++) c.moverArrastre(px / pasos, 0, ms / 1000 / pasos);
  c.terminarArrastre();
}

function arrastrarY(c: ControlRiel, px: number, ms: number) {
  c.empezarArrastre();
  const pasos = Math.max(2, Math.round(ms / 16));
  for (let i = 0; i < pasos; i++) c.moverArrastre(0, px / pasos, ms / 1000 / pasos);
  c.terminarArrastre();
}

describe('pasoMuelle', () => {
  it('converge al objetivo sin sobrepasarlo (críticamente amortiguado)', () => {
    let s = { pos: 0, vel: 0 };
    let maximo = 0;
    for (let i = 0; i < 240; i++) {
      s = pasoMuelle(s.pos, s.vel, 1, 1 / 60, 14);
      maximo = Math.max(maximo, s.pos);
    }
    expect(s.pos).toBeCloseTo(1, 4);
    expect(maximo).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('da el mismo resultado con pasos grandes o pequeños', () => {
    let a = { pos: 0, vel: 2 };
    for (let i = 0; i < 60; i++) a = pasoMuelle(a.pos, a.vel, 1, 1 / 60, 12);
    const b = pasoMuelle(0, 2, 1, 1, 12);
    expect(b.pos).toBeCloseTo(a.pos, 6);
  });
});

describe('puntos del raíl', () => {
  it('restaura la balda y la posición de un producto, ajustada a un destino válido', () => {
    const c = new ControlRiel({ puntos: PUNTOS, filaInicial: 2, xInicial: 0.44 });
    expect(c.fila).toBe(2);
    expect(c.x).toBe(0.45);
    expect(c.destinoActual()).toBe(0.45);
    c.teclado('ArrowLeft');
    reposar(c);
    expect(c.x).toBeCloseTo(0.05);
  });
  it('encuentra el más cercano y el siguiente en cada dirección', () => {
    expect(puntoMasCercano([0, 1, 2], 1.4)).toBe(1);
    expect(puntoMasCercano([], 3)).toBe(3);
    expect(puntoSiguiente([0, 1, 2], 1, 1)).toBe(2);
    expect(puntoSiguiente([0, 1, 2], 1, -1)).toBe(0);
    // En los extremos se queda.
    expect(puntoSiguiente([0, 1, 2], 2, 1)).toBe(2);
    expect(puntoSiguiente([0, 1, 2], 0, -1)).toBe(0);
  });

  it('un lanzamiento rápido salta varios productos y uno lento se queda en el más cercano', () => {
    const fila = PUNTOS[0] ?? [];
    expect(ajusteTrasLanzamiento(0.5, 0, fila)).toBeCloseTo(0.4);
    expect(ajusteTrasLanzamiento(0.5, 1.5, fila)).toBeGreaterThan(0.7);
    expect(ajusteTrasLanzamiento(0.5, -1.5, fila)).toBeLessThan(0.3);
  });
});

describe('ControlRiel · gesto horizontal', () => {
  it('arrastrar mueve la cámara en sentido contrario al dedo y se ajusta a un producto', () => {
    const c = control();
    expect(c.x).toBe(0);
    // Dedo 150 px a la izquierda en 300 ms → la cámara avanza hacia la derecha.
    arrastrarX(c, -150, 300);
    reposar(c);
    expect(c.x).toBeGreaterThan(0.3);
    const fila = PUNTOS[0] ?? [];
    expect(fila.some((p) => Math.abs(p - c.x) < 1e-3)).toBe(true);
    expect(c.enMovimiento()).toBe(false);
  });

  it('un arrastre lento y corto vuelve al producto de partida', () => {
    const c = control();
    arrastrarX(c, -20, 2000);
    reposar(c);
    expect(c.x).toBeCloseTo(0, 3);
  });

  it('no se sale del raíl al lanzar con mucha fuerza', () => {
    const c = control();
    arrastrarX(c, -4000, 150);
    reposar(c);
    expect(c.x).toBeCloseTo(1.0, 3);
    arrastrarX(c, 8000, 100);
    reposar(c);
    expect(c.x).toBeCloseTo(0, 3);
  });

  it('un toque sin movimiento no mueve la cámara', () => {
    const c = control();
    c.empezarArrastre();
    c.terminarArrastre();
    reposar(c);
    expect(c.x).toBe(0);
  });

  it('tocar mientras se mueve detiene la cámara en el sitio', () => {
    const c = control();
    c.teclado('ArrowRight');
    for (let i = 0; i < 5; i++) c.actualizar(1 / 60);
    const donde = c.x;
    c.empezarArrastre();
    for (let i = 0; i < 30; i++) c.actualizar(1 / 60);
    expect(c.x).toBeCloseTo(donde, 6);
  });
});

describe('ControlRiel · gesto vertical', () => {
  it.each([-1, 1])(
    'el contenido acompaña al dedo durante el arrastre vertical (%i) y mantiene el sentido al soltar',
    (sentido) => {
      const c = control({ filaInicial: 1 });
      c.empezarArrastre();
      c.moverArrastre(0, (sentido * PX_POR_FILA) / 2, 0.3);
      // Filas y altura de cámara crecen hacia arriba; píxeles de pantalla crecen hacia abajo.
      // La cámara baja al subir el dedo para que las cajas se desplacen hacia arriba.
      expect(c.fila).toBeCloseTo(1 + sentido / 2);
      const durante = c.fila;
      c.terminarArrastre();
      c.actualizar(1 / 60);
      expect((c.fila - durante) * sentido).toBeGreaterThan(0);
      reposar(c);
      expect(c.fila).toBeCloseTo(1 + sentido, 3);
    },
  );
  it('dedo hacia arriba baja de balda y hacia abajo sube (como desplazar una página)', () => {
    const c = control({ filaInicial: 1 });
    arrastrarY(c, -PX_POR_FILA, 250);
    reposar(c);
    expect(c.filaObjetivo).toBe(0);
    expect(c.fila).toBeCloseTo(0, 3);

    arrastrarY(c, PX_POR_FILA * 2, 300);
    reposar(c);
    // Un solo gesto cambia como mucho una balda.
    expect(c.filaObjetivo).toBe(1);
  });

  it('un gesto vertical corto y lento no cambia de balda', () => {
    const c = control({ filaInicial: 1 });
    arrastrarY(c, 20, 1500);
    reposar(c);
    expect(c.filaObjetivo).toBe(1);
    expect(c.fila).toBeCloseTo(1, 3);
  });

  it('no sale del rango de baldas', () => {
    const c = control({ filaInicial: 0 });
    arrastrarY(c, -400, 150);
    reposar(c);
    expect(c.filaObjetivo).toBe(0);
    const d = control({ filaInicial: 2 });
    arrastrarY(d, 400, 150);
    reposar(d);
    expect(d.filaObjetivo).toBe(2);
  });

  it('al cambiar de balda la cámara se reajusta a un producto de la nueva balda', () => {
    const c = control({ filaInicial: 0 });
    c.teclado('ArrowRight');
    c.teclado('ArrowRight'); // x = 0,4
    reposar(c);
    c.teclado('ArrowUp'); // fila 1: productos en 0,3 y 0,5
    reposar(c);
    const fila = PUNTOS[1] ?? [];
    expect(fila.some((p) => Math.abs(p - c.x) < 1e-3)).toBe(true);
  });

  it('un gesto diagonal se decide por el eje dominante y no mezcla ambos', () => {
    const c = control({ filaInicial: 1 });
    c.empezarArrastre();
    for (let i = 0; i < 10; i++) c.moverArrastre(-4, -20, 0.016);
    c.terminarArrastre();
    reposar(c);
    expect(c.filaObjetivo).toBe(0);
    // Se reajusta al producto más cercano de la nueva balda (0); si el componente horizontal
    // (−40 px ≈ 0,08 m) se hubiera aplicado, habría acabado en 0,2.
    expect(c.x).toBeCloseTo(0, 3);
  });
});

describe('ControlRiel · teclado', () => {
  it('las flechas izquierda y derecha pasan de producto en producto', () => {
    const c = control();
    expect(c.teclado('ArrowRight')).toBe(true);
    reposar(c);
    expect(c.x).toBeCloseTo(0.2, 3);
    c.teclado('ArrowRight');
    reposar(c);
    expect(c.x).toBeCloseTo(0.4, 3);
    c.teclado('ArrowLeft');
    reposar(c);
    expect(c.x).toBeCloseTo(0.2, 3);
  });

  it('Inicio y Fin llevan a los extremos de la balda', () => {
    const c = control();
    c.teclado('End');
    reposar(c);
    expect(c.x).toBeCloseTo(1.0, 3);
    c.teclado('Home');
    reposar(c);
    expect(c.x).toBeCloseTo(0, 3);
  });

  it('ignora las teclas que no usa para no capturar atajos del navegador', () => {
    const c = control();
    expect(c.teclado('Tab')).toBe(false);
    expect(c.teclado('a')).toBe(false);
  });
});

describe('ControlRiel · rueda', () => {
  it('cada golpe de rueda avanza un producto o una balda, con pausa entre golpes', () => {
    const c = control({ filaInicial: 1 });
    c.rueda(0, 100, 1000); // abajo → balda inferior
    expect(c.filaObjetivo).toBe(0);
    c.rueda(0, 100, 1100); // demasiado pronto
    expect(c.filaObjetivo).toBe(0);
    c.rueda(0, -100, 1500); // arriba → balda superior
    expect(c.filaObjetivo).toBe(1);
    const antes = c.destinoActual();
    c.rueda(80, 0, 2000);
    expect(c.destinoActual()).toBeGreaterThan(antes);
  });

  it('ignora movimientos mínimos del trackpad', () => {
    const c = control({ filaInicial: 1 });
    c.rueda(0, 3, 1000);
    expect(c.filaObjetivo).toBe(1);
  });
});

describe('ControlRiel · menos movimiento', () => {
  it('salta al destino sin animación', () => {
    const c = control({ instantaneo: true });
    c.teclado('ArrowRight');
    c.actualizar(1 / 60);
    expect(c.x).toBeCloseTo(0.2);
    c.teclado('ArrowUp');
    c.actualizar(1 / 60);
    expect(c.fila).toBe(1);
    expect(c.enMovimiento()).toBe(false);
  });
});

describe('encuadre', () => {
  it('en vertical (móvil) aleja más la cámara que en horizontal', () => {
    expect(distanciaRiel(38, 0.5)).toBeGreaterThan(distanciaRiel(38, 1.8));
    expect(distanciaRiel(38, 3)).toBeGreaterThanOrEqual(1.2);
  });

  it('metrosPorPixel crece con la distancia y baja con la altura del lienzo', () => {
    expect(metrosPorPixel(38, 2, 800)).toBeGreaterThan(metrosPorPixel(38, 1, 800));
    expect(metrosPorPixel(38, 2, 1600)).toBeCloseTo(metrosPorPixel(38, 2, 800) / 2);
  });
});
