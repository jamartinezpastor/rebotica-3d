import { ClasificacionConsulta } from '@rebotica/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  clasificadorDesdeEntorno,
  crearClasificadorClaude,
  ESQUEMA_CLASIFICACION,
  MODELO_INTERPRETACION,
} from '../src/interpretacion/claude';

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
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify(resultado) }],
    ...cambios,
  };
}
function crear(respuesta = new Response(JSON.stringify(mensaje()))) {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(respuesta);
  return {
    fetchImpl,
    clasificar: crearClasificadorClaude({ apiKey: 'CLAVE_FICTICIA', fetchImpl }),
  };
}

describe('cliente Claude con salida estructurada (transporte simulado)', () => {
  it('usa Messages, esquema estático cerrado y texto solo en el mensaje user', async () => {
    const { fetchImpl, clasificar } = crear();
    const texto = 'CANARIO_PRIVADO_FICTICIO';
    const signal = new AbortController().signal;
    expect(await clasificar(texto, signal)).toEqual(resultado);
    const [url, opciones] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(opciones).toMatchObject({
      method: 'POST',
      redirect: 'error',
      signal,
      headers: { 'x-api-key': 'CLAVE_FICTICIA', 'anthropic-version': '2023-06-01' },
    });
    const body = JSON.parse(opciones!.body as string);
    expect(body).toMatchObject({
      model: MODELO_INTERPRETACION,
      max_tokens: 2048,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: texto }],
      output_config: { format: { type: 'json_schema', schema: ESQUEMA_CLASIFICACION } },
    });
    expect(body.system).not.toContain(texto);
    expect(JSON.stringify(ESQUEMA_CLASIFICACION)).not.toContain(texto);
    expect(body).not.toHaveProperty('tools');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('mantiene todos los objetos cerrados y retira restricciones no soportadas por la API', () => {
    const revisar = (nodo: unknown) => {
      if (!nodo || typeof nodo !== 'object') return;
      const objeto = nodo as Record<string, unknown>;
      if (objeto.type === 'object') expect(objeto.additionalProperties).toBe(false);
      for (const clave of ['minimum', 'maximum', 'maxItems'])
        expect(objeto).not.toHaveProperty(clave);
      Object.values(objeto).forEach(revisar);
    };
    revisar(ESQUEMA_CLASIFICACION);
    expect(ClasificacionConsulta.safeParse({ ...resultado, confianza: 2 }).success).toBe(false);
  });
  it.each([
    mensaje({ stop_reason: 'refusal' }),
    mensaje({ stop_reason: 'max_tokens' }),
    mensaje({ stop_reason: 'model_context_window_exceeded' }),
    mensaje({ content: [{ type: 'text', text: 'CANARIO_PRIVADO_FICTICIO' }] }),
    mensaje({ content: [{ type: 'tool_use', name: 'recetar' }] }),
    mensaje({ content: [] }),
    mensaje({
      content: [{ type: 'text', text: JSON.stringify({ ...resultado, medicamento: 'prohibido' }) }],
    }),
    mensaje({
      content: [{ type: 'text', text: JSON.stringify({ ...resultado, protocoloId: 'inventado' }) }],
    }),
    mensaje({ content: [{ type: 'text', text: 'a'.repeat(17000) }] }),
  ])('rechaza refusals, truncamiento y salidas inválidas sin filtrar el error', async (body) => {
    const { clasificar } = crear(new Response(JSON.stringify(body)));
    await expect(clasificar('texto ficticio', new AbortController().signal)).rejects.toThrow(
      /^Clasificacion no disponible$/,
    );
  });
  it.each([400, 401, 429, 500, 529])(
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
    const clasificar = crearClasificadorClaude({ apiKey: 'CLAVE_FICTICIA', fetchImpl });
    await expect(clasificar('ficticio', new AbortController().signal)).rejects.toThrow(
      /^Clasificacion no disponible$/,
    );
  });
  it('requiere habilitación explícita, clave y modelo admitido', () => {
    expect(clasificadorDesdeEntorno({})).toBeUndefined();
    expect(clasificadorDesdeEntorno({ ANTHROPIC_API_KEY: 'CLAVE_FICTICIA' })).toBeUndefined();
    expect(clasificadorDesdeEntorno({ INTERPRETACION_IA_HABILITADA: 'true' })).toBeUndefined();
    expect(
      clasificadorDesdeEntorno({
        ANTHROPIC_API_KEY: 'CLAVE_FICTICIA',
        INTERPRETACION_IA_HABILITADA: 'true',
        ANTHROPIC_MODEL: 'modelo-sin-revisar',
      }),
    ).toBeUndefined();
    expect(
      clasificadorDesdeEntorno({
        ANTHROPIC_API_KEY: 'CLAVE_FICTICIA',
        INTERPRETACION_IA_HABILITADA: 'true',
      }),
    ).toBeTypeOf('function');
    expect(() =>
      crearClasificadorClaude({ apiKey: 'CLAVE_FICTICIA', modelo: 'modelo-sin-revisar' }),
    ).toThrow('Modelo no admitido');
  });
});
