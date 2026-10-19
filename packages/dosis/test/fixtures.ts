import { ReglaDosis, type EntradaDosis } from '../src';

/** FICTICIO: casos dorados aritméticos, sin correspondencia con medicamentos o pautas reales. */
export const reglaFicticia = (): ReglaDosis =>
  ReglaDosis.parse({
    id: 'regla-ficticia-solo-tests',
    version: 1,
    estado: 'validada',
    fuente: {
      nregistro: 'FICTICIO',
      seccion: '4.2',
      hashSeccion: 'hash-ficticio',
      validadoPor: 'Firma ficticia de prueba',
      fecha: '2026-01-01',
      cita: 'Posología ficticia para tests.',
    },
    presentacion: { concentracion: 10, unidad: 'mg/ml', unidadToma: 'ml', pasoDosificable: 0.5 },
    tramos: [
      {
        modo: 'porPeso',
        edadMinMeses: 12,
        edadMaxMeses: 120,
        pesoMinKg: 5,
        pesoMaxKg: 80,
        mgKgToma: 2,
        intervaloHoras: 8,
        maxMgKgDia: 6,
        maxMgToma: 90,
        maxMgDia: 240,
      },
    ],
    diasMaxSinConsultar: { prueba: 2 },
    bloqueos: ['hepatopatiaGrave'],
    avisos: ['embarazo'],
  });

export const entradaFicticia = (extra: Partial<EntradaDosis> = {}): EntradaDosis => ({
  edadMeses: 48,
  pesoKg: 20,
  condiciones: [],
  motivo: 'prueba',
  pesoConfirmado: true,
  fuenteActual: {
    nregistro: 'FICTICIO',
    hashSeccion: 'hash-ficticio',
    texto: 'Posología ficticia para tests.',
  },
  ...extra,
});

export const reglaFijaFicticia = (): ReglaDosis => ({
  ...reglaFicticia(),
  presentacion: {
    concentracion: 40,
    unidad: 'mg/unidad',
    unidadToma: 'comprimido',
    pasoDosificable: 1,
    fraccionable: false,
  },
  tramos: [
    {
      modo: 'fija',
      edadMinMeses: 120,
      pesoMinKg: 10,
      mgToma: 90,
      intervaloHoras: 7,
      maxMgDia: 200,
      maxMgKgDia: 20,
      maxMgToma: 85,
    },
  ],
});
