import { describe, expect, it } from 'vitest';
import { Protocolo, evaluarTriaje } from '../src/index';
import { protocoloTriajeFicticio, respuestasFicticias } from './fixtures';

describe('motor determinista F4-03 (solo umbrales ficticios)', () => {
  it('no confunde claves del prototipo de JavaScript con respuestas confirmadas', () => {
    const p = protocoloTriajeFicticio();
    p.preguntasTriaje.push({ id: 'constructor', tipo: 'siNo', texto: 'Otra pregunta ficticia' });
    expect(evaluarTriaje(p, respuestasFicticias)).toEqual({
      tipo: 'preguntas',
      pendientes: ['constructor'],
    });
  });
  it('una respuesta ausente no es negativa y nunca abre un pasillo', () => {
    expect(evaluarTriaje(protocoloTriajeFicticio(), {})).toEqual({
      tipo: 'preguntas',
      pendientes: ['alarma', 'grupo', 'edad', 'duracion', 'ulcera'],
    });
  });
  it('deriva inmediatamente con alarma aunque falten todas las otras respuestas', () => {
    expect(evaluarTriaje(protocoloTriajeFicticio(), { alarma: true })).toMatchObject({
      tipo: 'derivar',
      urgencia: '112',
      motivos: [{ id: 'alarma-prueba' }],
    });
  });
  it('elige la mayor urgencia y conserva todos los motivos sin productos', () => {
    const r = evaluarTriaje(protocoloTriajeFicticio(), {
      ...respuestasFicticias,
      alarma: true,
      edad: 2,
      duracion: 30,
    });
    expect(r).toMatchObject({ tipo: 'derivar', urgencia: '112' });
    if (r.tipo === 'derivar')
      expect(r.motivos.map((m) => m.urgencia)).toEqual(['112', 'urgencias', 'medico']);
    expect(r).not.toHaveProperty('perfil');
    expect(r).not.toHaveProperty('pasillo');
  });
  it.each([
    [{ edad: 6.99 }, 'derivar'],
    [{ edad: 7 }, 'apto'],
    [{ edad: 7.01 }, 'apto'],
    [{ duracion: 12.99 }, 'apto'],
    [{ duracion: 13 }, 'derivar'],
    [{ duracion: 13.01 }, 'derivar'],
  ])('respeta los límites del criterio firmado: %j', (cambio, tipo) => {
    expect(
      evaluarTriaje(protocoloTriajeFicticio(), { ...respuestasFicticias, ...cambio }).tipo,
    ).toBe(tipo);
  });
  it('solo declara apto tras responder todo y conserva las restricciones confirmadas', () => {
    const r = evaluarTriaje(protocoloTriajeFicticio(), { ...respuestasFicticias, ulcera: true });
    expect(r).toEqual({
      tipo: 'apto',
      perfil: { grupo: 'adulto', edadMeses: 100, condiciones: ['ulcera'] },
    });
    expect(evaluarTriaje(protocoloTriajeFicticio(), respuestasFicticias)).toEqual(
      evaluarTriaje(protocoloTriajeFicticio(), respuestasFicticias),
    );
  });
  it.each([
    { edad: '100' },
    { alarma: 'false' },
    { edad: -1 },
    { duracion: Infinity },
    { grupo: 'inventado' },
    { edad: 1561 },
    { duracion: 876001 },
    { extra: true },
  ])('rechaza respuestas inválidas sin coerción: %j', (cambio) => {
    expect(evaluarTriaje(protocoloTriajeFicticio(), { ...respuestasFicticias, ...cambio })).toEqual(
      { tipo: 'no-disponible', motivo: 'respuestas' },
    );
  });
  it('un borrador, una firma ausente, fecha futura o criterio no ejecutable bloquean', () => {
    const p = protocoloTriajeFicticio();
    for (const cambio of [
      { estado: 'borrador' },
      { validadoPor: null },
      { validadoEn: '2999-01-01' },
      { criteriosDerivacion: p.criteriosDerivacion.map(({ cuando: _cuando, ...c }) => c) },
    ])
      expect(evaluarTriaje({ ...p, ...cambio }, respuestasFicticias)).toEqual({
        tipo: 'no-disponible',
        motivo: 'protocolo',
      });
  });
  it('una restricción de balda sin pregunta de confirmación impide autorizar un pasillo', () => {
    const p = protocoloTriajeFicticio();
    p.baldas[0]!.condicionesExcluidas.push('condicion-no-preguntada');
    expect(evaluarTriaje(p, respuestasFicticias)).toEqual({
      tipo: 'no-disponible',
      motivo: 'protocolo',
    });
  });
  it('evalúa todas/alguna con tres valores sin dar por conocidas respuestas ausentes', () => {
    const p = protocoloTriajeFicticio();
    p.criteriosDerivacion = [
      {
        ...p.criteriosDerivacion[0]!,
        cuando: {
          alguna: [
            { preguntaId: 'alarma', operador: 'igual', valor: true },
            { preguntaId: 'ulcera', operador: 'igual', valor: true },
          ],
        },
      },
    ];
    expect(evaluarTriaje(p, { ulcera: true }).tipo).toBe('derivar');
    expect(evaluarTriaje(p, { ulcera: false }).tipo).toBe('preguntas');
    p.criteriosDerivacion[0]!.cuando = {
      todas: [
        { preguntaId: 'alarma', operador: 'igual', valor: true },
        { preguntaId: 'ulcera', operador: 'igual', valor: true },
      ],
    };
    expect(evaluarTriaje(p, { ulcera: true }).tipo).toBe('preguntas');
    expect(evaluarTriaje(p, { alarma: true, ulcera: true }).tipo).toBe('derivar');
  });
  it.each(['menorIgual', 'mayor'] as const)('evalúa también el operador %s', (operador) => {
    const p = protocoloTriajeFicticio();
    p.criteriosDerivacion = [
      {
        ...p.criteriosDerivacion[0]!,
        cuando: { todas: [{ preguntaId: 'edad', operador, valor: 100 }] },
      },
    ];
    expect(evaluarTriaje(p, respuestasFicticias).tipo).toBe(
      operador === 'menorIgual' ? 'derivar' : 'apto',
    );
  });
  it('rechaza criterios con referencias inexistentes, tipos incompatibles o ids duplicados', () => {
    const p = protocoloTriajeFicticio();
    for (const condicion of [
      { preguntaId: 'inventada', operador: 'igual', valor: true },
      { preguntaId: 'grupo', operador: 'mayor', valor: 10 },
      { preguntaId: 'alarma', operador: 'igual', valor: 'false' },
    ])
      expect(
        Protocolo.safeParse({
          ...p,
          criteriosDerivacion: [{ ...p.criteriosDerivacion[0], cuando: { todas: [condicion] } }],
        }).success,
      ).toBe(false);
    expect(
      Protocolo.safeParse({ ...p, preguntasTriaje: [...p.preguntasTriaje, p.preguntasTriaje[0]] })
        .success,
    ).toBe(false);
  });
  it('las opciones tienen valores cerrados y no aceptan selecciones desconocidas', () => {
    const p = protocoloTriajeFicticio();
    p.preguntasTriaje.push({
      id: 'opcion',
      tipo: 'opciones',
      texto: 'Pregunta ficticia',
      opciones: [
        { valor: 'a', etiqueta: 'A' },
        { valor: 'b', etiqueta: 'B' },
      ],
    });
    expect(evaluarTriaje(p, { ...respuestasFicticias, opcion: 'c' })).toEqual({
      tipo: 'no-disponible',
      motivo: 'respuestas',
    });
    expect(evaluarTriaje(p, { ...respuestasFicticias, opcion: 'a' }).tipo).toBe('apto');
  });
});
