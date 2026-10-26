import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasTexture, MeshStandardMaterial, type WebGLRenderer } from 'three';
import { claveEnvase, precargarEnvase } from '../src/escena/Caja';
import { CacheRecursos } from '../src/escena/cacheRecursos';
import { datosEnvase } from '../src/escena/arteEnvase';
import { productosDemo } from '../src/escena/demo';

afterEach(() => vi.restoreAllMocks());

describe('reserva de los envases precargados', () => {
  it('el montaje reutiliza materiales y texturas subidas y las libera tras salir el último usuario', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const cache = new CacheRecursos();
    const producto = productosDemo(1)[0]!;
    const datos = datosEnvase(producto);
    const initTexture = vi.fn();
    const gl = { initTexture } as unknown as WebGLRenderer;
    const soltarPrecarga = precargarEnvase(cache, gl, producto.formaCaja, datos, 'estanteria');
    const clave = claveEnvase(producto.formaCaja, datos, 'estanteria');
    const recurso = cache.obtener<{
      materiales: MeshStandardMaterial[];
      texturas: CanvasTexture[];
      liberar(): void;
    }>(clave, () => {
      throw new Error('No debe reconstruir un envase preparado');
    });
    const material = vi.spyOn(recurso.materiales[0]!, 'dispose');
    const textura = vi.spyOn(recurso.texturas[0]!, 'dispose');
    expect(initTexture.mock.calls.map(([t]) => t)).toEqual(recurso.texturas);
    cache.retener(clave); // Usuario visible, como useRecurso al montar la caja.
    soltarPrecarga();
    await Promise.resolve();
    expect(material).not.toHaveBeenCalled();
    cache.soltar(clave);
    await Promise.resolve();
    expect(material).toHaveBeenCalledTimes(1);
    expect(textura).toHaveBeenCalledTimes(1);
  });
  it('un error al subir a GPU no deja una reserva retenida', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const materiales = vi.spyOn(MeshStandardMaterial.prototype, 'dispose');
    const texturas = vi.spyOn(CanvasTexture.prototype, 'dispose');
    const producto = productosDemo(1)[0]!;
    const cache = new CacheRecursos();
    const gl = {
      initTexture: () => {
        throw new Error('GPU ficticia no disponible');
      },
    } as unknown as WebGLRenderer;
    expect(() =>
      precargarEnvase(cache, gl, producto.formaCaja, datosEnvase(producto), 'estanteria'),
    ).toThrow('GPU ficticia');
    await Promise.resolve();
    expect(materiales).toHaveBeenCalled();
    expect(texturas).toHaveBeenCalledTimes(materiales.mock.calls.length);
    const liberados = texturas.mock.calls.length;
    cache.liberar();
    expect(texturas).toHaveBeenCalledTimes(liberados);
  });
});
