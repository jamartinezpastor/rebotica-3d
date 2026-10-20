import { Writable } from 'node:stream';
import { ClasificacionConsulta, InterpretarRespuesta } from '@rebotica/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app';
import { derivar, detectarAlarmas } from '../src/interpretacion/alarmas';
import { interpretar } from '../src/interpretacion/interpretar';
import { CASOS_CONSULTA } from './fixtures/consultas';

export const CLASIFICACION_FICTICIA = {
  protocoloId: 'tos',
  confianza: 0.95,
  alarmasDetectadas: [],
  datosExtraidos: { paraQuien: 'desconocido', grupo: null, edad: null, duracion: null },
  necesitaAclarar: false,
  alternativas: [],
} as const;
const signal = () => new AbortController().signal;
const aplicaciones: ReturnType<typeof buildApp>[] = [];
function crear(opciones: Parameters<typeof buildApp>[0] = {}) {
  const app = buildApp(opciones);
  aplicaciones.push(app);
  return app;
}
afterEach(async () => {
  await Promise.all(aplicaciones.splice(0).map((app) => app.close()));
});

describe('F4-02 corpus de 100 frases: primer filtro determinista', () => {
  it('mantiene 100 casos distintos y 60 derivaciones esperadas', () => {
    expect(CASOS_CONSULTA).toHaveLength(100);
    expect(new Set(CASOS_CONSULTA.map((c) => c.texto)).size).toBe(100);
    expect(CASOS_CONSULTA.filter((c) => c.destino)).toHaveLength(60);
  });
  it.each(CASOS_CONSULTA)(
    '$id: deriva o deja pasar al clasificador según la expectativa',
    async (caso) => {
      // No simula una evaluación de Gemini: comprueba que las alarmas NO llegan al modelo,
      // y que el filtro no transforma las otras frases en una clasificación clínica.
      const clasificar = vi.fn().mockRejectedValue(new Error('Proveedor deliberadamente caído'));
      const app = crear({ interpretacion: { clasificar } });
      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/interpretar',
        payload: { texto: caso.texto },
      });
      if (caso.destino) {
        expect(respuesta.statusCode).toBe(200);
        expect(InterpretarRespuesta.parse(respuesta.json())).toMatchObject({
          tipo: 'derivacion',
          destino: caso.destino,
        });
        expect(clasificar).not.toHaveBeenCalled();
      } else {
        expect(respuesta.statusCode).toBe(503);
        expect(clasificar).toHaveBeenCalledExactlyOnceWith(caso.texto, expect.any(AbortSignal));
      }
    },
  );
});

describe('interpretación cerrada y prioridad de alarmas', () => {
  it('no depende de la base de datos ni del proveedor para derivar', async () => {
    const app = crear();
    const r = await app.inject({
      method: 'POST',
      url: '/api/interpretar',
      payload: { texto: 'No puedo respirar' },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ tipo: 'derivacion', destino: '112' });
    expect(r.headers['cache-control']).toBe('no-store');
  });
  it('devuelve clasificación sin medicamentos, texto libre ni entrada original', async () => {
    const clasificar = vi.fn().mockResolvedValue(CLASIFICACION_FICTICIA);
    const app = crear({ interpretacion: { clasificar } });
    const r = await app.inject({
      method: 'POST',
      url: '/api/interpretar',
      payload: { texto: '  tos leve  ' },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({
      tipo: 'clasificacion',
      protocoloId: 'tos',
      confianza: 0.95,
      datosExtraidos: CLASIFICACION_FICTICIA.datosExtraidos,
    });
    expect(clasificar).toHaveBeenCalledWith('tos leve', expect.any(AbortSignal));
  });
  it('una alarma del modelo prevalece incluso con confianza alta o protocolo contradictorio', async () => {
    const r = await interpretar(
      'Consulta sintética',
      async () => ({ ...CLASIFICACION_FICTICIA, alarmasDetectadas: ['otra-urgencia'] }),
      signal(),
    );
    expect(r).toEqual({ tipo: 'derivacion', destino: '112', alarmasDetectadas: ['otra-urgencia'] });
  });
  it('fiebre y grupo bebé extraídos fuerzan derivación aunque el modelo omita la alarma', async () => {
    const r = await interpretar(
      'Consulta sintética',
      async () => ({
        ...CLASIFICACION_FICTICIA,
        protocoloId: 'fiebre',
        datosExtraidos: { ...CLASIFICACION_FICTICIA.datosExtraidos, grupo: 'bebe' },
      }),
      signal(),
    );
    expect(r).toMatchObject({
      tipo: 'derivacion',
      destino: 'urgencias',
      alarmasDetectadas: ['fiebre-bebe'],
    });
  });
  it('varias alternativas contradictorias fuerzan aclaración incluso con confianza alta', async () => {
    const r = await interpretar(
      'Consulta sintética',
      async () => ({ ...CLASIFICACION_FICTICIA, alternativas: ['acidez', 'tos'] }),
      signal(),
    );
    expect(r).toMatchObject({ tipo: 'aclaracion', alternativas: ['tos', 'acidez'] });
  });
  it('la máxima urgencia prevalece sobre otras alarmas y elimina duplicados', () => {
    expect(derivar(['sangrado', 'conducta-suicida', 'convulsion', 'sangrado'])).toEqual({
      tipo: 'derivacion',
      destino: '112',
      alarmasDetectadas: ['sangrado', 'conducta-suicida', 'convulsion'],
    });
    expect(derivar(['valoracion-medica'])?.destino).toBe('medico');
    expect(derivar([])).toBeNull();
  });
  it.each([{ confianza: 0.79 }, { necesitaAclarar: true }, { protocoloId: null }])(
    'solicita aclaración con resultado incierto: %j',
    async (cambio) => {
      const r = await interpretar(
        'Consulta sintética',
        async () => ({
          ...CLASIFICACION_FICTICIA,
          ...cambio,
          alternativas: ['tos', 'resfriado-congestion', 'tos'],
        }),
        signal(),
      );
      expect(r.tipo).toBe('aclaracion');
      if (r.tipo === 'aclaracion') expect(r.alternativas).toEqual(['tos', 'resfriado-congestion']);
      expect(r).not.toHaveProperty('protocoloId');
    },
  );
  it.each([
    { protocoloId: 'medicamento-inventado' },
    { confianza: 1.1 },
    { confianza: -0.1 },
    { dosis: 'valor prohibido' },
    { consejo: 'texto no permitido' },
    { alarmasDetectadas: ['no-pasa-nada'] },
    {
      datosExtraidos: { ...CLASIFICACION_FICTICIA.datosExtraidos, nombre: 'dato privado ficticio' },
    },
    {
      datosExtraidos: {
        ...CLASIFICACION_FICTICIA.datosExtraidos,
        edad: { valor: -2, unidad: 'anos' },
      },
    },
  ])('rechaza salidas fuera del contrato: %j', async (cambio) => {
    await expect(
      interpretar(
        'Consulta sintética',
        async () => ({ ...CLASIFICACION_FICTICIA, ...cambio }),
        signal(),
      ),
    ).rejects.toThrow();
  });
  it('no interpreta una duración de fiebre como edad de un lactante', () => {
    expect(detectarAlarmas('Tengo fiebre desde hace dos días')).toEqual([]);
    expect(detectarAlarmas('Mi niño de dos meses tiene fiebre')).toContain('fiebre-bebe');
  });
  it('el esquema original conserva restricciones omitidas en el esquema del proveedor', () => {
    expect(
      ClasificacionConsulta.safeParse({
        ...CLASIFICACION_FICTICIA,
        alternativas: Array(4).fill('tos'),
      }).success,
    ).toBe(false);
  });
});

describe('HTTP, disponibilidad y privacidad', () => {
  it.each([
    {},
    { texto: '' },
    { texto: ' ' },
    { texto: 'a'.repeat(2001) },
    { texto: 'tos', dosis: 1 },
    { texto: 42 },
    null,
  ])('rechaza entrada inválida sin enviar nada al proveedor', async (payload) => {
    const clasificar = vi.fn();
    const app = crear({ interpretacion: { clasificar } });
    const r = await app.inject({
      method: 'POST',
      url: '/api/interpretar',
      payload: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
    });
    expect(r.statusCode).toBe(400);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(clasificar).not.toHaveBeenCalled();
  });
  it('sin configuración devuelve 503 y nunca un pasillo por defecto', async () => {
    const app = crear();
    const r = await app.inject({
      method: 'POST',
      url: '/api/interpretar',
      payload: { texto: 'Tos leve' },
    });
    expect(r.statusCode).toBe(503);
    expect(r.json()).toEqual({ error: 'Interpretación no disponible', codigo: 'NO_DISPONIBLE' });
  });
  it('corta el tiempo de espera y aborta el transporte', async () => {
    let signalProveedor: AbortSignal | undefined;
    const app = crear({
      interpretacion: {
        plazoMs: 10,
        clasificar: (_texto, senal) => {
          signalProveedor = senal;
          return new Promise(() => {});
        },
      },
    });
    const r = await app.inject({
      method: 'POST',
      url: '/api/interpretar',
      payload: { texto: 'Tos' },
    });
    expect(r.statusCode).toBe(503);
    expect(signalProveedor?.aborted).toBe(true);
  });
  it('limita la concurrencia del proveedor sin bloquear alarmas y libera el hueco', async () => {
    let terminar!: (r: unknown) => void;
    const clasificar = vi.fn(
      () =>
        new Promise((resolve) => {
          terminar = resolve;
        }),
    );
    const app = crear({ interpretacion: { clasificar, maxEnCurso: 1 } });
    const primera = app
      .inject({ method: 'POST', url: '/api/interpretar', payload: { texto: 'Tos' } })
      .then((r) => r);
    await vi.waitFor(() => expect(clasificar).toHaveBeenCalledTimes(1));
    const segunda = await app.inject({
      method: 'POST',
      url: '/api/interpretar',
      payload: { texto: 'Tos leve' },
    });
    expect(segunda.statusCode).toBe(429);
    const alarma = await app.inject({
      method: 'POST',
      url: '/api/interpretar',
      payload: { texto: 'Dolor en el pecho' },
    });
    expect(alarma.json().tipo).toBe('derivacion');
    terminar(CLASIFICACION_FICTICIA);
    expect((await primera).statusCode).toBe(200);
    clasificar.mockResolvedValue(CLASIFICACION_FICTICIA);
    expect(
      (await app.inject({ method: 'POST', url: '/api/interpretar', payload: { texto: 'Tos' } }))
        .statusCode,
    ).toBe(200);
  });
  it('no registra cuerpo, query, claves, errores de parseo ni errores del proveedor', async () => {
    const registros: string[] = [];
    const stream = new Writable({
      write: (chunk, _encoding, done) => {
        registros.push(String(chunk));
        done();
      },
    });
    const secreto = 'CANARIO_PRIVADO_FICTICIO';
    const app = crear({
      fastify: { logger: { level: 'trace', stream } },
      interpretacion: {
        clasificar: async () => {
          throw new Error(secreto);
        },
      },
    });
    const peticiones = [
      { payload: { texto: secreto }, url: '/api/interpretar' },
      { payload: { texto: secreto }, url: `/api/interpretar?texto=${secreto}` },
      { payload: `{"texto":"${secreto}`, url: '/api/interpretar' },
      { payload: secreto.repeat(2000), url: '/api/interpretar' },
    ];
    for (const peticion of peticiones) {
      const r = await app.inject({
        method: 'POST',
        ...peticion,
        headers: { 'content-type': 'application/json', 'x-api-key': secreto },
      });
      expect(r.headers['cache-control']).toBe('no-store');
      expect(r.body).not.toContain(secreto);
      expect(r.statusCode).toBeGreaterThanOrEqual(400);
    }
    const metodoIncorrecto = await app.inject({
      method: 'GET',
      url: `/api/interpretar?texto=${secreto}`,
    });
    expect(metodoIncorrecto.statusCode).toBe(405);
    expect(metodoIncorrecto.headers['cache-control']).toBe('no-store');
    // Verifica que el capturador sí funciona: otras rutas siguen teniendo registros operativos.
    await app.inject({ method: 'GET', url: '/api/health' });
    expect(registros.join('')).toContain('/api/health');
    expect(registros.join('')).not.toContain(secreto);
  });
});
