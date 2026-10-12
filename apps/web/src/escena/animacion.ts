/**
 * Lógica pura de la entrada tipo «Constructo» (plan §Dirección visual): muelle amortiguado,
 * línea de tiempo y texto que se descifra. Nada aquí depende de three ni de React.
 */

/** Duración máxima de toda la entrada, en segundos. */
export const LIMITE_ENTRADA = 1.4;

export interface OpcionesMuelle {
  /** Fracción del recorrido que se sobrepasa antes de volver (el plan pide 3–5 %). */
  sobreimpulso?: number;
  /** Segundos hasta quedar en reposo. */
  asentamiento?: number;
}

/**
 * Posición normalizada (0 → 1) de un oscilador amortiguado que parte en reposo y se detiene en 1.
 * Sobrepasa 1 en `sobreimpulso` y vuelve; pasado `asentamiento` vale exactamente 1.
 */
export function muelle(
  t: number,
  { sobreimpulso = 0.04, asentamiento = 0.6 }: OpcionesMuelle = {},
): number {
  if (t <= 0) return 0;
  if (t >= asentamiento) return 1;
  const os = Math.min(Math.max(sobreimpulso, 1e-4), 0.5);
  const zeta = -Math.log(os) / Math.sqrt(Math.PI ** 2 + Math.log(os) ** 2);
  // La envolvente decae a 0,2 % justo al asentarse: el salto final es imperceptible.
  const sigma = 6.2 / asentamiento;
  const omega = sigma / zeta;
  const omegaD = omega * Math.sqrt(1 - zeta ** 2);
  const envolvente = Math.exp(-sigma * t);
  return (
    1 -
    envolvente * (Math.cos(omegaD * t) + (zeta / Math.sqrt(1 - zeta ** 2)) * Math.sin(omegaD * t))
  );
}

/** Avance lineal acotado a [0, 1] de un tramo que empieza en `inicio` y dura `duracion`. */
export function avance(t: number, inicio: number, duracion: number): number {
  if (duracion <= 0) return t >= inicio ? 1 : 0;
  return Math.min(1, Math.max(0, (t - inicio) / duracion));
}

export interface Tramo {
  inicio: number;
  duracion: number;
}

export interface PlanEntrada {
  estanterias: Tramo[];
  /** `cajas[i][j]` es la caja j de la estantería i. */
  cajas: Tramo[][];
  /** Instante en que todo está en reposo. */
  total: number;
}

export interface OpcionesPlan {
  /** Separación entre la llegada de una estantería y la siguiente (el plan: 80–120 ms). */
  escalonadoEstanterias?: number;
  duracionEstanteria?: number;
  /** Segundos tras el inicio de su estantería en que cae la primera caja. */
  retrasoCajas?: number;
  /** Escalonado entre cajas (el plan: 30 ms). */
  escalonadoCajas?: number;
  duracionCaja?: number;
  limite?: number;
}

/**
 * Línea de tiempo de la entrada. Si con los tiempos nominales se pasara del límite, se comprime
 * toda proporcionalmente: la entrada nunca dura más de `limite` segundos.
 */
export function planificarEntrada(
  cajasPorEstanteria: readonly number[],
  {
    escalonadoEstanterias = 0.1,
    duracionEstanteria = 0.55,
    retrasoCajas = 0.3,
    escalonadoCajas = 0.03,
    duracionCaja = 0.3,
    limite = LIMITE_ENTRADA,
  }: OpcionesPlan = {},
): PlanEntrada {
  const estanterias: Tramo[] = [];
  const cajas: Tramo[][] = [];
  let total = 0;

  cajasPorEstanteria.forEach((n, i) => {
    const inicio = i * escalonadoEstanterias;
    estanterias.push({ inicio, duracion: duracionEstanteria });
    total = Math.max(total, inicio + duracionEstanteria);
    const lista: Tramo[] = [];
    for (let j = 0; j < n; j++) {
      const tramo = { inicio: inicio + retrasoCajas + j * escalonadoCajas, duracion: duracionCaja };
      lista.push(tramo);
      total = Math.max(total, tramo.inicio + tramo.duracion);
    }
    cajas.push(lista);
  });

  if (total > limite) {
    const f = limite / total;
    for (const t of estanterias) {
      t.inicio *= f;
      t.duracion *= f;
    }
    for (const lista of cajas) {
      for (const t of lista) {
        t.inicio *= f;
        t.duracion *= f;
      }
    }
    total = limite;
  }
  return { estanterias, cajas, total };
}

const GLIFOS = '01ABCDEFXZ#$%&*+<>=/\\';

/** Generador pseudoaleatorio determinista (mulberry32) para que el efecto sea reproducible. */
function aleatorio(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TextoDescifrado {
  texto: string;
  /** Cuántos caracteres (de izquierda a derecha) ya son los definitivos. */
  descifrados: number;
}

/**
 * Texto de un letrero en el instante `progreso` (0 → 1): los caracteres se fijan de izquierda a
 * derecha y los que faltan son glifos al azar. Los espacios no se alteran.
 */
export function textoDescifrado(objetivo: string, progreso: number, semilla = 1): TextoDescifrado {
  const n = objetivo.length;
  if (progreso >= 1) return { texto: objetivo, descifrados: n };
  const fijos = Math.floor(Math.max(0, progreso) * n);
  const azar = aleatorio(semilla);
  let texto = '';
  for (let i = 0; i < n; i++) {
    const real = objetivo[i] ?? '';
    const glifo = GLIFOS[Math.floor(azar() * GLIFOS.length)] ?? '0';
    texto += i < fijos || real === ' ' ? real : glifo;
  }
  return { texto, descifrados: fijos };
}
