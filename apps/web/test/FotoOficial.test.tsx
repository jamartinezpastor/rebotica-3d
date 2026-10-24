import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { FotoOficial } from '../src/escena/FotoOficial';
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
      this.dispatchEvent(new Event('close'));
    },
  });
});
afterEach(cleanup);
afterAll(() => {
  if (mostrar) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', mostrar);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (cerrar) Object.defineProperty(HTMLDialogElement.prototype, 'close', cerrar);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});
describe('foto oficial ampliable', () => {
  it('amplía la misma fuente oficial, devuelve el foco y Escape no llega a la ficha ni a la ventana', () => {
    const salir = vi.fn();
    window.addEventListener('keydown', salir);
    try {
      render(
        <section onKeyDown={salir}>
          <FotoOficial foto="/media/miniaturas/ficticia.webp" ampliable alt="Foto CIMA de prueba" />
        </section>,
      );
      const origen = screen.getByRole('button', { name: 'Ampliar foto del envase' });
      origen.focus();
      fireEvent.click(origen);
      const dialogo = screen.getByRole('dialog', { name: 'Foto oficial del envase · CIMA' });
      expect(
        screen.getByAltText('Foto ampliada del envase publicada en CIMA').getAttribute('src'),
      ).toBe('/media/miniaturas/ficticia.webp');
      fireEvent.keyDown(dialogo, { key: 'Escape' });
      expect(salir).not.toHaveBeenCalled();
      fireEvent(dialogo, new Event('cancel', { cancelable: true }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(origen);
    } finally {
      window.removeEventListener('keydown', salir);
    }
  });
  it('permite cerrar la foto con su botón y con el fondo del diálogo', () => {
    render(<FotoOficial foto="/media/miniaturas/ficticia.webp" ampliable />);
    fireEvent.click(screen.getByRole('button', { name: 'Ampliar foto del envase' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar foto ampliada' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ampliar foto del envase' }));
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('una imagen fallida se sustituye por una silueta y no ofrece ampliar una foto rota', () => {
    const { container } = render(
      <FotoOficial foto="/media/miniaturas/ausente.webp" ampliable alt="Foto de prueba" />,
    );
    fireEvent.error(screen.getByAltText('Foto de prueba'));
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ampliar foto del envase' })).toBeNull();
  });
});
