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
  it('un tema fuera de los chips abre el catálogo devuelto por el servidor y mantiene la ficha completa', async () => {
    const original = peticiones.getMockImplementation()!;
    peticiones.mockImplementation(async (url, opciones) =>
      url === '/api/interpretar'
        ? Response.json({
            tipo: 'catalogo',
            pasillo: { ...pasillo, id: 'consulta-texto', titulo: 'Llagas en la boca' },
          })
        : original(url, opciones),
    );
    render(<App />);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'me ha salido una llaga en la boca' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Realizar consulta' }));
    await screen.findByRole('heading', { name: 'Llagas en la boca' });
    expect(
      JSON.parse(
        peticiones.mock.calls.find(([url]) => url === '/api/interpretar')![1]!.body as string,
      ),
    ).toEqual({ texto: 'me ha salido una llaga en la boca', modo: 'catalogo' });
    expect(
      peticiones.mock.calls.some(([url]) => /explorar|protocolos|triaje/.test(String(url))),
    ).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /PRODUCTO DE DEMOSTRACIÓN 1/ }));
    await screen.findByText('Indicación ficticia de prueba');
    fireEvent.click(screen.getByRole('tab', { name: 'Dosis' }));
    expect(screen.getByText('Posología ficticia de prueba')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Prospecto oficial en CIMA' })).toBeTruthy();
  });
  it('una aclaración sin alternativas permite precisar el motivo sin empezar de nuevo', async () => {
    peticiones.mockImplementation(async (url) =>
      Response.json(
        url === '/api/health'
          ? { status: 'ok', version: 'prueba', time: new Date().toISOString() }
          : { tipo: 'aclaracion', confianza: 0.3, alternativas: [], datosExtraidos },
      ),
    );
    render(<App />);
    enviarTexto();
    await screen.findByRole('heading', { name: '¿Te refieres a…?' });
    expect(screen.getByRole('textbox', { name: 'Cuéntanos qué te pasa' })).toBeTruthy();
    expect(screen.getByText(/indica dónde te molesta/)).toBeTruthy();
  });
  it('una copia completa sin indicaciones permite abrir el catálogo general y no anuncia una descarga', async () => {
    peticiones.mockImplementation(async (url) =>
      url === '/api/health'
        ? Response.json({ status: 'ok', version: 'prueba', time: new Date().toISOString() })
        : Response.json(
            { error: 'Sin indicaciones', codigo: 'CATALOGO_SIN_INDICACIONES' },
            { status: 503 },
          ),
    );
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Fiebre' }));
    expect(
      await screen.findByRole('heading', { name: 'Esta copia no permite buscar por dolencia' }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Explorar medicamentos' }).getAttribute('href')).toBe(
      '/escena?vista=3d&entrada=1',
    );
    expect(screen.queryByText('El catálogo de medicamentos se está preparando')).toBeNull();
  });
  it.each([
    ['parcial', 'Aún no hay coincidencias en los datos cargados'],
    ['completo', 'No se han encontrado coincidencias en esta copia'],
  ] as const)('un resultado vacío distingue la copia %s', async (estado, titulo) => {
    peticiones.mockImplementation(async (url) =>
      url === '/api/health'
        ? Response.json({ status: 'ok', version: 'prueba', time: new Date().toISOString() })
        : Response.json({
            ...pasillo,
            baldas: [],
            catalogo: {
              estado,
              total: 5,
              sinReceta: 4,
              conReceta: 1,
              conIndicaciones: 3,
              sinIndicaciones: 2,
              cargaPendiente: estado === 'parcial',
              cargaPendienteDesde: estado === 'parcial' ? '2026-01-01T00:00:00.000Z' : null,
              sincronizadoHasta: estado === 'completo' ? '2026-01-01T00:00:00.000Z' : null,
            },
          }),
    );
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Fiebre' }));
    expect(await screen.findByRole('heading', { name: titulo })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /PRODUCTO DE DEMOSTRACIÓN/ })).toBeNull();
  });

  it('muestra todos los resultados y agrupar conserva la colección completa', async () => {
    const todos = productosDemo(83).map((p, i) => ({ ...p, receta: i >= 52 }));
    peticiones.mockImplementation(async (url) =>
      url === '/api/health'
        ? Response.json({ status: 'ok', version: 'prueba', time: new Date().toISOString() })
        : Response.json({
            ...pasillo,
            baldas: [{ ...pasillo.baldas[0], productos: todos.slice(0, 52) }],
            vitrina: [
              {
                principioActivo: 'Grupo ficticio con receta',
                productos: todos.slice(52),
                formas: [],
                paraQueSeUsa: 'Indicación ficticia',
                porQueNecesitaReceta: 'Requiere prescripción',
                situacion: 'Información de prueba',
              },
            ],
          }),
    );
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Fiebre' }));
    await screen.findByRole('heading', { name: 'Fiebre' });
    const agrupacion = screen.getByRole('combobox', { name: 'Agrupar por' });
    const comprobarTodos = () => {
      expect(container.querySelectorAll('button[data-cursor="medicamento"]')).toHaveLength(83);
      expect(screen.queryByText(/Catálogo informativo:/)).toBeNull();
    };
    comprobarTodos();
    for (const value of ['laboratorio', 'principio', 'generico']) {
      fireEvent.change(agrupacion, {
        target: { value },
      });
      comprobarTodos();
    }
    expect(peticiones.mock.calls.filter(([url]) => url === '/api/explorar')).toHaveLength(1);
  });
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
    fireEvent.click(await screen.findByRole('link', { name: 'REBOTICA' }));
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
    expect(screen.queryByText(/Catálogo informativo:/)).toBeNull();
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
      name: 'No se han encontrado coincidencias en esta copia',
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
