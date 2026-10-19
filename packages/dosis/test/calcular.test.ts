import { describe, expect, it } from 'vitest';
import { calcularDosis, type ReglaDosis } from '../src';
import { entradaFicticia, reglaFicticia, reglaFijaFicticia } from './fixtures';

describe('calcularDosis: casos dorados FICTICIOS', () => {
  it('calcula por peso, convierte a ml y devuelve límites, duración, avisos y fuente', () => {
    expect(
      calcularDosis(reglaFicticia(), entradaFicticia({ condiciones: ['embarazo'] })),
    ).toMatchObject({
      tipo: 'calculada',
      cantidadToma: 4,
      unidadToma: 'ml',
      mgToma: 40,
      intervaloHoras: 8,
      maxTomasDia: 3,
      maxMgDia: 120,
      diasMaxSinConsultar: 2,
      avisos: ['embarazo'],
      trazabilidad: {
        reglaId: 'regla-ficticia-solo-tests',
        version: 1,
        fuente: { cita: 'Posología ficticia para tests.', hashSeccion: 'hash-ficticio' },
      },
    });
  });

  it('recorta al máximo por toma y después al máximo diario absoluto', () => {
    expect(calcularDosis(reglaFicticia(), entradaFicticia({ pesoKg: 60 }))).toMatchObject({
      tipo: 'calculada',
      cantidadToma: 9,
      mgToma: 90,
      maxTomasDia: 2,
      maxMgDia: 240,
    });
  });

  it('redondea siempre hacia abajo al paso medible', () => {
    expect(calcularDosis(reglaFicticia(), entradaFicticia({ pesoKg: 21 }))).toMatchObject({
      tipo: 'calculada',
      cantidadToma: 4,
      mgToma: 40,
    });
  });

  it('resuelve dosis fija sin fraccionar y respeta simultáneamente los límites diarios', () => {
    expect(calcularDosis(reglaFijaFicticia(), entradaFicticia({ edadMeses: 180 }))).toMatchObject({
      tipo: 'calculada',
      cantidadToma: 2,
      unidadToma: 'comprimido',
      mgToma: 80,
      intervaloHoras: 7,
      maxTomasDia: 2,
      maxMgDia: 200,
    });
  });

  it('solo permite medio comprimido si la regla lo declara fraccionable', () => {
    const regla = reglaFijaFicticia();
    regla.presentacion = { ...regla.presentacion, fraccionable: true, pasoDosificable: 0.5 };
    regla.tramos = [
      { modo: 'fija', edadMinMeses: 0, mgToma: 60, maxMgDia: 180, intervaloHoras: 8 },
    ];
    expect(calcularDosis(regla, entradaFicticia())).toMatchObject({
      tipo: 'calculada',
      cantidadToma: 1.5,
    });
    regla.presentacion.fraccionable = false;
    expect(calcularDosis(regla, entradaFicticia())).toEqual({
      tipo: 'noDisponible',
      motivo: 'reglaInvalida',
    });
  });

  it.each(['capsula', 'supositorio'] as const)('no permite fraccionar %s', (unidadToma) => {
    const regla = reglaFijaFicticia();
    regla.presentacion = {
      ...regla.presentacion,
      unidadToma,
      fraccionable: true,
      pasoDosificable: 0.5,
    };
    expect(calcularDosis(regla, entradaFicticia())).toMatchObject({ tipo: 'noDisponible' });
  });

  it('cuenta las posibles tomas en una ventana de 24 h cuando el intervalo no divide 24', () => {
    const regla = reglaFijaFicticia();
    regla.tramos = [
      { modo: 'fija', edadMinMeses: 0, mgToma: 40, maxMgDia: 1000, intervaloHoras: 7 },
    ];
    expect(calcularDosis(regla, entradaFicticia())).toMatchObject({
      tipo: 'calculada',
      maxTomasDia: 4,
    });
    regla.tramos[0]!.intervaloHoras = 48;
    expect(calcularDosis(regla, entradaFicticia())).toMatchObject({
      tipo: 'calculada',
      maxTomasDia: 1,
    });
  });

  it('mantiene un paso decimal exacto sin perder una unidad por coma flotante', () => {
    const regla = reglaFicticia();
    regla.presentacion = { ...regla.presentacion, concentracion: 1, pasoDosificable: 0.1 };
    regla.tramos = [
      { modo: 'fija', edadMinMeses: 0, mgToma: 0.3, maxMgDia: 0.9, intervaloHoras: 8 },
    ];
    expect(calcularDosis(regla, entradaFicticia())).toMatchObject({
      tipo: 'calculada',
      cantidadToma: 0.3,
      maxTomasDia: 3,
    });
  });

  it('no aplica épsilon que pudiera superar un límite cercano al paso', () => {
    const regla = reglaFicticia();
    regla.presentacion = { ...regla.presentacion, concentracion: 1, pasoDosificable: 0.1 };
    regla.tramos = [
      {
        modo: 'fija',
        edadMinMeses: 0,
        mgToma: 0.29999999999999993,
        maxMgDia: 0.9,
        intervaloHoras: 8,
      },
    ];
    expect(calcularDosis(regla, entradaFicticia())).toMatchObject({
      tipo: 'calculada',
      cantidadToma: 0.2,
    });
  });
});

describe('calcularDosis: sin pauta ante errores, bloqueos o falta de trazabilidad', () => {
  it.each(['borrador', 'revisar'] as const)('no calcula con regla %s', (estado) => {
    expect(calcularDosis({ ...reglaFicticia(), estado }, entradaFicticia())).toEqual({
      tipo: 'noDisponible',
      motivo: 'sinValidar',
    });
  });

  it('no calcula sin firma, con solapamientos ni con datos de entrada inválidos', () => {
    const regla = reglaFicticia();
    expect(
      calcularDosis(
        { ...regla, fuente: { ...regla.fuente, validadoPor: null } },
        entradaFicticia(),
      ),
    ).toMatchObject({ tipo: 'noDisponible' });
    expect(
      calcularDosis({ ...regla, tramos: [...regla.tramos, ...regla.tramos] }, entradaFicticia()),
    ).toMatchObject({ tipo: 'noDisponible' });
    for (const extra of [
      { pesoKg: 0 },
      { pesoKg: NaN },
      { pesoKg: Infinity },
      { edadMeses: -1 },
      { edadMeses: 1.5 },
      { condiciones: ['desconocida'] },
    ]) {
      expect(calcularDosis(regla, { ...entradaFicticia(), ...extra })).toMatchObject({
        tipo: 'noDisponible',
      });
    }
    expect(calcularDosis(null, null)).toMatchObject({ tipo: 'noDisponible' });
  });

  it.each([{ edadMeses: 11 }, { edadMeses: 120 }, { pesoKg: 4 }, { pesoKg: 80 }])(
    'deriva fuera del tramo: %j',
    (extra) => {
      expect(calcularDosis(reglaFicticia(), entradaFicticia(extra))).toMatchObject({
        tipo: 'derivar',
        motivo: 'fueraTramo',
      });
    },
  );

  it('deriva ante bloqueo, incluso antes de pedir confirmación de un peso fuera de referencia', () => {
    const resultado = calcularDosis(
      reglaFicticia(),
      entradaFicticia({ condiciones: ['hepatopatiaGrave'], pesoKg: 79, pesoConfirmado: false }),
    );
    expect(resultado).toMatchObject({
      tipo: 'derivar',
      motivo: 'bloqueo',
      condiciones: ['hepatopatiaGrave'],
    });
    expect(resultado).not.toHaveProperty('mgToma');
  });

  it.each(['nregistro', 'hashSeccion'] as const)(
    'rechaza una fuente actual con %s diferente',
    (campo) => {
      const entrada = entradaFicticia();
      entrada.fuenteActual[campo] = 'diferente';
      expect(calcularDosis(reglaFicticia(), entrada)).toEqual({
        tipo: 'noDisponible',
        motivo: 'fuenteDesactualizada',
      });
    },
  );

  it('necesita cita literal presente en la sección y duración para la consulta', () => {
    const regla = reglaFicticia();
    delete regla.fuente.cita;
    expect(calcularDosis(regla, entradaFicticia())).toEqual({
      tipo: 'noDisponible',
      motivo: 'sinCita',
    });
    expect(
      calcularDosis(
        reglaFicticia(),
        entradaFicticia({
          fuenteActual: { ...entradaFicticia().fuenteActual, texto: 'Otro texto.' },
        }),
      ),
    ).toMatchObject({ motivo: 'sinCita' });
    expect(
      calcularDosis(reglaFicticia(), entradaFicticia({ motivo: 'desconocido' })),
    ).toMatchObject({ motivo: 'sinDuracion' });
    expect(
      calcularDosis(reglaFicticia(), entradaFicticia({ motivo: 'constructor' })),
    ).toMatchObject({ motivo: 'sinDuracion' });
  });

  it('no devuelve dosis cero ni una toma que supere el tope diario', () => {
    const regla = reglaFicticia();
    regla.presentacion.pasoDosificable = 100;
    expect(calcularDosis(regla, entradaFicticia())).toMatchObject({
      motivo: 'cantidadNoDosificable',
    });
    const fija = reglaFijaFicticia();
    fija.tramos = [{ modo: 'fija', edadMinMeses: 0, mgToma: 40, maxMgDia: 30, intervaloHoras: 8 }];
    expect(calcularDosis(fija, entradaFicticia())).toMatchObject({ motivo: 'limiteDiario' });
  });

  it('pide confirmar un peso inusual o sin tabla y no entrega dosis hasta confirmarlo', () => {
    for (const entrada of [
      entradaFicticia({ pesoKg: 79, pesoConfirmado: false }),
      entradaFicticia({ edadMeses: 180, pesoConfirmado: false }),
    ]) {
      const regla: ReglaDosis = entrada.edadMeses === 180 ? reglaFijaFicticia() : reglaFicticia();
      const resultado = calcularDosis(regla, entrada);
      expect(resultado.tipo).toBe('confirmarPeso');
      expect(resultado).not.toHaveProperty('mgToma');
      expect(calcularDosis(regla, { ...entrada, pesoConfirmado: true }).tipo).toBe('calculada');
    }
  });

  it('no muta ni la regla ni los datos del paciente', () => {
    const regla = reglaFicticia();
    const entrada = entradaFicticia();
    const antes = JSON.stringify({ regla, entrada });
    calcularDosis(regla, entrada);
    expect(JSON.stringify({ regla, entrada })).toBe(antes);
  });

  it('no representa como válida una cantidad cuya precisión decimal se perdería al mostrarla', () => {
    const regla = reglaFicticia();
    regla.presentacion = {
      ...regla.presentacion,
      concentracion: 1.234567891234567,
      pasoDosificable: 0.1234567891234567,
    };
    regla.tramos = [{ modo: 'fija', edadMinMeses: 0, mgToma: 0.9, maxMgDia: 3, intervaloHoras: 8 }];
    expect(calcularDosis(regla, entradaFicticia())).toMatchObject({
      tipo: 'noDisponible',
      motivo: 'precisionNoSoportada',
    });
  });
});
