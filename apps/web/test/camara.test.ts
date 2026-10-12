import { describe, expect, it } from 'vitest';
import { distanciaCamara } from '../src/escena/Escena';

describe('distanciaCamara', () => {
  it('en móvil vertical aleja la cámara para que quepa el ancho', () => {
    expect(distanciaCamara(38, 0.54)).toBeGreaterThan(distanciaCamara(38, 1.8));
  });

  it('en pantallas anchas no se acerca más de la distancia mínima', () => {
    expect(distanciaCamara(38, 3)).toBeGreaterThanOrEqual(2.6);
  });
});
