import { describe, expect, it } from 'vitest';
import { GrupoVitrinaPublico, PerfilPasillo, ProductoResumen } from '../src';

describe('contratos de la API', () => {
  it('la vitrina rechaza marcas, fotos, dosis o identificadores de producto', () => {
    const base = {
      principioActivo: 'principio ficticio',
      formas: ['comprimido'],
      paraQueSeUsa: 'para algo',
      porQueNecesitaReceta: 'porque sí',
      situacion: 'cuando toque',
    };
    expect(GrupoVitrinaPublico.safeParse(base).success).toBe(true);
    for (const extra of [
      { nombre: 'MARCA' },
      { fotoUrl: 'https://x.invalid/a.jpg' },
      { dosis: '500 mg' },
      { nregistro: '123' },
      { asset: null },
    ]) {
      expect(GrupoVitrinaPublico.safeParse({ ...base, ...extra }).success).toBe(false);
    }
  });

  it('el perfil convierte la edad y separa las condiciones', () => {
    const perfil = PerfilPasillo.parse({
      grupo: 'nino',
      edadMeses: '30',
      condiciones: 'embarazo, asma ,',
    });
    expect(perfil).toEqual({ grupo: 'nino', edadMeses: 30, condiciones: ['embarazo', 'asma'] });
    expect(PerfilPasillo.safeParse({ edadMeses: '-1' }).success).toBe(false);
    expect(PerfilPasillo.safeParse({ grupo: 'robot' }).success).toBe(false);
  });

  it('el resumen de producto exige una forma de caja válida', () => {
    const ok = {
      nregistro: '1',
      nombre: 'X',
      principioActivo: 'y',
      forma: null,
      formaCaja: 'tubo',
      dosis: null,
      generico: false,
      conduccion: false,
      asset: null,
      calculadora: false,
    };
    expect(ProductoResumen.safeParse(ok).success).toBe(true);
    expect(ProductoResumen.safeParse({ ...ok, formaCaja: 'esfera' }).success).toBe(false);
  });
});
