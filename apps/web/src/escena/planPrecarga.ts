import type { FormaCaja } from '@rebotica/shared';
import { tamanoCara, type Calidad } from './arteEnvase';
import { medidasCara, ranurasCaja } from './geometriaCaja';

/** Aproximación conservadora: RGBA del lienzo y de la textura GPU, sin mipmaps. */
export function bytesEnvase(forma: FormaCaja, calidad: Calidad): number {
  return ranurasCaja(forma).reduce((n, ranura) => {
    const m = medidasCara(forma, ranura);
    const t = tamanoCara(m.ancho, m.alto, calidad);
    return n + t.ancho * t.alto * 8;
  }, 0);
}

/** Presupuesto de reserva; los recursos visibles y la ficha siguen su propio ciclo de uso. */
export function presupuestoPrecarga(memoriaGb: number | undefined): number {
  const mb =
    !memoriaGb || !Number.isFinite(memoriaGb)
      ? 192
      : memoriaGb <= 2
        ? 48
        : memoriaGb <= 4
          ? 192
          : 512;
  return mb * 1024 * 1024;
}

export function planPrecarga<T extends { clave: string; estanteria: number; bytes: number }>(
  envases: readonly T[],
  centro: number,
  presupuesto: number,
): T[] {
  const ordenados = [...envases].sort(
    (a, b) =>
      Math.abs(a.estanteria - centro) - Math.abs(b.estanteria - centro) ||
      a.estanteria - b.estanteria,
  );
  const vistos = new Set<string>();
  const resultado: T[] = [];
  let bytes = 0;
  for (const e of ordenados) {
    if (vistos.has(e.clave)) continue;
    vistos.add(e.clave);
    if (bytes + e.bytes > presupuesto) break;
    bytes += e.bytes;
    resultado.push(e);
  }
  return resultado;
}

/** Un envase por turno de reposo; se cancela sin dejar trabajo pendiente al salir. */
export function programarPrecarga(
  prepararSiguiente: () => boolean,
  ocupada: () => boolean,
  entorno: {
    programar: (trabajo: () => void) => () => void;
    reposo: (trabajo: () => void) => () => void;
  },
): () => void {
  let cancelada = false;
  let cancelar = () => {};
  const avanzar = () => {
    if (cancelada) return;
    if (ocupada()) {
      cancelar = entorno.programar(avanzar);
      return;
    }
    cancelar = entorno.reposo(() => {
      if (cancelada) return;
      if (ocupada() || prepararSiguiente()) cancelar = entorno.programar(avanzar);
    });
  };
  cancelar = entorno.programar(avanzar);
  return () => {
    cancelada = true;
    cancelar();
  };
}
