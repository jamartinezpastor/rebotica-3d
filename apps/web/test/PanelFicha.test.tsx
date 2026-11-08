import { AVISO_FICHA, type ProductoResponse, type ProductoResumen } from '@rebotica/shared';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PanelFicha } from '../src/escena/PanelFicha';

const resumen: ProductoResumen = {
  receta: false,
  nregistro: '12345',
  nombre: 'PRODUCTO FICTICIO 500 mg',
  principioActivo: 'principio ficticio',
  forma: 'COMPRIMIDO',
  formaCaja: 'caja-plana',
  dosis: '500 mg',
  categoria: 'Categoría ficticia',
  laboratorio: 'Laboratorio ficticio',
  generico: false,
  conduccion: false,
  asset: null,
  calculadora: false,
};

const ficha = (extra: Partial<ProductoResponse> = {}): ProductoResponse => ({
  receta: false,
  nregistro: '12345',
  nombre: 'PRODUCTO FICTICIO 500 mg',
  principioActivo: 'principio ficticio',
  laboratorio: 'Laboratorio ficticio',
  categoria: 'Categoría ficticia',
  forma: 'COMPRIMIDO',
  formaCaja: 'caja-plana',
  dosis: '500 mg',
  generico: false,
  conduccion: false,
  triangulo: false,
  problemaSuministro: false,
  asset: null,
  presentaciones: [],
  secciones: [
    { seccion: '4.1', titulo: 'Indicaciones', texto: 'Texto de uso ficticio.', resumenLlano: null },
    {
      seccion: '4.2',
      titulo: 'Posología',
      texto: 'Texto de posología ficticio.',
      resumenLlano: null,
    },
    {
      seccion: '4.3',
      titulo: 'Contraindicaciones',
      texto: 'Primera contraindicación ficticia.\nSegunda contraindicación ficticia.',
      resumenLlano: 'Resumen revisado ficticio.',
    },
  ],
  enlaces: {
    prospecto: 'https://cima.aemps.es/cima/dochtml/p/12345/P_12345.html',
    fichaTecnica: 'https://cima.aemps.es/cima/dochtml/ft/12345/FT_12345.html',
  },
  reglaDosis: null,
  ...extra,
});

function responder(cuerpo: unknown, estado = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(cuerpo), { status: estado })),
  );
}

function puntero(destino: HTMLElement, tipo: string, extra: Record<string, unknown> = {}) {
  const evento = new Event(tipo, { bubbles: true });
  Object.assign(evento, {
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: 100,
    clientY: 100,
    ...extra,
  });
  fireEvent(destino, evento);
}

function pulsar(destino: HTMLElement) {
  puntero(destino, 'pointerdown');
  puntero(destino, 'pointerup');
  fireEvent.click(destino);
}

beforeEach(() => {
  vi.unstubAllGlobals();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PanelFicha', () => {
  it('los iconos abren las secciones con todos sus desplegables cerrados, incluso al repetir', async () => {
    responder(ficha());
    render(<PanelFicha producto={resumen} onVolver={() => {}} />);
    await screen.findByText('Para qué se usa');
    const abiertos = () => screen.getByRole('tabpanel').querySelectorAll('details[open]');
    expect(abiertos()).toHaveLength(0);
    for (const nombre of ['Uso', 'Avisos y precauciones', 'Dosis']) {
      const tab = screen.getByRole('tab', { name: nombre });
      expect(tab.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      fireEvent.click(tab);
      expect(abiertos()).toHaveLength(0);
      const apartado = screen.getByRole('tabpanel').querySelector('summary');
      expect(apartado).not.toBeNull();
      fireEvent.click(apartado!);
      expect(abiertos()).toHaveLength(1);
      fireEvent.click(tab);
      expect(abiertos()).toHaveLength(0);
      fireEvent.click(screen.getByRole('tabpanel').querySelector('summary')!);
    }
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Dosis' }), { key: 'Home' });
    expect(abiertos()).toHaveLength(0);
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Uso' }));
  });
  it('devuelve el foco al producto al cerrar y permite salir con Escape', async () => {
    responder(ficha());
    const volver = vi.fn();
    const { rerender } = render(<button type="button">Abrir producto</button>);
    const origen = screen.getByRole('button', { name: 'Abrir producto' });
    origen.focus();
    rerender(
      <>
        <button type="button">Abrir producto</button>
        <PanelFicha producto={resumen} modo="lista" onVolver={volver} />
      </>,
    );
    const dialogo = screen.getByRole('dialog');
    expect(document.activeElement).toBe(dialogo);
    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    fireEvent.keyDown(dialogo, { key: 'Escape' });
    expect(volver).toHaveBeenCalledTimes(1);
    rerender(<button type="button">Abrir producto</button>);
    expect(document.activeElement).toBe(origen);
  });

  it('Tab y Mayús+Tab permanecen en la ficha modal sin entrar en pestañas inactivas', async () => {
    responder(ficha());
    render(<PanelFicha producto={resumen} modo="lista" onVolver={() => {}} />);
    await screen.findByRole('link', { name: 'Ficha técnica oficial' });
    const ultimo = screen.getByRole('link', { name: 'Ficha técnica oficial' });
    const primero = screen.getByRole('button', { name: 'Volver al pasillo' });
    ultimo.focus();
    fireEvent.keyDown(ultimo, { key: 'Tab' });
    expect(document.activeElement).toBe(primero);
    fireEvent.keyDown(primero, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(ultimo);
  });

  it.each(['3d', 'lista'] as const)(
    'un toque exterior vuelve al pasillo sin activar el fondo (%s)',
    async (modo) => {
      responder(ficha());
      const onVolver = vi.fn();
      const onFondo = vi.fn();
      render(
        <>
          <button onClick={onFondo}>Producto del fondo</button>
          <PanelFicha producto={resumen} onVolver={onVolver} modo={modo} />
        </>,
      );
      await screen.findByText('Texto de uso ficticio.');
      pulsar(screen.getByRole('button', { name: 'Producto del fondo' }));
      expect(onVolver).toHaveBeenCalledTimes(1);
      expect(onFondo).not.toHaveBeenCalled();
    },
  );

  it('el clic de apertura y los controles interiores no cierran la ficha', async () => {
    responder(ficha());
    const onVolver = vi.fn();
    render(<PanelFicha producto={resumen} onVolver={onVolver} />);
    fireEvent.click(document.body);
    await screen.findByText('Texto de uso ficticio.');
    pulsar(screen.getByRole('tab', { name: 'Dosis' }));
    expect(screen.getByText('Texto de posología ficticio.')).toBeTruthy();
    expect(onVolver).not.toHaveBeenCalled();
    pulsar(screen.getByRole('button', { name: 'Volver al pasillo' }));
    expect(onVolver).toHaveBeenCalledTimes(1);
  });

  it('girar la caja o cancelar un gesto no cierra la ficha, aunque el puntero vuelva al inicio', () => {
    responder(ficha());
    const onVolver = vi.fn();
    render(<PanelFicha producto={resumen} onVolver={onVolver} />);
    puntero(document.body, 'pointerdown');
    puntero(document.body, 'pointermove', { clientX: 130 });
    puntero(document.body, 'pointermove');
    puntero(document.body, 'pointerup');
    fireEvent.click(document.body);
    expect(onVolver).not.toHaveBeenCalled();
    puntero(document.body, 'pointerdown');
    puntero(document.body, 'pointercancel');
    fireEvent.click(document.body);
    expect(onVolver).not.toHaveBeenCalled();
    pulsar(document.body);
    expect(onVolver).toHaveBeenCalledTimes(1);
  });

  it('un gesto que empieza dentro y acaba fuera no cierra, ni lo hace el botón secundario', async () => {
    responder(ficha());
    const onVolver = vi.fn();
    render(<PanelFicha producto={resumen} onVolver={onVolver} />);
    const texto = await screen.findByText('Texto de uso ficticio.');
    puntero(texto, 'pointerdown');
    puntero(document.body, 'pointerup');
    fireEvent.click(document.body);
    puntero(document.body, 'pointerdown', { button: 2 });
    puntero(document.body, 'pointerup', { button: 2 });
    fireEvent.click(document.body, { button: 2 });
    expect(onVolver).not.toHaveBeenCalled();
  });

  it('retira los listeners al desmontar la ficha', () => {
    responder(ficha());
    const onVolver = vi.fn();
    const { unmount } = render(<PanelFicha producto={resumen} onVolver={onVolver} />);
    unmount();
    pulsar(document.body);
    expect(onVolver).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    'mantiene la banda del borrador en todas las pestañas sin calculadora (receta=%s)',
    async (receta) => {
      responder(ficha({ receta, borradorDosis: { id: 'regla-ficticia', version: 1 } }));
      render(<PanelFicha producto={{ ...resumen, receta }} onVolver={() => {}} modo="lista" />);
      await screen.findByText('Demostración: pendiente de validación farmacéutica');
      for (const nombre of ['Uso', 'Avisos y precauciones', 'Dosis']) {
        fireEvent.click(screen.getByRole('tab', { name: nombre }));
        expect(screen.getByText('Demostración: pendiente de validación farmacéutica')).toBeTruthy();
        expect(screen.queryByRole('slider')).toBeNull();
      }
      expect(screen.getByText('Texto de posología ficticio.')).toBeTruthy();
      if (receta) expect(screen.getByText(/no inicies ni cambies/)).toBeTruthy();
    },
  );
  it('la ficha con receta conserva las pestañas, la foto y el aviso durante toda la consulta', async () => {
    responder(
      ficha({
        receta: true,
        asset: { colorDominante: '#336699', paleta: [], foto: '/media/miniaturas/receta.webp' },
      }),
    );
    render(<PanelFicha producto={{ ...resumen, receta: true }} onVolver={() => {}} />);
    expect(screen.getByText(/no inicies ni cambies/)).toBeTruthy();
    await screen.findByAltText('Foto del envase publicada en CIMA');
    fireEvent.click(screen.getByRole('tab', { name: 'Dosis' }));
    expect(screen.getByText('Texto de posología ficticio.')).toBeTruthy();
    expect(screen.getByText(/no inicies ni cambies/)).toBeTruthy();
    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('muestra la cabecera enseguida y el texto de Uso cuando llega la ficha', async () => {
    responder(ficha());
    render(<PanelFicha producto={resumen} onVolver={() => {}} />);
    expect(screen.getByRole('dialog', { name: /PRODUCTO FICTICIO/ })).toBeTruthy();
    expect(screen.getByText('Cargando la ficha…')).toBeTruthy();
    expect(await screen.findByText('Texto de uso ficticio.')).toBeTruthy();
    expect(screen.getByText('Para qué se usa')).toBeTruthy();
  });

  it('las pestañas cambian de contenido y marcan la activa', async () => {
    responder(ficha());
    render(<PanelFicha producto={resumen} onVolver={() => {}} />);
    await screen.findByText('Texto de uso ficticio.');

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      'Uso',
      'Avisos',
      'Dosis',
      'Suministro',
      'Seguridad',
    ]);
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');

    fireEvent.click(tabs[1] as HTMLElement);
    expect(await screen.findByText('Contraindicaciones')).toBeTruthy();
    expect(screen.getByText('Resumen revisado ficticio.')).toBeTruthy();
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');

    fireEvent.click(tabs[2] as HTMLElement);
    expect(await screen.findByText('Texto de posología ficticio.')).toBeTruthy();
  });

  it('la pestaña Dosis aclara que es la posología oficial y no una pauta personalizada', async () => {
    responder(ficha());
    render(<PanelFicha producto={resumen} onVolver={() => {}} />);
    await screen.findByText('Texto de uso ficticio.');
    fireEvent.click(screen.getByRole('tab', { name: 'Dosis' }));
    expect(screen.getByText(/no una pauta personalizada/)).toBeTruthy();
    // Sin regla validada no hay calculadora: ni sliders ni resultado.
    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('las flechas del teclado recorren las pestañas', async () => {
    responder(ficha());
    render(<PanelFicha producto={resumen} onVolver={() => {}} />);
    await screen.findByText('Texto de uso ficticio.');
    const uso = screen.getByRole('tab', { name: 'Uso' });
    uso.focus();
    fireEvent.keyDown(uso, { key: 'ArrowRight' });
    expect(
      screen.getByRole('tab', { name: 'Avisos y precauciones' }).getAttribute('aria-selected'),
    ).toBe('true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Avisos y precauciones' }), { key: 'End' });
    expect(
      screen
        .getByRole('tab', { name: 'Seguridad: notas de seguridad' })
        .getAttribute('aria-selected'),
    ).toBe('true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Seguridad: notas de seguridad' }), {
      key: 'ArrowRight',
    });
    expect(screen.getByRole('tab', { name: 'Uso' }).getAttribute('aria-selected')).toBe('true');
  });

  it('enlaza al prospecto y a la ficha técnica en CIMA en pestaña nueva y sin referrer', async () => {
    responder(ficha());
    render(<PanelFicha producto={resumen} onVolver={() => {}} />);
    const enlace = (await screen.findByRole('link', {
      name: 'Prospecto oficial en CIMA',
    })) as HTMLAnchorElement;
    expect(enlace.href).toBe('https://cima.aemps.es/cima/dochtml/p/12345/P_12345.html');
    expect(enlace.target).toBe('_blank');
    expect(enlace.rel).toContain('noopener');
    expect(screen.getByRole('link', { name: 'Ficha técnica oficial' })).toBeTruthy();
  });

  it('no enlaza a un dominio que no sea CIMA aunque la API lo enviara', async () => {
    responder(
      ficha({
        enlaces: {
          prospecto: 'https://malo.example/p.html',
          fichaTecnica: 'https://cima.aemps.es/cima/dochtml/ft/12345/FT_12345.html',
        },
      }),
    );
    render(<PanelFicha producto={resumen} onVolver={() => {}} />);
    await screen.findByRole('link', { name: 'Ficha técnica oficial' });
    expect(screen.queryByRole('link', { name: 'Prospecto oficial en CIMA' })).toBeNull();
  });

  it('muestra la foto del envase de CIMA, la categoría y el laboratorio', async () => {
    responder(
      ficha({
        asset: {
          colorDominante: '#336699',
          paleta: ['#336699'],
          foto: '/media/miniaturas/12345-abcd1234.webp',
        },
      }),
    );
    render(<PanelFicha producto={resumen} onVolver={() => {}} />);
    const foto = (await screen.findByAltText(
      'Foto del envase publicada en CIMA',
    )) as HTMLImageElement;
    expect(foto.getAttribute('src')).toBe('/media/miniaturas/12345-abcd1234.webp');
    expect(screen.getByText('Categoría ficticia')).toBeTruthy();
    expect(screen.getByText('Laboratorio ficticio')).toBeTruthy();
  });

  it('sin foto no deja un hueco ni una imagen rota', async () => {
    responder(ficha({ asset: null }));
    render(<PanelFicha producto={resumen} onVolver={() => {}} />);
    await screen.findByText('Texto de uso ficticio.');
    expect(screen.queryByAltText('Foto del envase publicada en CIMA')).toBeNull();
  });

  it('avisa de los problemas de suministro y muestra siempre el aviso legal', async () => {
    responder(ficha({ problemaSuministro: true }));
    render(<PanelFicha producto={resumen} onVolver={() => {}} />);
    expect(await screen.findByText(/problemas de suministro/)).toBeTruthy();
    expect(screen.getByText(AVISO_FICHA)).toBeTruthy();
    expect(screen.queryByText(/ante cualquier duda, consulta presencial/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Privacidad y fuentes' })).toBeNull();
  });

  it('muestra incidencias por presentación y notas oficiales sin hacer consultas externas', async () => {
    responder(
      ficha({
        problemaSuministro: true,
        informacionCima: {
          suministro: {
            consultadoEn: '2026-01-10T12:00:00.000Z',
            incidencias: [
              {
                cn: '123456',
                nombre: 'Envase ficticio',
                inicio: '2026-01-09T12:00:00.000Z',
                finPrevisto: null,
                observaciones: 'Observación ficticia de la AEMPS.',
              },
            ],
          },
          seguridad: {
            consultadoEn: '2026-01-10T12:00:00.000Z',
            notas: [
              {
                referencia: 'Referencia ficticia',
                asunto: 'Aviso de seguridad ficticio',
                fecha: '2026-01-09T12:00:00.000Z',
                url: 'https://www.aemps.gob.es/nota-ficticia',
              },
              {
                referencia: 'No oficial',
                asunto: 'Enlace no permitido',
                fecha: null,
                url: 'https://aemps.gob.es.example.invalid/nota',
              },
            ],
          },
        },
      }),
    );
    render(<PanelFicha producto={resumen} onVolver={() => {}} />);
    await screen.findByText('Texto de uso ficticio.');
    fireEvent.click(screen.getByRole('tab', { name: 'Suministro' }));
    expect(screen.getByRole('tabpanel').querySelectorAll('details[open]')).toHaveLength(0);
    fireEvent.click(screen.getByText('Envase ficticio'));
    expect(screen.getByText('Código nacional: 123456')).toBeTruthy();
    expect(screen.getByText('Sin fecha de fin prevista.')).toBeTruthy();
    expect(screen.getByText('Observación ficticia de la AEMPS.')).toBeTruthy();
    expect(screen.queryByText(/No indica existencias en farmacias/)).toBeNull();
    expect(screen.getByText(/más de 48 horas/)).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Seguridad: notas de seguridad' }));
    expect(screen.getByText('Aviso de seguridad ficticio')).toBeTruthy();
    expect(screen.getByRole('tabpanel').querySelectorAll('details[open]')).toHaveLength(0);
    expect(
      screen.getByRole('link', { name: 'Leer nota completa en la AEMPS' }).closest('details')?.open,
    ).toBe(false);
    fireEvent.click(screen.getByText('Aviso de seguridad ficticio'));
    const enlaces = screen.getAllByRole('link', { name: 'Leer nota completa en la AEMPS' });
    expect(enlaces).toHaveLength(1);
    expect(enlaces[0]?.getAttribute('href')).toBe('https://www.aemps.gob.es/nota-ficticia');
    fireEvent.click(screen.getByRole('tab', { name: 'Suministro' }));
    expect(screen.getByRole('tabpanel').querySelectorAll('details[open]')).toHaveLength(0);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([null, { suministro: null, seguridad: null }])(
    'no confunde datos ausentes con ausencia de incidencias: %s',
    async (informacionCima) => {
      responder(ficha({ informacionCima }));
      render(<PanelFicha producto={resumen} onVolver={() => {}} />);
      await screen.findByText('Texto de uso ficticio.');
      fireEvent.click(screen.getByRole('tab', { name: 'Suministro' }));
      expect(screen.getByText(/No podemos confirmar si hay incidencias/)).toBeTruthy();
      expect(screen.queryByText(/Sin incidencias de suministro/)).toBeNull();
      fireEvent.click(screen.getByRole('tab', { name: 'Seguridad: notas de seguridad' }));
      expect(screen.getByText(/todavía no están disponibles/)).toBeTruthy();
      expect(screen.queryByText(/No constan notas/)).toBeNull();
    },
  );

  it('una consulta sin incidencias no garantiza stock ni ausencia de precauciones', async () => {
    const consultadoEn = new Date().toISOString();
    responder(
      ficha({
        informacionCima: {
          suministro: { consultadoEn, incidencias: [] },
          seguridad: { consultadoEn, notas: [] },
        },
      }),
    );
    render(<PanelFicha producto={resumen} onVolver={() => {}} />);
    await screen.findByText('Texto de uso ficticio.');
    fireEvent.click(screen.getByRole('tab', { name: 'Suministro' }));
    expect(screen.getByText(/Esto no garantiza disponibilidad/)).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Seguridad: notas de seguridad' }));
    expect(screen.getByText(/Consulta también las precauciones y el prospecto/)).toBeTruthy();
  });

  it('si la ficha no existe o falla, lo dice y deja volver', async () => {
    responder({ error: 'Producto no encontrado' }, 404);
    const onVolver = vi.fn();
    render(<PanelFicha producto={resumen} onVolver={onVolver} />);
    expect(await screen.findByText('No hay ficha disponible para este producto.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Volver al pasillo' }));
    expect(onVolver).toHaveBeenCalledTimes(1);
  });

  it('rechaza una respuesta que no cumple el contrato', async () => {
    responder({ nregistro: '12345', secciones: 'no es una lista' });
    render(<PanelFicha producto={resumen} onVolver={() => {}} />);
    await waitFor(() => expect(screen.getByText(/No se pudo cargar la ficha/)).toBeTruthy());
  });

  it('una pestaña sin información remite al prospecto', async () => {
    responder(ficha({ secciones: [] }));
    render(<PanelFicha producto={resumen} onVolver={() => {}} />);
    expect(await screen.findByText(/No hay información de este apartado/)).toBeTruthy();
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).queryAllByRole('group')).toHaveLength(0);
  });
});
