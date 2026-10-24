import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import Comparacion from '../src/escena/Comparacion';
import { alternarComparado } from '../src/escena/seleccionComparacion';
import { fichaComparacion, productosComparacion } from './fixtures/comparacion';
const primero = productosComparacion[0]!;
const segundo = productosComparacion[75]!;
const mostrar = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const cerrar = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
      this.querySelector<HTMLButtonElement>('button')?.focus();
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
});
afterAll(() => {
  if (mostrar) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', mostrar);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (cerrar) Object.defineProperty(HTMLDialogElement.prototype, 'close', cerrar);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function responder(
  transformar: (p: typeof primero) => Response = (p) => Response.json(fichaComparacion(p)),
) {
  const peticiones = vi.fn(async (url: RequestInfo | URL) => {
    const p = productosComparacion.find((p) => String(url).endsWith(`/${p.nregistro}`));
    return p ? transformar(p) : new Response('', { status: 404 });
  });
  vi.stubGlobal('fetch', peticiones);
  return peticiones;
}
describe('comparación informativa de dos fichas', () => {
  it('conserva el orden elegido, evita duplicados y exige quitar uno antes de elegir un tercero', () => {
    const uno = alternarComparado([], primero);
    const dos = alternarComparado(uno, segundo);
    expect(uno).toEqual([primero]);
    expect(dos).toEqual([primero, segundo]);
    expect(alternarComparado(dos, productosComparacion[2]!)).toEqual(dos);
    expect(alternarComparado(dos, primero)).toEqual([segundo]);
    expect(alternarComparado(dos, segundo)).toEqual([primero]);
  });
  it('muestra campos y textos oficiales, con receta diferenciada y sin calculadoras ni dosis equivalentes', async () => {
    const peticiones = responder();
    const { container } = render(
      <Comparacion primero={primero} segundo={segundo} onCerrar={() => {}} />,
    );
    await screen.findByText(`Laboratorio oficial ficticio ${primero.nregistro}`);
    await screen.findByText(`Laboratorio oficial ficticio ${segundo.nregistro}`);
    const conReceta = screen.getByRole('region', { name: `Ficha comparada de ${segundo.nombre}` });
    expect(within(conReceta).getByText(/Requiere receta médica/)).toBeTruthy();
    expect(screen.getByText(`Indicación oficial ficticia de ${primero.nregistro}.`)).toBeTruthy();
    expect(screen.getByText(`Posología oficial ficticia de ${segundo.nregistro}.`)).toBeTruthy();
    expect(
      screen.queryByText(
        'Resumen ficticio que no debe sustituir al texto oficial de la comparación.',
      ),
    ).toBeNull();
    expect(screen.getAllByRole('link', { name: 'Prospecto oficial' })).toHaveLength(2);
    expect(
      screen.getAllByText('Sección no disponible en esta copia. Consulta la ficha técnica oficial.')
        .length,
    ).toBeGreaterThan(0);
    expect(container.querySelector('input')).toBeNull();
    expect(peticiones).toHaveBeenCalledTimes(2);
    expect(peticiones.mock.calls.map(([url]) => url)).toEqual([
      `/api/productos/${primero.nregistro}`,
      `/api/productos/${segundo.nregistro}`,
    ]);
  });
  it('un fallo de una ficha deja visible la otra y no lo presenta como una diferencia clínica', async () => {
    responder((p) =>
      p.nregistro === primero.nregistro
        ? new Response('', { status: 404 })
        : Response.json(fichaComparacion(p)),
    );
    render(<Comparacion primero={primero} segundo={segundo} onCerrar={() => {}} />);
    expect(await screen.findByText('No hay ficha disponible para este medicamento.')).toBeTruthy();
    expect(
      await screen.findByText(`Laboratorio oficial ficticio ${segundo.nregistro}`),
    ).toBeTruthy();
    const nombre = screen.getByRole('region', { name: `Ficha comparada de ${primero.nombre}` });
    expect(within(nombre).queryByRole('link')).toBeNull();
  });
  it('rechaza datos de otro registro y enlaces ajenos a CIMA', async () => {
    responder((p) => {
      const f = fichaComparacion(p);
      return Response.json(
        p.nregistro === primero.nregistro
          ? { ...f, nregistro: 'otro-registro', nombre: 'Nombre que no debe aparecer' }
          : {
              ...f,
              enlaces: { prospecto: 'https://example.com/', fichaTecnica: 'javascript:alert(1)' },
            },
      );
    });
    render(<Comparacion primero={primero} segundo={segundo} onCerrar={() => {}} />);
    await screen.findByText(
      'No se pudo cargar esta ficha. Vuelve al catálogo e inténtalo de nuevo.',
    );
    expect(screen.queryByText('Nombre que no debe aparecer')).toBeNull();
    await screen.findByText(`Laboratorio oficial ficticio ${segundo.nregistro}`);
    expect(screen.queryByRole('link')).toBeNull();
  });
  it('Escape no llega al navegador y salir devuelve el foco al botón que abrió la comparación', async () => {
    responder();
    const volver = vi.fn();
    const escapar = vi.fn();
    window.addEventListener('keydown', escapar);
    try {
      const { rerender } = render(<button type="button">Abrir comparación</button>);
      const origen = screen.getByRole('button');
      origen.focus();
      rerender(
        <>
          <button type="button">Abrir comparación</button>
          <Comparacion primero={primero} segundo={segundo} onCerrar={volver} />
        </>,
      );
      const dialogo = screen.getByRole('dialog', { name: 'Comparación de medicamentos' });
      await screen.findByText(`Laboratorio oficial ficticio ${segundo.nregistro}`);
      fireEvent.keyDown(dialogo, { key: 'Escape' });
      expect(escapar).not.toHaveBeenCalled();
      fireEvent(dialogo, new Event('cancel', { cancelable: true }));
      expect(volver).toHaveBeenCalledTimes(1);
      rerender(<button type="button">Abrir comparación</button>);
      await waitFor(() => expect(document.activeElement).toBe(origen));
    } finally {
      window.removeEventListener('keydown', escapar);
    }
  });
});
