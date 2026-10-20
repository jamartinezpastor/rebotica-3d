import { ClasificacionConsulta } from '@rebotica/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  clasificadorDesdeEntorno,
  crearClasificadorGemini,
  ESQUEMA_CLASIFICACION,
  MODELO_INTERPRETACION,
} from '../src/interpretacion/gemini';

const resultado = {
  protocoloId: 'tos',
  confianza: 0.95,
  alarmasDetectadas: [],
  datosExtraidos: {
    paraQuien: 'yo',
    grupo: 'adulto',
    edad: { valor: 30, unidad: 'anos' },
    duracion: { valor: 2, unidad: 'dias' },
  },
  necesitaAclarar: false,
  alternativas: [],
};
function mensaje(cambios: Record<string, unknown> = {}) {
  return {
    candidates: [candidato()],
    ...cambios,
  };
}
function candidato(cambios: Record<string, unknown> = {}) {
  return {
    finishReason: 'STOP',
    content: { role: 'model', parts: [{ text: JSON.stringify(resultado) }] },
    ...cambios,
  };
}
function salida(text: string) {
  return mensaje({ candidates: [candidato({ content: { role: 'model', parts: [{ text }] } })] });
}
function crear(respuesta = new Response(JSON.stringify(mensaje()))) {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(respuesta);
  return {
    fetchImpl,
    clasificar: crearClasificadorGemini({ apiKey: 'CLAVE_FICTICIA', fetchImpl }),
  };
}

describe('cliente Gemini con salida estructurada (transporte simulado)', () => {
  it('usa generateContent, esquema cerrado y clave solo en cabecera del servidor', async () => {
    const { fetchImpl, clasificar } = crear();
    const texto = 'CANARIO_PRIVADO_FICTICIO';
    const signal = new AbortController().signal;
    expect(await clasificar(texto, signal)).toEqual(resultado);
    const [url, opciones] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_INTERPRETACION}:generateContent`,
    );
    expect(String(url)).not.toContain('CLAVE_FICTICIA');
    expect(String(url)).not.toContain('?');
    expect(opciones).toMatchObject({
      method: 'POST',
      redirect: 'error',
      signal,
      headers: { 'x-goog-api-key': 'CLAVE_FICTICIA' },
    });
    const body = JSON.parse(opciones!.body as string);
    expect(body).toMatchObject({
      contents: [{ role: 'user', parts: [{ text: texto }] }],
      generationConfig: {
        candidateCount: 1,
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingLevel: 'LOW', includeThoughts: false },
        responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: ESQUEMA_CLASIFICACION } },
      },
    });
    expect(JSON.stringify(body.systemInstruction)).not.toContain(texto);
    expect(JSON.stringify(body)).not.toContain('CLAVE_FICTICIA');
    expect(JSON.stringify(ESQUEMA_CLASIFICACION)).not.toContain(texto);
    expect(body).not.toHaveProperty('tools');
    expect(body).not.toHaveProperty('cachedContent');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('mantiene los objetos cerrados y los límites numéricos y de arrays admitidos por Gemini', () => {
    const revisar = (nodo: unknown) => {
      if (!nodo || typeof nodo !== 'object') return;
      const objeto = nodo as Record<string, unknown>;
      if (objeto.type === 'object') expect(objeto.additionalProperties).toBe(false);
      Object.values(objeto).forEach(revisar);
    };
    revisar(ESQUEMA_CLASIFICACION);
    expect(ESQUEMA_CLASIFICACION).not.toHaveProperty('$schema');
    expect(ESQUEMA_CLASIFICACION).toMatchObject({
      properties: { confianza: { minimum: 0, maximum: 1 }, alternativas: { maxItems: 3 } },
    });
    expect(ClasificacionConsulta.safeParse({ ...resultado, confianza: 2 }).success).toBe(false);
  });
  it.each([
    mensaje({ candidates: [candidato({ finishReason: 'SAFETY' })] }),
    mensaje({ candidates: [candidato({ finishReason: 'MAX_TOKENS' })] }),
    mensaje({ candidates: [candidato({ finishReason: 'RECITATION' })] }),
    mensaje({ candidates: [candidato({ finishReason: 'OTHER' })] }),
    mensaje({ candidates: [] }),
    mensaje({ candidates: [candidato(), candidato()] }),
    mensaje({ promptFeedback: { blockReason: 'SAFETY' } }),
    mensaje({ promptFeedback: { safetyRatings: [{ blocked: true }] } }),
    mensaje({ candidates: [candidato({ safetyRatings: [{ blocked: true }] })] }),
    mensaje({
      candidates: [
        candidato({
          content: {
            role: 'model',
            parts: [{ text: JSON.stringify(resultado), functionCall: { name: 'recetar' } }],
          },
        }),
      ],
    }),
    mensaje({
      candidates: [
        candidato({
          content: { role: 'model', parts: [{ text: JSON.stringify(resultado), thought: true }] },
        }),
      ],
    }),
    salida('CANARIO_PRIVADO_FICTICIO'),
    salida(JSON.stringify({ ...resultado, medicamento: 'prohibido' })),
    salida(JSON.stringify({ ...resultado, protocoloId: 'inventado' })),
    salida(JSON.stringify({ ...resultado, confianza: 1.1 })),
    salida('a'.repeat(17000)),
  ])('rechaza bloqueos, truncamiento y salidas inválidas sin filtrar el error', async (body) => {
    const { clasificar } = crear(new Response(JSON.stringify(body)));
    await expect(clasificar('texto ficticio', new AbortController().signal)).rejects.toThrow(
      /^Clasificacion no disponible$/,
    );
  });
  it.each([400, 401, 403, 429, 500, 503])(
    'rechaza HTTP %s sin exponer el cuerpo ni reintentar',
    async (status) => {
      const { clasificar, fetchImpl } = crear(new Response('CANARIO_PRIVADO_FICTICIO', { status }));
      await expect(clasificar('ficticio', new AbortController().signal)).rejects.toThrow(
        /^Clasificacion no disponible$/,
      );
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );
  it('acota la respuesta y cancela el lector si supera el límite', async () => {
    const cancelar = vi.fn();
    const body = new ReadableStream({
      start: (controlador) => controlador.enqueue(new Uint8Array(65537)),
      cancel: cancelar,
    });
    const { clasificar } = crear(new Response(body));
    await expect(clasificar('ficticio', new AbortController().signal)).rejects.toThrow(
      /^Clasificacion no disponible$/,
    );
    expect(cancelar).toHaveBeenCalledTimes(1);
  });
  it('sanea fallos de transporte con texto privado en el error', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('CANARIO_PRIVADO_FICTICIO'));
    const clasificar = crearClasificadorGemini({ apiKey: 'CLAVE_FICTICIA', fetchImpl });
    await expect(clasificar('ficticio', new AbortController().signal)).rejects.toThrow(
      /^Clasificacion no disponible$/,
    );
  });
  it('requiere habilitación explícita, clave y modelo admitido', () => {
    expect(clasificadorDesdeEntorno({})).toBeUndefined();
    expect(clasificadorDesdeEntorno({ GEMINI_API_KEY: 'CLAVE_FICTICIA' })).toBeUndefined();
    expect(clasificadorDesdeEntorno({ INTERPRETACION_IA_HABILITADA: 'true' })).toBeUndefined();
    expect(
      clasificadorDesdeEntorno({
        GEMINI_API_KEY: 'CLAVE_FICTICIA',
        INTERPRETACION_IA_HABILITADA: 'true',
        GEMINI_MODEL: 'modelo-sin-revisar',
      }),
    ).toBeUndefined();
    expect(
      clasificadorDesdeEntorno({
        GEMINI_API_KEY: 'CLAVE_FICTICIA',
        INTERPRETACION_IA_HABILITADA: 'true',
      }),
    ).toBeTypeOf('function');
    expect(() =>
      crearClasificadorGemini({ apiKey: 'CLAVE_FICTICIA', modelo: 'modelo-sin-revisar' }),
    ).toThrow('Modelo no admitido');
  });
  it('une fragmentos de texto e ignora razonamiento sin tratarlo como JSON de salida', async () => {
    const json = JSON.stringify(resultado);
    const body = mensaje({
      candidates: [
        candidato({
          content: {
            role: 'model',
            parts: [
              {
                thought: true,
                text: 'CANARIO_PRIVADO_FICTICIO',
                thoughtSignature: 'firma-ficticia',
              },
              { text: json.slice(0, 40) },
              { text: json.slice(40) },
            ],
          },
        }),
      ],
    });
    const { clasificar } = crear(Response.json(body));
    expect(await clasificar('Consulta sintética', new AbortController().signal)).toEqual(resultado);
  });
  it('no activa el proveedor con las variables del proveedor anterior ni con un modelo que inyecta una URL', () => {
    expect(
      clasificadorDesdeEntorno({
        INTERPRETACION_IA_HABILITADA: 'true',
        ANTHROPIC_API_KEY: 'CLAVE_FICTICIA',
      }),
    ).toBeUndefined();
    expect(
      clasificadorDesdeEntorno({
        INTERPRETACION_IA_HABILITADA: 'true',
        GEMINI_API_KEY: 'CLAVE_FICTICIA',
        GEMINI_MODEL: '../otro?key=CLAVE_FICTICIA',
      }),
    ).toBeUndefined();
  });
});
