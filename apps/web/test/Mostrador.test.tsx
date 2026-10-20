import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { LIMITE_CONSULTA } from '@rebotica/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Mostrador } from '../src/mostrador/Mostrador';

class VozFicticia {
  static instancias: VozFicticia[] = [];
  static available = vi.fn(async () => 'available');
  processLocally = false;
  lang = '';
  continuous = true;
  interimResults = true;
  maxAlternatives = 0;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onnomatch: (() => void) | null = null;
  start = vi.fn(() => this.onstart?.());
  stop = vi.fn();
  abort = vi.fn();
  constructor() {
    VozFicticia.instancias.push(this);
  }
}
const entrada = () =>
  screen.getByRole('textbox', { name: 'Describe tu consulta' }) as HTMLTextAreaElement;
const revisar = () => screen.getByRole('button', { name: 'Revisar consulta' }) as HTMLButtonElement;
const botonVoz = () => screen.getByRole('button', { name: 'Dictar consulta' }) as HTMLButtonElement;
function resultado(r: VozFicticia, texto: string, isFinal = true) {
  act(() => r.onresult?.({ resultIndex: 0, results: [{ isFinal, 0: { transcript: texto } }] }));
}
async function comenzarVoz() {
  vi.stubGlobal('SpeechRecognition', VozFicticia);
  render(<Mostrador />);
  await waitFor(() => expect(botonVoz().disabled).toBe(false));
  fireEvent.click(botonVoz());
  return VozFicticia.instancias.at(-1)!;
}
beforeEach(() => {
  VozFicticia.instancias = [];
  VozFicticia.available.mockReset().mockResolvedValue('available');
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('SpeechRecognition', undefined);
  vi.stubGlobal('webkitSpeechRecognition', undefined);
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Mostrador F4-01', () => {
  it('permite escribir sin dictado y muestra 10 chips iniciales y los 14 al desplegar', () => {
    render(<Mostrador />);
    expect(botonVoz().disabled).toBe(true);
    expect(screen.getByText(/El dictado local no está disponible/)).toBeTruthy();
    expect(revisar().disabled).toBe(true);
    const grupo = screen.getByRole('group', { name: 'Consultas frecuentes' });
    expect(within(grupo).getAllByRole('button', { pressed: false })).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas las consultas' }));
    expect(within(grupo).getAllByRole('button', { pressed: false })).toHaveLength(14);
    expect(screen.getByRole('button', { name: 'Piojos' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver menos consultas' }));
    expect(within(grupo).getAllByRole('button', { pressed: false })).toHaveLength(10);
  });

  it('un chip rellena el campo y editarlo elimina su selección antes de revisar', () => {
    render(<Mostrador />);
    const chip = screen.getByRole('button', { name: 'Fiebre' });
    fireEvent.click(chip);
    expect(entrada().value).toBe('Fiebre');
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(entrada(), { target: { value: 'No tengo fiebre. Consulta ficticia.' } });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(revisar());
    expect(screen.getByText('No tengo fiebre. Consulta ficticia.')).toBeTruthy();
    expect(screen.getByText(/Esta consulta no se ha evaluado/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Revisa tu consulta' })).toBe(
      document.activeElement,
    );
  });

  it('revisa chips, permite editar, y Nueva consulta borra todo sin enviar ni persistir texto', () => {
    const guardar = vi.spyOn(Storage.prototype, 'setItem');
    const historial = vi.spyOn(window.history, 'pushState');
    render(<Mostrador />);
    fireEvent.click(screen.getByRole('button', { name: 'Acidez' }));
    fireEvent.click(revisar());
    expect(screen.getByText('Acidez')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Editar consulta' }));
    expect(entrada().value).toBe('Acidez');
    expect(document.activeElement).toBe(entrada());
    fireEvent.click(revisar());
    fireEvent.click(screen.getByRole('button', { name: 'Nueva consulta' }));
    expect(entrada().value).toBe('');
    expect(revisar().disabled).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    expect(guardar).not.toHaveBeenCalled();
    expect(historial).not.toHaveBeenCalled();
  });

  it('valida el texto vacío y el límite en el envío, y muestra entradas como texto', () => {
    const { container } = render(<Mostrador />);
    fireEvent.submit(container.querySelector('form')!);
    expect(screen.getByRole('alert').textContent).toMatch(/entre 1 y 2000/);
    fireEvent.change(entrada(), { target: { value: 'a'.repeat(LIMITE_CONSULTA + 1) } });
    fireEvent.submit(container.querySelector('form')!);
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.change(entrada(), { target: { value: '<script>Consulta ficticia</script>' } });
    fireEvent.click(revisar());
    expect(screen.getByText('<script>Consulta ficticia</script>')).toBeTruthy();
    expect(container.querySelector('script')).toBeNull();
  });

  it('borra la consulta al salir de la página y al volver desde la caché del navegador', () => {
    render(<Mostrador />);
    fireEvent.change(entrada(), { target: { value: 'Texto privado ficticio' } });
    fireEvent.click(revisar());
    act(() => window.dispatchEvent(new Event('pagehide')));
    expect(entrada().value).toBe('');
    expect(screen.queryByText('Texto privado ficticio')).toBeNull();
    fireEvent.change(entrada(), { target: { value: 'Otra consulta ficticia' } });
    const evento = new Event('pageshow');
    Object.assign(evento, { persisted: true });
    act(() => window.dispatchEvent(evento));
    expect(entrada().value).toBe('');
  });

  it('solo inicia el micrófono al pulsar, exige procesamiento local y no duplica ni usa resultados provisionales', async () => {
    vi.stubGlobal('SpeechRecognition', VozFicticia);
    render(<Mostrador />);
    await waitFor(() => expect(botonVoz().disabled).toBe(false));
    expect(VozFicticia.instancias.every((r) => r.start.mock.calls.length === 0)).toBe(true);
    expect(VozFicticia.available).toHaveBeenCalledWith({ langs: ['es-ES'], processLocally: true });
    fireEvent.click(botonVoz());
    const r = VozFicticia.instancias.at(-1)!;
    expect(r.processLocally).toBe(true);
    expect(r.lang).toBe('es-ES');
    expect(r.continuous).toBe(false);
    expect(r.interimResults).toBe(false);
    resultado(r, 'Provisional ficticio', false);
    expect(entrada().value).toBe('');
    resultado(r, 'Texto final ficticio');
    resultado(r, 'Texto final ficticio');
    expect(entrada().value).toBe('Texto final ficticio');
    expect(revisar().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Detener dictado' }));
    expect(r.stop).toHaveBeenCalledTimes(1);
    expect(revisar().disabled).toBe(true);
    act(() => r.onend?.());
    expect(revisar().disabled).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['unavailable', 'downloadable', 'downloading'])(
    'mantiene escritura si el idioma local está %s y no activa reconocimiento remoto',
    async (estado) => {
      VozFicticia.available.mockResolvedValue(estado);
      vi.stubGlobal('SpeechRecognition', VozFicticia);
      render(<Mostrador />);
      await screen.findByText(/El dictado local no está disponible/);
      expect(botonVoz().disabled).toBe(true);
      expect(VozFicticia.instancias.every((r) => r.start.mock.calls.length === 0)).toBe(true);
      fireEvent.change(entrada(), { target: { value: 'Consulta ficticia' } });
      expect(revisar().disabled).toBe(false);
    },
  );

  it('un permiso denegado avisa sin perder la escritura y una edición invalida resultados tardíos', async () => {
    const r = await comenzarVoz();
    act(() => r.onerror?.({ error: 'not-allowed', message: 'Este mensaje no se muestra.' }));
    expect(screen.getByRole('alert').textContent).toMatch(/No se ha permitido el micrófono/);
    expect(screen.queryByText('Este mensaje no se muestra.')).toBeNull();
    fireEvent.click(botonVoz());
    const siguiente = VozFicticia.instancias.at(-1)!;
    const tardio = siguiente.onresult!;
    fireEvent.click(screen.getByRole('button', { name: 'Tos' }));
    expect(siguiente.abort).toHaveBeenCalledTimes(1);
    act(() =>
      tardio({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'Tardío' } }] }),
    );
    expect(entrada().value).toBe('Tos');
  });

  it('no trunca un dictado que supera el límite, bloquea revisar y permite empezar de nuevo', async () => {
    const r = await comenzarVoz();
    resultado(r, 'a'.repeat(LIMITE_CONSULTA));
    act(() => r.onend?.());
    fireEvent.click(botonVoz());
    resultado(VozFicticia.instancias.at(-1)!, 'Fragmento adicional');
    expect(entrada().value).toBe('a'.repeat(LIMITE_CONSULTA));
    expect(screen.getByRole('alert').textContent).toMatch(
      /último fragmento del dictado no se ha añadido/,
    );
    expect(revisar().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva consulta' }));
    expect(entrada().value).toBe('');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('aborta al perder el foco o desmontar y no acepta callbacks del micrófono anterior', async () => {
    const r = await comenzarVoz();
    const tardio = r.onresult!;
    act(() => window.dispatchEvent(new Event('blur')));
    expect(r.abort).toHaveBeenCalledTimes(1);
    act(() =>
      tardio({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'Tardío' } }] }),
    );
    expect(entrada().value).toBe('');
    fireEvent.click(botonVoz());
    const siguiente = VozFicticia.instancias.at(-1)!;
    cleanup();
    expect(siguiente.abort).toHaveBeenCalledTimes(1);
  });
});
