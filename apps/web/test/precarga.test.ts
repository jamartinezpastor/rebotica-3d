import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bytesEnvase,
  planPrecarga,
  presupuestoPrecarga,
  programarPrecarga,
} from '../src/escena/planPrecarga';

afterEach(() => vi.useRealTimers());

describe('precarga por proximidad y memoria', () => {
  const envases = Array.from({ length: 12 }, (_, i) => ({
    clave: `caja-${i}`,
    estanteria: i,
    bytes: 10,
  }));
  it('prepara todas cuando caben, empezando por la estantería actual y luego las próximas', () => {
    const plan = planPrecarga(envases, 5, 120);
    expect(plan).toHaveLength(12);
    expect(plan.slice(0, 5).map((e) => e.estanteria)).toEqual([5, 4, 6, 3, 7]);
    expect(new Set(plan.map((e) => e.clave)).size).toBe(12);
  });
  it('no excede el presupuesto y al saltar reprioriza la zona de destino', () => {
    expect(planPrecarga(envases, 0, 30).map((e) => e.estanteria)).toEqual([0, 1, 2]);
    expect(planPrecarga(envases, 11, 30).map((e) => e.estanteria)).toEqual([11, 10, 9]);
    expect(planPrecarga(envases, 5, 0)).toEqual([]);
  });
  it('no reserva dos veces los materiales que comparten clave', () => {
    expect(planPrecarga([envases[0]!, envases[0]!, envases[1]!], 0, 20)).toHaveLength(2);
  });
  it('estima memoria por calidad y adapta la reserva a la memoria disponible', () => {
    const ligera = bytesEnvase('caja-plana', 'ligera');
    const normal = bytesEnvase('caja-plana', 'estanteria');
    expect(ligera).toBeGreaterThan(0);
    expect(ligera).toBeLessThan(normal * 0.3);
    expect(presupuestoPrecarga(2)).toBeLessThan(presupuestoPrecarga(8));
    expect(presupuestoPrecarga(undefined)).toBeGreaterThan(0);
  });
});

function entorno() {
  const turno = (fn: () => void) => {
    const id = setTimeout(fn, 80);
    return () => clearTimeout(id);
  };
  return { programar: turno, reposo: turno };
}
describe('turnos de precarga', () => {
  it('divide el trabajo en turnos y termina sin mantener temporizadores', () => {
    vi.useFakeTimers();
    let quedan = 3;
    const preparar = vi.fn(() => --quedan > 0);
    programarPrecarga(preparar, () => false, entorno());
    vi.advanceTimersByTime(160);
    expect(preparar).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(preparar).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cede el paso al arrastre o al movimiento y vuelve a trabajar al quedar en reposo', () => {
    vi.useFakeTimers();
    let ocupada = true;
    const preparar = vi.fn(() => false);
    programarPrecarga(preparar, () => ocupada, entorno());
    vi.advanceTimersByTime(1000);
    expect(preparar).not.toHaveBeenCalled();
    ocupada = false;
    vi.advanceTimersByTime(160);
    expect(preparar).toHaveBeenCalledTimes(1);
  });
  it('comprueba otra vez la interacción si empieza justo antes del turno de reposo', () => {
    vi.useFakeTimers();
    let ocupada = false;
    const preparar = vi.fn(() => false);
    const cancelar = programarPrecarga(preparar, () => ocupada, entorno());
    vi.advanceTimersByTime(80);
    ocupada = true;
    vi.advanceTimersByTime(80);
    expect(preparar).not.toHaveBeenCalled();
    cancelar();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cancelar al cambiar de escena o salir impide trabajo tardío', () => {
    vi.useFakeTimers();
    const preparar = vi.fn(() => true);
    const cancelar = programarPrecarga(preparar, () => false, entorno());
    vi.advanceTimersByTime(160);
    cancelar();
    vi.advanceTimersByTime(10000);
    expect(preparar).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
