import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { productosDemo } from '../src/escena/demo';
import type * as Capacidad from '../src/escena/capacidad';

vi.mock('../src/escena/capacidad', async (importar) => ({
  ...(await importar<typeof Capacidad>()),
  detectarDispositivo: () => ({ webgl: false }),
}));
const producto = productosDemo(1)[0]!;
const { calculadora, ...datosFicha } = producto;
const pasillo = {
  id: 'fiebre',
  version: 1,
  titulo: 'Fiebre',
  estado: 'informativo',
  baldas: [
    {
      titulo: 'Grupo ficticio',
      principioActivo: producto.principioActivo,
      orden: 1,
      productos: [producto],
    },
  ],
  vitrina: [],
  ocultasPorPerfil: 0,
  consejos: [],
  parafarmacia: [],
};
const datosExtraidos = { paraQuien: 'yo', grupo: null, edad: null, duracion: null };
let peticiones: ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(() => {
  peticiones = vi.fn<typeof fetch>().mockImplementation(async (url) => {
    if (url === '/api/health')
      return Response.json({ status: 'ok', version: 'prueba', time: new Date().toISOString() });
    if (url === '/api/explorar') return Response.json(pasillo);
    if (url === '/api/interpretar')
      return Response.json({
        tipo: 'clasificacion',
        protocoloId: 'fiebre',
        confianza: 0.95,
        datosExtraidos,
      });
    if (url === `/api/productos/${producto.nregistro}`)
      return Response.json({
        ...datosFicha,
        laboratorio: null,
        triangulo: false,
        problemaSuministro: false,
        presentaciones: [],
        secciones: [
          {
            seccion: '4.1',
            titulo: 'Indicaciones',
            texto: 'Indicación ficticia de prueba',
            resumenLlano: null,
          },
          {
            seccion: '4.3',
            titulo: 'Contraindicaciones',
            texto: 'Precaución ficticia de prueba',
            resumenLlano: null,
          },
          {
            seccion: '4.2',
            titulo: 'Posología',
            texto: 'Posología ficticia de prueba',
            resumenLlano: null,
          },
        ],
        enlaces: {
          prospecto: 'https://cima.aemps.es/cima/dochtml/p/F1/P_F1.html',
          fichaTecnica: 'https://cima.aemps.es/cima/dochtml/ft/F1/FT_F1.html',
        },
        reglaDosis: null,
        borradorDosis: null,
      });
    throw new Error('Petición inesperada');
  });
  vi.stubGlobal('fetch', peticiones);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const enviarTexto = () => {
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Consulta sintética privada' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Realizar consulta' }));
};

describe('recorrido informativo simplificado', () => {
  it('un clic en una dolencia abre los productos y conserva la ficha con sus tres pestañas', async () => {
    expect(calculadora).toBe(false);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Fiebre' }));
    fireEvent.click(await screen.findByRole('button', { name: /PRODUCTO DE DEMOSTRACIÓN 1/ }));
    await screen.findByText('Indicación ficticia de prueba');
    fireEvent.click(screen.getByRole('tab', { name: 'Precauciones' }));
    expect(screen.getByText('Precaución ficticia de prueba')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Dosis' }));
    expect(screen.getByText('Posología ficticia de prueba')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Prospecto oficial en CIMA' })).toBeTruthy();
    expect(
      peticiones.mock.calls.some(([url]) => /interpretar|protocolos|triaje/.test(String(url))),
    ).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Volver al pasillo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva consulta' }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
  });
  it('texto libre pasa por interpretación y abre el catálogo sin cuestionario ni persistencia', async () => {
    const guardar = vi.spyOn(Storage.prototype, 'setItem');
    render(<App />);
    enviarTexto();
    await screen.findByRole('heading', { name: 'Fiebre' });
    expect(peticiones.mock.calls.filter(([url]) => url === '/api/explorar')[0]![1]!.body).toBe(
      JSON.stringify({ consultaId: 'fiebre' }),
    );
    expect(peticiones.mock.calls.some(([url]) => /protocolos|triaje/.test(String(url)))).toBe(
      false,
    );
    expect(guardar).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
    expect(screen.getByText(/Catálogo informativo:/)).toBeTruthy();
  });
  it('las alarmas sustituyen el catálogo y no muestran productos', async () => {
    peticiones.mockImplementation(async (url) =>
      url === '/api/health'
        ? Response.json({ status: 'ok', version: 'prueba', time: new Date().toISOString() })
        : Response.json({
            tipo: 'derivacion',
            destino: '112',
            alarmasDetectadas: ['dificultad-respiratoria'],
          }),
    );
    render(<App />);
    enviarTexto();
    await screen.findByRole('heading', { name: 'Necesitas atención urgente' });
    expect(peticiones.mock.calls.some(([url]) => url === '/api/explorar')).toBe(false);
    expect(screen.queryByRole('link', { name: 'Explorar medicamentos' })).toBeNull();
  });
  it('sin coincidencias explica el resultado y permite elegir otra dolencia', async () => {
    peticiones.mockImplementation(async (url) =>
      Response.json(
        url === '/api/health'
          ? { status: 'ok', version: 'prueba', time: new Date().toISOString() }
          : { ...pasillo, baldas: [] },
      ),
    );
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Fiebre' }));
    await screen.findByRole('heading', {
      name: 'No hay medicamentos relacionados en este catálogo',
    });
    expect(screen.queryByRole('button', { name: /PRODUCTO DE DEMOSTRACIÓN/ })).toBeNull();
  });
  it('una copia sin sincronizar explica la disponibilidad del catálogo', async () => {
    peticiones.mockImplementation(async (url) =>
      url === '/api/health'
        ? Response.json({ status: 'ok', version: 'prueba', time: new Date().toISOString() })
        : Response.json(
            { error: 'Catálogo pendiente', codigo: 'CATALOGO_NO_SINCRONIZADO' },
            { status: 503 },
          ),
    );
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Fiebre' }));
    await screen.findByRole('heading', {
      name: 'El catálogo de medicamentos se está preparando',
    });
    expect(screen.queryByText('No hay medicamentos relacionados en este catálogo')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Nueva consulta' }));
    expect(screen.getByRole('textbox')).toBeTruthy();
  });
  it('Nueva consulta cancela la búsqueda e ignora respuestas tardías', async () => {
    let resolver!: (r: Response) => void;
    peticiones.mockImplementation(async (url) =>
      url === '/api/health'
        ? Response.json({ status: 'ok', version: 'prueba', time: new Date().toISOString() })
        : new Promise((r) => {
            resolver = r;
          }),
    );
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Fiebre' }));
    await waitFor(() => expect(resolver).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Nueva consulta' }));
    await act(async () => resolver(Response.json(pasillo)));
    expect(screen.getByRole('textbox')).toBeTruthy();
  });
});
