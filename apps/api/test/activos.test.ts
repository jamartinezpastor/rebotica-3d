import { describe, expect, it } from 'vitest';
import { claveActivo } from '../src/activos';

describe('claveActivo', () => {
  it('iguala la escritura de CIMA con la de los protocolos', () => {
    expect(claveActivo('ACETILSALICILICO ACIDO')).toBe(claveActivo('ácido acetilsalicílico'));
    expect(claveActivo('PARACETAMOL')).toBe(claveActivo('paracetamol'));
  });

  it('ignora el orden de las asociaciones y sus separadores', () => {
    const a = claveActivo('PARACETAMOL, CAFEINA, ACETILSALICILICO ACIDO');
    expect(claveActivo('cafeína + ácido acetilsalicílico + paracetamol')).toBe(a);
  });

  it('distingue un principio activo suelto de una asociación que lo contiene', () => {
    expect(claveActivo('paracetamol')).not.toBe(claveActivo('paracetamol, cafeina'));
  });
});
