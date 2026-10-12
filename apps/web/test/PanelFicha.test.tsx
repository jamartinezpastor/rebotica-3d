import { AVISO_LEGAL, type ProductoResponse, type ProductoResumen } from '@rebotica/shared';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PanelFicha } from '../src/escena/PanelFicha';

const resumen: ProductoResumen = {
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

beforeEach(() => {
  vi.unstubAllGlobals();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PanelFicha', () => {
  it('muestra la cabecera enseguida y el texto de Uso cuando llega la ficha', async () => {
    responder(ficha());
    render(<PanelFicha producto={resumen} onVolver={() => {}} />);
    expect(screen.getByRole('dialog', { name: /PRODUCTO FICTICIO/ })).toBeTruthy();
    expect(screen.getByText('Cargando la ficha…')).toBeTruthy();
    expect(await screen.findByText('Texto de uso ficticio.')).toBeTruthy();
    expect(screen.getByText('Para qué se usa')).toBeTruthy();
  });

  it('las tres pestañas cambian de contenido y marcan la activa', async () => {
    responder(ficha());
    render(<PanelFicha producto={resumen} onVolver={() => {}} />);
    await screen.findByText('Texto de uso ficticio.');

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Uso', 'Precauciones', 'Dosis']);
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
    expect(screen.getByRole('tab', { name: 'Precauciones' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Precauciones' }), { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Dosis' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Dosis' }), { key: 'ArrowRight' });
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
    expect(screen.getByText(AVISO_LEGAL)).toBeTruthy();
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
