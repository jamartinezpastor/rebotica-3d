import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { ConsultaGuiada } from '../src/mostrador/ConsultaGuiada';
import { Derivacion } from '../src/mostrador/Derivacion';
import type * as ModuloCapacidad from '../src/escena/capacidad';

vi.mock('../src/escena/capacidad', async (importar) => ({
  ...(await importar<typeof ModuloCapacidad>()),
  detectarDispositivo: () => ({ webgl: false }),
}));
const protocolo = {
  id: 'tos',
  version: 1,
  titulo: 'Triaje ficticio',
  preguntas: [
    { id: 'alarma', tipo: 'siNo', texto: '¿Hay una alarma ficticia?' },
    { id: 'edad', tipo: 'edad', texto: '¿Qué edad tiene?' },
  ],
};
const pasillo = {
  id: 'tos',
  version: 1,
  estado: 'validado',
  titulo: 'Pasillo ficticio',
  baldas: [],
  vitrina: [],
  ocultasPorPerfil: 0,
  consejos: [],
  parafarmacia: [],
};
const clasificacion = {
  tipo: 'clasificacion',
  protocoloId: 'tos',
  confianza: 0.95,
  datosExtraidos: {
    paraQuien: 'yo',
    grupo: 'adulto',
    edad: { valor: 99, unidad: 'anos' },
    duracion: null,
  },
};
const derivacion = {
  tipo: 'derivacion',
  destino: '112',
  alarmasDetectadas: ['dificultad-respiratoria'],
};
let fetchSimulado: ReturnType<typeof vi.fn<typeof fetch>>;
function mostrar() {
  return render(<ConsultaGuiada onActiva={vi.fn()} onPasillo={vi.fn()} />);
}
function revisarTexto(texto = 'Consulta sintética privada') {
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Cuéntanos qué te pasa o elige una consulta frecuente' }),
    {
      target: { value: texto },
    },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Realizar consulta' }));
}
function continuar() {
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
}
async function iniciarChip() {
  fireEvent.click(screen.getByRole('button', { name: 'Ver más consultas' }));
  fireEvent.click(screen.getByRole('button', { name: 'Tos' }));
  fireEvent.click(screen.getByRole('button', { name: 'Realizar consulta' }));
  continuar();
  await screen.findByRole('heading', { name: '¿Hay una alarma ficticia?' });
}
beforeEach(() => {
  vi.stubGlobal('SpeechRecognition', undefined);
  vi.stubGlobal('webkitSpeechRecognition', undefined);
  fetchSimulado = vi.fn<typeof fetch>().mockImplementation(async (url, opciones) => {
    if (url === '/api/health')
      return Response.json({ status: 'ok', version: '0.1.0', time: new Date().toISOString() });
    if (url === '/api/interpretar') return Response.json(clasificacion);
    if (url === '/api/protocolos/tos') return Response.json(protocolo);
    if (url === '/api/triaje') {
      const body = JSON.parse(opciones!.body as string);
      if (body.respuestas.alarma === true)
        return Response.json({
          tipo: 'derivar',
          urgencia: '112',
          motivos: [{ id: 'alarma', descripcion: 'Alarma ficticia', urgencia: '112' }],
        });
      if (body.respuestas.edad === undefined)
        return Response.json({ tipo: 'preguntas', pendientes: ['edad'] });
      return Response.json({ tipo: 'recomendar', pasilloId: 'tos', version: 1, pasillo });
    }
    throw new Error('Petición inesperada');
  });
  vi.stubGlobal('fetch', fetchSimulado);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('mostrador, interpretación y triaje F4-03', () => {
  it('un servidor que no responde no mantiene la consulta esperando indefinidamente', () => {
    vi.useFakeTimers();
    fetchSimulado.mockImplementationOnce(() => new Promise(() => {}));
    mostrar();
    revisarTexto();
    continuar();
    act(() => vi.advanceTimersByTime(30000));
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(fetchSimulado.mock.calls[0]![1]!.signal!.aborted).toBe(true);
    expect(screen.queryByRole('button', { name: 'Ver el pasillo' })).toBeNull();
  });
  it('No lo sé deriva al farmacéutico en vez de asumir una respuesta negativa', async () => {
    mostrar();
    await iniciarChip();
    fireEvent.click(screen.getByRole('button', { name: 'No lo sé' }));
    await screen.findByRole('heading', { name: 'Consulta con un profesional' });
    expect(screen.getByText('Habla con tu farmacéutico antes de elegir un producto.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ver el pasillo' })).toBeNull();
  });
  it('envía texto solo tras revisión y Continuar; no usa los datos inferidos como respuestas', async () => {
    const guardar = vi.spyOn(Storage.prototype, 'setItem');
    const navegar = vi.spyOn(history, 'pushState');
    mostrar();
    revisarTexto();
    expect(fetchSimulado).not.toHaveBeenCalled();
    expect(screen.getByText(/Al pulsar Continuar se envía/)).toBeTruthy();
    continuar();
    await screen.findByRole('heading', { name: '¿Hay una alarma ficticia?' });
    expect(fetchSimulado.mock.calls[0]).toEqual([
      '/api/interpretar',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ texto: 'Consulta sintética privada' }),
        cache: 'no-store',
      }),
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    await screen.findByRole('spinbutton', { name: 'Edad en meses' });
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('');
    expect(JSON.parse(fetchSimulado.mock.calls[2]![1]!.body as string)).toEqual({
      protocoloId: 'tos',
      version: 1,
      respuestas: { alarma: false },
    });
    expect(guardar).not.toHaveBeenCalled();
    expect(navegar).not.toHaveBeenCalled();
  });
  it('los chips van al protocolo cerrado sin enviar texto ni necesitar al modelo', async () => {
    mostrar();
    await iniciarChip();
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
    expect(fetchSimulado.mock.calls[0]![0]).toBe('/api/protocolos/tos');
  });
  it('oculta la demostración desde la revisión y una alarma sustituye todo acceso a productos', async () => {
    fetchSimulado.mockImplementation(async (url) =>
      url === '/api/health'
        ? Response.json({ status: 'ok', version: '0.1.0', time: new Date().toISOString() })
        : Response.json(derivacion),
    );
    render(<App />);
    expect(screen.getByRole('link', { name: 'Ver medicamentos' })).toBeTruthy();
    revisarTexto('No puedo respirar. Caso sintético.');
    expect(screen.queryByRole('link', { name: /Explorar/ })).toBeNull();
    continuar();
    const titulo = await screen.findByRole('heading', { name: 'Necesitas atención urgente' });
    expect(document.activeElement).toBe(titulo);
    expect(screen.getByRole('link', { name: 'Llamar al 112' }).getAttribute('href')).toBe(
      'tel:112',
    );
    expect(screen.queryByText('Explora la demostración')).toBeNull();
    expect(fetchSimulado.mock.calls.some(([url]) => String(url).includes('pasillos'))).toBe(false);
  });
  it('muestra apoyo específico y emergencias para conducta suicida, también si hay otra alarma', () => {
    render(
      <Derivacion
        resultado={{
          tipo: 'derivacion',
          destino: '112',
          alarmasDetectadas: ['conducta-suicida', 'otra-urgencia'],
        }}
      />,
    );
    expect(screen.getByRole('link', { name: 'Llamar al 024' }).getAttribute('href')).toBe(
      'tel:024?oai_link_source=model_response_hotline',
    );
    expect(screen.getByRole('link', { name: 'Llamar al 112' })).toBeTruthy();
  });
  it('una respuesta de alarma deriva inmediatamente, sin pedir edad ni abrir el pasillo', async () => {
    mostrar();
    await iniciarChip();
    fireEvent.click(screen.getByRole('button', { name: 'Sí' }));
    await screen.findByRole('heading', { name: 'Necesitas atención urgente' });
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver el pasillo' })).toBeNull();
  });
  it('pide aclaración y solo carga el protocolo al elegir una alternativa', async () => {
    fetchSimulado.mockResolvedValueOnce(
      Response.json({
        tipo: 'aclaracion',
        confianza: 0.3,
        alternativas: ['tos', 'resfriado-congestion'],
        datosExtraidos: clasificacion.datosExtraidos,
      }),
    );
    mostrar();
    revisarTexto();
    continuar();
    await screen.findByRole('heading', { name: '¿Te refieres a…?' });
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Tos' }));
    await screen.findByRole('heading', { name: '¿Hay una alarma ficticia?' });
    expect(fetchSimulado.mock.calls[1]![0]).toBe('/api/protocolos/tos');
  });
  it('valida números vacíos y negativos y solo abre el pasillo filtrado entregado por POST', async () => {
    const guardar = vi.spyOn(Storage.prototype, 'setItem');
    render(<App />);
    await iniciarChip();
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    await screen.findByRole('spinbutton');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar respuesta' }));
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar respuesta' }));
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar respuesta' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ver el pasillo' }));
    await screen.findByRole('heading', { name: 'Pasillo ficticio' });
    expect(
      fetchSimulado.mock.calls.every(
        ([url]) => !String(url).includes('?') && !String(url).includes('/pasillos/'),
      ),
    ).toBe(true);
    expect(window.location.pathname).toBe('/');
    expect(guardar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Nueva consulta' }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
  });
  it('aborta Nueva consulta e ignora una respuesta tardía aunque el transporte no aborte', async () => {
    let resolver!: (r: Response) => void;
    fetchSimulado.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolver = resolve;
        }),
    );
    mostrar();
    revisarTexto();
    continuar();
    const signal = fetchSimulado.mock.calls[0]![1]!.signal!;
    fireEvent.click(screen.getByRole('button', { name: 'Nueva consulta' }));
    expect(signal.aborted).toBe(true);
    await act(async () => resolver(Response.json(derivacion)));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
    expect(screen.queryByRole('link', { name: 'Llamar al 112' })).toBeNull();
  });
  it('borra respuestas y datos de la consulta al salir y volver de BFCache', async () => {
    mostrar();
    await iniciarChip();
    act(() => window.dispatchEvent(new Event('pagehide')));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
    const e = new Event('pageshow');
    Object.assign(e, { persisted: true });
    act(() => window.dispatchEvent(e));
    expect(screen.queryByText('Triaje ficticio')).toBeNull();
  });
  it.each([503, 409])('un fallo HTTP %s no abre pasillos y permite reiniciar', async (status) => {
    fetchSimulado.mockResolvedValueOnce(
      new Response('Mensaje privado que no se muestra', { status }),
    );
    mostrar();
    revisarTexto();
    continuar();
    await screen.findByRole('alert');
    expect(screen.queryByText('Mensaje privado que no se muestra')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver el pasillo' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Nueva consulta' }));
    expect(screen.getByRole('textbox')).toBeTruthy();
  });
  it('rechaza contratos inválidos en vez de mostrar una supuesta recomendación', async () => {
    fetchSimulado.mockResolvedValueOnce(
      Response.json({ ...clasificacion, protocoloId: 'inventado', dosis: 'valor prohibido' }),
    );
    mostrar();
    revisarTexto();
    continuar();
    await screen.findByRole('alert');
    expect(screen.queryByText('valor prohibido')).toBeNull();
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
  });
  it('bloquea responder dos veces mientras la respuesta se comprueba', async () => {
    mostrar();
    await iniciarChip();
    fetchSimulado.mockImplementationOnce(() => new Promise(() => {}));
    const no = screen.getByRole('button', { name: 'No' });
    fireEvent.click(no);
    fireEvent.click(no);
    await waitFor(() => expect((no as HTMLButtonElement).disabled).toBe(true));
    expect(fetchSimulado.mock.calls.filter(([url]) => url === '/api/triaje')).toHaveLength(1);
  });
});
