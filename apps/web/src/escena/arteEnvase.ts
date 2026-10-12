import type { ProductoResumen } from '@rebotica/shared';

/**
 * Diseño de las seis caras de una caja (frente, trasera, laterales, tapa y base), dibujado con
 * Canvas 2D en el navegador a partir de los datos del producto y la paleta de su envase. Se dibuja
 * a medida (no se estira una foto): el texto sale nítido a cualquier zoom. Sin dependencias de
 * three: solo necesita un contexto 2D.
 */

export type Cara = 'frente' | 'trasera' | 'izquierda' | 'derecha' | 'superior' | 'inferior';

export interface DatosEnvase {
  nombre: string;
  principioActivo: string;
  dosis: string | null;
  forma: string | null;
  categoria: string | null;
  laboratorio: string | null;
  generico: boolean;
  conduccion: boolean;
  /** Colores del envase de mayor a menor presencia; al menos uno. */
  paleta: readonly string[];
}

/** Lo mínimo que se usa de un contexto 2D (permite probar con un contexto de mentira). */
export type Contexto2D = Pick<
  CanvasRenderingContext2D,
  | 'fillStyle'
  | 'strokeStyle'
  | 'lineWidth'
  | 'font'
  | 'textAlign'
  | 'textBaseline'
  | 'fillRect'
  | 'strokeRect'
  | 'fillText'
  | 'measureText'
  | 'save'
  | 'restore'
  | 'translate'
  | 'rotate'
  | 'beginPath'
  | 'moveTo'
  | 'lineTo'
  | 'closePath'
  | 'fill'
  | 'stroke'
>;

const FAMILIA = 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
export const PAPEL = '#fbfaf6';
export const TINTA = '#1d2420';
const COLOR_RESPALDO = ['#5b6770', '#3b444b'] as const;

// ---- Colores ----------------------------------------------------------------------------

function canales(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return [128, 128, 128];
  return [parseInt(m[1] ?? '80', 16), parseInt(m[2] ?? '80', 16), parseInt(m[3] ?? '80', 16)];
}

function luminancia(hex: string): number {
  const [r, g, b] = canales(hex).map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

/** Razón de contraste WCAG entre dos colores. */
export function contraste(a: string, b: string): number {
  const [la, lb] = [luminancia(a), luminancia(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Blanco o tinta, el que más contraste dé sobre `fondo`. */
export function colorTexto(fondo: string): string {
  return contraste('#ffffff', fondo) >= contraste(TINTA, fondo) ? '#ffffff' : TINTA;
}

function oscurecer(hex: string, factor: number): string {
  const [r, g, b] = canales(hex).map((c) => Math.round(c * factor));
  return `#${[r, g, b].map((c) => (c ?? 0).toString(16).padStart(2, '0')).join('')}`;
}

/** Color de la paleta apto para texto sobre papel: se oscurece hasta tener contraste ≥ 4,5. */
export function legibleSobrePapel(color: string): string {
  let c = color;
  for (let i = 0; i < 6 && contraste(c, PAPEL) < 4.5; i++) c = oscurecer(c, 0.75);
  return c;
}

/** Los dos colores con los que se pinta la caja: principal y secundario. */
export function coloresDe(datos: Pick<DatosEnvase, 'paleta'>): { p0: string; p1: string } {
  const p0 = datos.paleta[0] ?? COLOR_RESPALDO[0];
  const p1 = datos.paleta[1] ?? oscurecer(p0, 0.6);
  return { p0, p1 };
}

// ---- Texto ------------------------------------------------------------------------------

export interface OpcionesTexto {
  maxLineas: number;
  tamanoMax: number;
  tamanoMin?: number;
  peso?: number;
  interlineado?: number;
}

export interface TextoAjustado {
  lineas: string[];
  tamano: number;
  peso: number;
}

function partir(ctx: Contexto2D, texto: string, anchoMax: number): string[] {
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (actual && ctx.measureText(prueba).width > anchoMax) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

function recortar(ctx: Contexto2D, linea: string, anchoMax: number): string {
  if (ctx.measureText(linea).width <= anchoMax) return linea;
  let s = linea;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > anchoMax) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

/**
 * Reduce el cuerpo de letra hasta que `texto` quepa en `ancho × alto` con como mucho `maxLineas`.
 * Si ni al mínimo cabe, recorta con «…» (nunca se sale de la caja).
 */
export function ajustarTexto(
  ctx: Contexto2D,
  texto: string,
  ancho: number,
  alto: number,
  { maxLineas, tamanoMax, tamanoMin = 6, peso = 700, interlineado = 1.15 }: OpcionesTexto,
): TextoAjustado {
  const maximo = Math.max(tamanoMax, tamanoMin);
  let tamano = maximo;
  while (tamano >= tamanoMin) {
    ctx.font = `${peso} ${tamano}px ${FAMILIA}`;
    const lineas = partir(ctx, texto, ancho);
    const caben =
      lineas.length <= maxLineas &&
      lineas.length * tamano * interlineado <= alto &&
      lineas.every((l) => ctx.measureText(l).width <= ancho);
    if (caben) return { lineas, tamano, peso };
    tamano *= 0.92;
  }
  tamano = tamanoMin;
  ctx.font = `${peso} ${tamano}px ${FAMILIA}`;
  const lineas = partir(ctx, texto, ancho).slice(0, maxLineas);
  const ultima = lineas.length - 1;
  const resultado = lineas.map((l, i) =>
    i === ultima ? recortar(ctx, l, ancho) : recortar(ctx, l, ancho),
  );
  return { lineas: resultado, tamano, peso };
}

interface Caja2D {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/** Dibuja texto ajustado dentro de `caja`, alineado y centrado en vertical dentro de ella. */
function escribir(
  ctx: Contexto2D,
  texto: string | null,
  caja: Caja2D,
  color: string,
  opciones: OpcionesTexto & { alinear?: 'left' | 'center' },
): number {
  if (!texto || !texto.trim()) return 0;
  const ajustado = ajustarTexto(ctx, texto, caja.ancho, caja.alto, opciones);
  const h = ajustado.tamano * (opciones.interlineado ?? 1.15);
  const alinear = opciones.alinear ?? 'left';
  ctx.font = `${ajustado.peso} ${ajustado.tamano}px ${FAMILIA}`;
  ctx.fillStyle = color;
  ctx.textAlign = alinear;
  ctx.textBaseline = 'middle';
  const total = ajustado.lineas.length * h;
  const y0 = caja.y + (caja.alto - total) / 2 + h / 2;
  const x = alinear === 'center' ? caja.x + caja.ancho / 2 : caja.x;
  ajustado.lineas.forEach((l, i) => ctx.fillText(l, x, y0 + i * h));
  return total;
}

// ---- Caras ------------------------------------------------------------------------------

function fondo(ctx: Contexto2D, color: string, w: number, h: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
}

/** Triángulo de aviso de conducción (pictograma del medicamento que puede afectarla). */
function pictogramaConduccion(ctx: Contexto2D, x: number, y: number, lado: number): void {
  ctx.beginPath();
  ctx.moveTo(x + lado / 2, y);
  ctx.lineTo(x + lado, y + lado * 0.9);
  ctx.lineTo(x, y + lado * 0.9);
  ctx.closePath();
  ctx.fillStyle = '#f2c200';
  ctx.fill();
  ctx.strokeStyle = TINTA;
  ctx.lineWidth = Math.max(1, lado * 0.07);
  ctx.stroke();
  ctx.fillStyle = TINTA;
  ctx.font = `800 ${lado * 0.5}px ${FAMILIA}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', x + lado / 2, y + lado * 0.62);
}

function dibujarFrente(ctx: Contexto2D, w: number, h: number, d: DatosEnvase): void {
  const { p0, p1 } = coloresDe(d);
  fondo(ctx, PAPEL, w, h);

  const margen = w * 0.06;
  const banda = h * 0.3;
  ctx.fillStyle = p0;
  ctx.fillRect(0, 0, w, banda);
  escribir(
    ctx,
    d.nombre,
    { x: margen, y: banda * 0.1, ancho: w - 2 * margen, alto: banda * 0.8 },
    colorTexto(p0),
    { maxLineas: 3, tamanoMax: banda * 0.42, peso: 800 },
  );

  // Franja de la marca a la izquierda del cuerpo.
  const pie = h * 0.15;
  ctx.fillStyle = p1;
  ctx.fillRect(0, banda, w * 0.035, h - banda - pie);

  const cuerpo = h - banda - pie;
  const xTexto = margen + w * 0.02;
  const anchoTexto = w - xTexto - margen;
  escribir(
    ctx,
    d.principioActivo,
    {
      x: xTexto,
      y: banda + cuerpo * 0.06,
      ancho: anchoTexto * (d.conduccion ? 0.8 : 1),
      alto: cuerpo * 0.4,
    },
    TINTA,
    { maxLineas: 2, tamanoMax: cuerpo * 0.2, peso: 600 },
  );
  escribir(
    ctx,
    d.dosis,
    { x: xTexto, y: banda + cuerpo * 0.52, ancho: anchoTexto, alto: cuerpo * 0.4 },
    legibleSobrePapel(p0),
    { maxLineas: 1, tamanoMax: cuerpo * 0.36, peso: 800 },
  );
  if (d.conduccion) {
    const lado = Math.min(w, h) * 0.17;
    pictogramaConduccion(ctx, w - margen - lado, banda + cuerpo * 0.08, lado);
  }

  // Pie: forma farmacéutica y distintivo de genérico.
  const colorPie = contraste('#ffffff', p1) >= 3 ? p1 : oscurecer(p1, 0.6);
  ctx.fillStyle = colorPie;
  ctx.fillRect(0, h - pie, w, pie);
  const anchoGenerico = d.generico ? w * 0.2 : 0;
  escribir(
    ctx,
    d.forma,
    { x: margen, y: h - pie, ancho: w - 2 * margen - anchoGenerico, alto: pie },
    colorTexto(colorPie),
    { maxLineas: 1, tamanoMax: pie * 0.5, peso: 600 },
  );
  if (d.generico) {
    escribir(
      ctx,
      'EFG',
      { x: w - margen - anchoGenerico, y: h - pie, ancho: anchoGenerico, alto: pie },
      colorTexto(colorPie),
      { maxLineas: 1, tamanoMax: pie * 0.55, peso: 800, alinear: 'center' },
    );
  }
}

function dibujarTrasera(ctx: Contexto2D, w: number, h: number, d: DatosEnvase): void {
  const { p0, p1 } = coloresDe(d);
  fondo(ctx, PAPEL, w, h);
  const margen = w * 0.06;
  const banda = h * 0.15;
  ctx.fillStyle = p0;
  ctx.fillRect(0, 0, w, banda);
  escribir(ctx, d.nombre, { x: margen, y: 0, ancho: w - 2 * margen, alto: banda }, colorTexto(p0), {
    maxLineas: 1,
    tamanoMax: banda * 0.5,
    peso: 800,
  });

  const filas: [string, string][] = [];
  if (d.principioActivo) filas.push(['Principio activo', d.principioActivo]);
  if (d.dosis) filas.push(['Dosis', d.dosis]);
  if (d.forma) filas.push(['Forma farmacéutica', d.forma]);
  if (d.categoria) filas.push(['Categoría', d.categoria]);
  if (d.laboratorio) filas.push(['Laboratorio titular', d.laboratorio]);

  const pie = h * 0.1;
  const inicio = banda + h * 0.03;
  const alto = h - pie - inicio;
  const filaH = alto / Math.max(filas.length, 1);
  const etiqueta = legibleSobrePapel(p0);
  filas.forEach(([nombre, valor], i) => {
    const y = inicio + i * filaH;
    escribir(
      ctx,
      nombre.toUpperCase(),
      { x: margen, y, ancho: w - 2 * margen, alto: filaH * 0.3 },
      etiqueta,
      { maxLineas: 1, tamanoMax: filaH * 0.22, peso: 700 },
    );
    escribir(
      ctx,
      valor,
      { x: margen, y: y + filaH * 0.3, ancho: w - 2 * margen, alto: filaH * 0.62 },
      TINTA,
      { maxLineas: 2, tamanoMax: filaH * 0.36, peso: 600 },
    );
  });

  // Pie: genérico y conducción, con letra clara.
  const avisos = [
    d.generico ? 'Genérico (EFG)' : null,
    d.conduccion ? 'Puede afectar a la conducción' : null,
  ]
    .filter((x): x is string => x !== null)
    .join('  ·  ');
  ctx.fillStyle = p1;
  ctx.fillRect(0, h - pie, w, pie);
  if (avisos) {
    escribir(
      ctx,
      avisos,
      { x: margen, y: h - pie, ancho: w - 2 * margen, alto: pie },
      colorTexto(p1),
      { maxLineas: 1, tamanoMax: pie * 0.5, peso: 600 },
    );
  }
}

/** Cara lateral: banda de color con el texto girado a lo largo de la cara (de abajo arriba). */
function dibujarLateral(
  ctx: Contexto2D,
  w: number,
  h: number,
  color: string,
  principal: string | null,
  secundario: string | null,
): void {
  fondo(ctx, color, w, h);
  const tinta = colorTexto(color);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 2);
  const largo = h * 0.92;
  const grueso = w * 0.86;
  // En el sistema girado, el «ancho» del texto es la altura de la cara.
  if (principal && secundario) {
    escribir(
      ctx,
      principal,
      { x: -largo / 2, y: -grueso / 2, ancho: largo, alto: grueso * 0.55 },
      tinta,
      {
        maxLineas: 1,
        tamanoMax: grueso * 0.5,
        peso: 800,
        alinear: 'center',
      },
    );
    escribir(
      ctx,
      secundario,
      { x: -largo / 2, y: grueso * 0.05, ancho: largo, alto: grueso * 0.4 },
      tinta,
      {
        maxLineas: 1,
        tamanoMax: grueso * 0.32,
        peso: 600,
        alinear: 'center',
      },
    );
  } else {
    escribir(
      ctx,
      principal ?? secundario,
      { x: -largo / 2, y: -grueso / 2, ancho: largo, alto: grueso },
      tinta,
      { maxLineas: 2, tamanoMax: grueso * 0.5, peso: 800, alinear: 'center' },
    );
  }
  ctx.restore();
}

/** Tapa o base: color liso con dos líneas centradas. */
function dibujarTapa(
  ctx: Contexto2D,
  w: number,
  h: number,
  color: string,
  linea1: string | null,
  linea2: string | null,
): void {
  fondo(ctx, color, w, h);
  const tinta = colorTexto(color);
  const margen = Math.min(w, h) * 0.08;
  if (linea1 && linea2) {
    escribir(
      ctx,
      linea1,
      { x: margen, y: h * 0.12, ancho: w - 2 * margen, alto: h * 0.46 },
      tinta,
      {
        maxLineas: 2,
        tamanoMax: h * 0.4,
        peso: 800,
        alinear: 'center',
      },
    );
    escribir(ctx, linea2, { x: margen, y: h * 0.6, ancho: w - 2 * margen, alto: h * 0.28 }, tinta, {
      maxLineas: 1,
      tamanoMax: h * 0.26,
      peso: 600,
      alinear: 'center',
    });
  } else {
    escribir(
      ctx,
      linea1 ?? linea2,
      { x: margen, y: margen, ancho: w - 2 * margen, alto: h - 2 * margen },
      tinta,
      { maxLineas: 2, tamanoMax: h * 0.4, peso: 800, alinear: 'center' },
    );
  }
}

/** Texto «500 mg · Comprimido» (lo que haya) para las caras secundarias. */
function dosisYForma(d: DatosEnvase): string | null {
  return [d.dosis, d.forma].filter(Boolean).join(' · ') || null;
}

/**
 * Dibuja una cara de la caja en un lienzo de `ancho × alto` píxeles. Cada cara lleva información
 * del producto: frente (nombre, principio activo, dosis, forma), trasera (ficha con todos los
 * datos), laterales (nombre y dosis / laboratorio y categoría), tapa y base.
 */
export function dibujarCara(
  ctx: Contexto2D,
  cara: Cara,
  ancho: number,
  alto: number,
  datos: DatosEnvase,
): void {
  const { p0, p1 } = coloresDe(datos);
  switch (cara) {
    case 'frente':
      return dibujarFrente(ctx, ancho, alto, datos);
    case 'trasera':
      return dibujarTrasera(ctx, ancho, alto, datos);
    case 'izquierda':
      return dibujarLateral(ctx, ancho, alto, p0, datos.nombre, dosisYForma(datos));
    case 'derecha':
      return dibujarLateral(ctx, ancho, alto, p1, datos.categoria, datos.laboratorio);
    case 'superior':
      return dibujarTapa(ctx, ancho, alto, p0, datos.nombre, datos.dosis);
    case 'inferior':
      return dibujarTapa(ctx, ancho, alto, p1, datos.laboratorio, datos.categoria);
  }
}

/**
 * Lateral de un cilindro (spray, frasco): el texto de la trasera da toda la vuelta y el frente
 * ocupa la mitad central, que es la que mira al pasillo.
 */
export function dibujarEnvolvente(
  ctx: Contexto2D,
  ancho: number,
  alto: number,
  datos: DatosEnvase,
): void {
  dibujarTrasera(ctx, ancho, alto, datos);
  ctx.save();
  ctx.translate(ancho / 4, 0);
  dibujarFrente(ctx, ancho / 2, alto, datos);
  ctx.restore();
}

// ---- Datos -------------------------------------------------------------------------------

function frase(texto: string | null): string | null {
  if (!texto) return null;
  const t = texto.trim().toLowerCase();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : null;
}

/** Datos que se dibujan en la caja de un producto del pasillo. */
export function datosEnvase(p: ProductoResumen): DatosEnvase {
  const paleta = p.asset && p.asset.paleta.length > 0 ? p.asset.paleta : [];
  return {
    nombre: p.nombre,
    principioActivo: frase(p.principioActivo) ?? '',
    dosis: p.dosis,
    forma: frase(p.forma),
    categoria: p.categoria,
    laboratorio: p.laboratorio,
    generico: p.generico,
    conduccion: p.conduccion,
    paleta: paleta.length > 0 ? paleta : p.asset ? [p.asset.colorDominante] : [...COLOR_RESPALDO],
  };
}

export interface TamanoCara {
  ancho: number;
  alto: number;
}

/** Calidad de las texturas: la estantería usa poca resolución y la ficha, la máxima. */
export type Calidad = 'estanteria' | 'ficha';

const PX_POR_METRO: Record<Calidad, number> = { estanteria: 2600, ficha: 8000 };
const LADO_MAXIMO = 1024;

/**
 * Tamaño en píxeles del lienzo de una cara, proporcional a sus medidas reales (metros) y acotado.
 */
export function tamanoCara(anchoM: number, altoM: number, calidad: Calidad): TamanoCara {
  const px = PX_POR_METRO[calidad];
  let ancho = anchoM * px;
  let alto = altoM * px;
  const mayor = Math.max(ancho, alto);
  if (mayor > LADO_MAXIMO) {
    const f = LADO_MAXIMO / mayor;
    ancho *= f;
    alto *= f;
  }
  return { ancho: Math.max(16, Math.round(ancho)), alto: Math.max(16, Math.round(alto)) };
}
