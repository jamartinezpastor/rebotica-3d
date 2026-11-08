import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { LIMITE_CONSULTA } from '@rebotica/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Mostrador } from '../src/mostrador/Mostrador';

const entrada = () =>
  screen.getByRole('textbox', {
    name: 'Cuéntanos qué te pasa',
  }) as HTMLTextAreaElement;
const revisar = () =>
  screen.getByRole('button', { name: 'Realizar consulta' }) as HTMLButtonElement;
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Mostrador F4-01', () => {
  it('Enter envía una consulta válida una sola vez y evita el salto de línea', () => {
    const onContinuar = vi.fn();
    render(<Mostrador directo onContinuar={onContinuar} />);
    fireEvent.change(entrada(), { target: { value: 'Consulta ficticia' } });
    expect(fireEvent.keyDown(entrada(), { key: 'Enter' })).toBe(false);
    expect(onContinuar).toHaveBeenCalledExactlyOnceWith({
      origen: 'texto',
      texto: 'Consulta ficticia',
    });
    fireEvent.keyDown(entrada(), { key: 'Enter', repeat: true });
    expect(onContinuar).toHaveBeenCalledTimes(1);
    expect(entrada().value).toBe('Consulta ficticia');
  });

  it('Enter respeta la composición del teclado y valida las consultas vacías', () => {
    const onContinuar = vi.fn();
    render(<Mostrador directo onContinuar={onContinuar} />);
    fireEvent.change(entrada(), { target: { value: 'Consulta ficticia' } });
    fireEvent.keyDown(entrada(), { key: 'Enter', isComposing: true });
    fireEvent.keyDown(entrada(), { key: 'Enter', keyCode: 229 });
    expect(onContinuar).not.toHaveBeenCalled();
    fireEvent.change(entrada(), { target: { value: '  ' } });
    fireEvent.keyDown(entrada(), { key: 'Enter' });
    expect(onContinuar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Escribe una consulta');
  });
  it('permite escribir sin dictado y muestra 4 chips iniciales y los 14 al desplegar', () => {
    render(<Mostrador />);
    expect(screen.queryByRole('button', { name: 'Dictar consulta' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nueva consulta' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Realizar consulta' })).toBeNull();
    expect(entrada().rows).toBe(2);
    fireEvent.change(entrada(), { target: { value: '  ' } });
    expect(screen.queryByRole('button', { name: 'Realizar consulta' })).toBeNull();
    fireEvent.change(entrada(), { target: { value: 'Consulta ficticia' } });
    expect(revisar().closest('form')).toBe(entrada().closest('form'));
    fireEvent.change(entrada(), { target: { value: '' } });
    expect(screen.queryByRole('button', { name: 'Realizar consulta' })).toBeNull();
    const grupo = screen.getByRole('group', { name: 'Consultas frecuentes' });
    expect(within(grupo).getAllByRole('button', { pressed: false })).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Ver más consultas' }));
    expect(within(grupo).getAllByRole('button', { pressed: false })).toHaveLength(14);
    expect(screen.getByRole('button', { name: 'Piojos' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver menos consultas' }));
    expect(within(grupo).getAllByRole('button', { pressed: false })).toHaveLength(4);
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
    fireEvent.click(screen.getByRole('button', { name: 'Ver más consultas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Acidez' }));
    fireEvent.click(revisar());
    expect(screen.getByText('Acidez')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Editar consulta' }));
    expect(entrada().value).toBe('Acidez');
    expect(document.activeElement).toBe(entrada());
    fireEvent.click(revisar());
    fireEvent.click(screen.getByRole('button', { name: 'Nueva consulta' }));
    expect(entrada().value).toBe('');
    expect(screen.queryByRole('button', { name: 'Realizar consulta' })).toBeNull();
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
});
