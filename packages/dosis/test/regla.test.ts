import { describe, expect, it } from 'vitest';
import { ReglaDosis, puedeMostrarCalculadora } from '../src/index';

/**
 * Regla FICTICIA solo para probar el esquema. Los números no corresponden a ningún
 * medicamento real y nunca deben copiarse a una regla de producción.
 */
const reglaFicticia = {
  id: 'principio-ficticio-solo-tests',
  version: 1,
  fuente: {
    nregistro: 'FICTICIO',
    seccion: '4.2',
    hashSeccion: 'sha256-ficticio',
    validadoPor: null,
    fecha: null,
  },
  presentacion: {
    concentracion: 10,
    unidad: 'mg/ml',
    unidadToma: 'ml',
    pasoDosificable: 0.5,
  },
  tramos: [
    {
      modo: 'porPeso',
      edadMinMeses: 0,
      edadMaxMeses: 120,
      mgKgToma: 2,
      intervaloHoras: 8,
      maxMgKgDia: 6,
      maxMgToma: 100,
    },
    {
      modo: 'fija',
      edadMinMeses: 120,
      pesoMinKg: 40,
      mgToma: 100,
      intervaloHoras: 8,
      maxMgDia: 300,
    },
  ],
  diasMaxSinConsultar: { dolor: 3 },
  bloqueos: ['hepatopatiaGrave'],
  avisos: ['embarazo'],
  estado: 'borrador',
} as const;

describe('ReglaDosis', () => {
  it('acepta una regla en borrador bien formada', () => {
    const r = ReglaDosis.parse(reglaFicticia);
    expect(r.presentacion.fraccionable).toBe(false);
  });

  it('un borrador nunca muestra la calculadora', () => {
    expect(puedeMostrarCalculadora(ReglaDosis.parse(reglaFicticia))).toBe(false);
  });

  it('una regla validada exige firma y fecha', () => {
    const sinFirma = { ...reglaFicticia, estado: 'validada' };
    expect(ReglaDosis.safeParse(sinFirma).success).toBe(false);

    const firmada = {
      ...reglaFicticia,
      estado: 'validada',
      fuente: {
        ...reglaFicticia.fuente,
        validadoPor: 'Farmacéutico de prueba',
        fecha: '2026-10-12',
      },
    };
    expect(puedeMostrarCalculadora(ReglaDosis.parse(firmada))).toBe(true);
  });

  it('rechaza tramos con edades invertidas', () => {
    const mal = {
      ...reglaFicticia,
      tramos: [{ ...reglaFicticia.tramos[0], edadMinMeses: 120, edadMaxMeses: 12 }],
    };
    expect(ReglaDosis.safeParse(mal).success).toBe(false);
  });

  it('rechaza unidades incoherentes', () => {
    const mal = {
      ...reglaFicticia,
      presentacion: { ...reglaFicticia.presentacion, unidadToma: 'comprimido' },
    };
    expect(ReglaDosis.safeParse(mal).success).toBe(false);
  });

  it('rechaza campos no previstos', () => {
    expect(ReglaDosis.safeParse({ ...reglaFicticia, marca: 'X' }).success).toBe(false);
  });
});
