/**
 * Paleta de colores de un envase a partir de su foto. La caja 3D se dibuja con estos colores
 * (marca visual del producto) y no con la foto, que CIMA solo publica en miniatura y en
 * perspectiva. Lógica pura sobre píxeles RGB.
 */

const hex = (n: number) =>
  Math.min(255, Math.max(0, Math.round(n)))
    .toString(16)
    .padStart(2, '0');

export const aHex = (r: number, g: number, b: number) => `#${hex(r)}${hex(g)}${hex(b)}`;

export function deHex(color: string): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!m) throw new RangeError(`color no válido: ${color}`);
  return [parseInt(m[1] ?? '0', 16), parseInt(m[2] ?? '0', 16), parseInt(m[3] ?? '0', 16)];
}

/** Multiplica la luminosidad de un color (`factor` < 1 lo oscurece, > 1 lo aclara). */
export function ajustarLuz(color: string, factor: number): string {
  const [r, g, b] = deHex(color);
  if (factor <= 1) return aHex(r * factor, g * factor, b * factor);
  const t = factor - 1;
  return aHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
}

export interface OpcionesPaleta {
  /** Máximo de colores devueltos. */
  max?: number;
  /** Distancia RGB mínima entre dos colores de la paleta. */
  separacion?: number;
  /** Fracción mínima de píxeles con color que debe tener un color para entrar. */
  presenciaMinima?: number;
}

/**
 * Colores más presentes del envase, de mayor a menor. Se ignoran los blancos, los grises y los
 * negros (fondo, sombras y texto) y se funden los tonos parecidos. Puede devolver menos de `max`
 * colores o ninguno si el envase es blanco y negro.
 */
export function extraerPaleta(
  rgb: Uint8Array | Buffer,
  { max = 3, separacion = 70, presenciaMinima = 0.04 }: OpcionesPaleta = {},
): string[] {
  const cubos = new Map<number, { n: number; r: number; g: number; b: number }>();
  let total = 0;
  for (let i = 0; i + 2 < rgb.length; i += 3) {
    const r = rgb[i] ?? 0;
    const g = rgb[i + 1] ?? 0;
    const b = rgb[i + 2] ?? 0;
    const mayor = Math.max(r, g, b);
    const menor = Math.min(r, g, b);
    const saturacion = mayor === 0 ? 0 : (mayor - menor) / mayor;
    if (saturacion < 0.25 || mayor < 40 || menor > 225) continue;
    total++;
    const clave = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const c = cubos.get(clave) ?? { n: 0, r: 0, g: 0, b: 0 };
    c.n++;
    c.r += r;
    c.g += g;
    c.b += b;
    cubos.set(clave, c);
  }
  if (total === 0) return [];

  const ordenados = [...cubos.values()]
    .sort((a, b) => b.n - a.n)
    .map((c) => ({ n: c.n, r: c.r / c.n, g: c.g / c.n, b: c.b / c.n }));

  // Se agrupa cada cubo con el color elegido más cercano si está a menos de `separacion`.
  const elegidos: { n: number; r: number; g: number; b: number }[] = [];
  for (const c of ordenados) {
    const cercano = elegidos.find((e) => Math.hypot(e.r - c.r, e.g - c.g, e.b - c.b) < separacion);
    if (cercano) {
      const suma = cercano.n + c.n;
      cercano.r = (cercano.r * cercano.n + c.r * c.n) / suma;
      cercano.g = (cercano.g * cercano.n + c.g * c.n) / suma;
      cercano.b = (cercano.b * cercano.n + c.b * c.n) / suma;
      cercano.n = suma;
    } else {
      elegidos.push({ ...c });
    }
  }
  return elegidos
    .sort((a, b) => b.n - a.n)
    .filter((e) => e.n / total >= presenciaMinima)
    .slice(0, max)
    .map((e) => aHex(e.r, e.g, e.b));
}

/**
 * Paleta de la caja: la de la foto o, si no hay, la del grupo terapéutico; siempre al menos dos
 * colores (el segundo, una variante oscura del primero, para bandas y laterales).
 */
export function paletaDeCaja(deFoto: readonly string[], respaldo: string): string[] {
  const base = deFoto.length > 0 ? [...deFoto] : [respaldo];
  if (base.length === 1) base.push(ajustarLuz(base[0] ?? respaldo, 0.6));
  return base.slice(0, 4);
}
