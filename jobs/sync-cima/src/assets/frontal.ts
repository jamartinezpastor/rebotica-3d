import sharp from 'sharp';

/**
 * Tamaño de la cara frontal en el atlas. Los envases planos (comprimidos, sobres) se fotografían
 * apaisados y los altos (jarabes, tubos, sprays) en vertical: cada forma usa su orientación.
 */
export type Orientacion = 'vertical' | 'apaisada';
export const TILE_LARGO = 256;
export const TILE_CORTO = 144;

export function dimensiones(orientacion: Orientacion): { ancho: number; alto: number } {
  return orientacion === 'vertical'
    ? { ancho: TILE_CORTO, alto: TILE_LARGO }
    : { ancho: TILE_LARGO, alto: TILE_CORTO };
}

export function orientacionDe(forma: string): Orientacion {
  return forma === 'caja-plana' || forma === 'caja-cuadrada' ? 'apaisada' : 'vertical';
}

export interface DatosFrontal {
  nombre: string;
  pactivos: string;
  dosis: string | null;
  color: string;
}

const escapar = (texto: string) =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Parte `texto` en líneas de como mucho `max` caracteres; recorta con «…» si no caben. */
export function ajustarLineas(texto: string, max: number, maxLineas: number): string[] {
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of palabras) {
    const trozo = palabra.length > max ? `${palabra.slice(0, max - 1)}…` : palabra;
    if (!actual) actual = trozo;
    else if (`${actual} ${trozo}`.length <= max) actual = `${actual} ${trozo}`;
    else {
      lineas.push(actual);
      actual = trozo;
    }
  }
  if (actual) lineas.push(actual);
  if (lineas.length <= maxLineas) return lineas;
  const visibles = lineas.slice(0, maxLineas);
  const ultima = visibles[maxLineas - 1] ?? '';
  visibles[maxLineas - 1] = `${ultima.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
  return visibles;
}

function texto(lineas: string[], x: number, y: number, tamano: number, peso: number): string {
  return lineas
    .map(
      (l, i) =>
        `<text x="${x}" y="${y + i * Math.round(tamano * 1.25)}" font-size="${tamano}" font-weight="${peso}">${escapar(l)}</text>`,
    )
    .join('');
}

/** SVG de la cara frontal generada: nombre, principio activo, dosis y color del grupo. */
export function svgFrontal(d: DatosFrontal, orientacion: Orientacion = 'vertical'): string {
  const { ancho, alto } = dimensiones(orientacion);
  const vertical = orientacion === 'vertical';
  const nombre = ajustarLineas(
    d.nombre.toLocaleUpperCase('es'),
    vertical ? 14 : 19,
    vertical ? 4 : 3,
  );
  const activo = ajustarLineas(
    d.pactivos.toLocaleLowerCase('es'),
    vertical ? 19 : 28,
    vertical ? 3 : 2,
  );
  const dosis = d.dosis ? ajustarLineas(d.dosis, vertical ? 16 : 26, 1) : [];
  const yActivo = vertical ? 154 : 104;
  const yDosis = vertical ? 232 : 130;
  const ySeparador = vertical ? 130 : 86;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">
<rect width="100%" height="100%" fill="${d.color}"/>
<rect x="8" y="8" width="${ancho - 16}" height="${alto - 16}" rx="6" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="2"/>
<g fill="#ffffff" font-family="DejaVu Sans, Arial, Helvetica, sans-serif">
${texto(nombre, 16, vertical ? 46 : 36, vertical ? 17 : 16, 700)}
<rect x="16" y="${ySeparador}" width="40" height="3" fill="#ffffff" fill-opacity="0.7"/>
${texto(activo, 16, yActivo, 12, 400)}
${texto(dosis, 16, yDosis, 15, 700)}
</g>
</svg>`;
}

export async function generarFrontal(
  d: DatosFrontal,
  orientacion: Orientacion = 'vertical',
): Promise<Buffer> {
  return sharp(Buffer.from(svgFrontal(d, orientacion)))
    .png()
    .toBuffer();
}

export interface FrontalFoto {
  png: Buffer;
  colorDominante: string;
}

const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');

/**
 * Color más frecuente entre los píxeles con color: se ignoran blancos, grises y negros, que en
 * una foto de producto son el fondo y la sombra. Devuelve `null` si no hay ninguno.
 */
export function colorDominante(rgb: Uint8Array | Buffer): string | null {
  const cubos = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 2 < rgb.length; i += 3) {
    const r = rgb[i] ?? 0;
    const g = rgb[i + 1] ?? 0;
    const b = rgb[i + 2] ?? 0;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturacion = max === 0 ? 0 : (max - min) / max;
    if (saturacion < 0.25 || max < 40 || min > 225) continue;
    const clave = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const cubo = cubos.get(clave) ?? { n: 0, r: 0, g: 0, b: 0 };
    cubo.n++;
    cubo.r += r;
    cubo.g += g;
    cubo.b += b;
    cubos.set(clave, cubo);
  }
  let mejor: { n: number; r: number; g: number; b: number } | null = null;
  for (const c of cubos.values()) if (!mejor || c.n > mejor.n) mejor = c;
  if (!mejor) return null;
  return `#${hex(mejor.r / mejor.n)}${hex(mejor.g / mejor.n)}${hex(mejor.b / mejor.n)}`;
}

/**
 * Ajusta la foto del embalaje al tile y extrae su color dominante. Se recortan los márgenes
 * blancos para que el envase ocupe la cara; `fallback` se usa si la foto no tiene color.
 */
export async function frontalDesdeFoto(
  foto: Uint8Array,
  orientacion: Orientacion,
  fallback: string,
): Promise<FrontalFoto> {
  const { ancho, alto } = dimensiones(orientacion);
  let imagen = sharp(foto).flatten({ background: '#ffffff' });
  try {
    const recortada = await imagen.clone().trim({ threshold: 18 }).toBuffer();
    imagen = sharp(recortada);
  } catch {
    // Sin márgenes que recortar (imagen uniforme): se usa la foto tal cual.
  }
  const { data } = await imagen
    .clone()
    .resize(32, 32, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const png = await imagen
    .clone()
    .resize(ancho, alto, { fit: 'contain', background: '#ffffff' })
    .png()
    .toBuffer();
  return { png, colorDominante: colorDominante(data) ?? fallback };
}
