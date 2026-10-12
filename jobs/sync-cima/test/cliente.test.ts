import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { crearClienteCima, ErrorCima } from '../src/cliente';

const esquema = z.object({ ok: z.literal(true) });
const url = new URL('https://cima.aemps.es/cima/rest/medicamento?nregistro=1');
const json = (cuerpo: unknown, estado = 200, cabeceras: Record<string, string> = {}) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: cabeceras });

describe('cliente de CIMA', () => {
  it('devuelve el JSON validado', async () => {
    const fetch = vi.fn().mockResolvedValue(json({ ok: true }));
    const cliente = crearClienteCima({ fetch, intervaloMs: 0 });
    expect(await cliente.obtener(url, esquema)).toEqual({ ok: true });
  });

  it('reintenta con espera exponencial ante 5xx y 429', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json({}, 429))
      .mockResolvedValueOnce(json({ ok: true }));
    const esperas: number[] = [];
    const cliente = crearClienteCima({
      fetch,
      intervaloMs: 0,
      esperaBaseMs: 100,
      esperar: async (ms) => void esperas.push(ms),
    });
    expect(await cliente.obtener(url, esquema)).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(cliente.peticiones).toBe(3);
    expect(esperas.filter((e) => e > 0)).toEqual([100, 200]);
  });

  it('respeta Retry-After', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({}, 429, { 'retry-after': '2' }))
      .mockResolvedValueOnce(json({ ok: true }));
    const esperas: number[] = [];
    const cliente = crearClienteCima({
      fetch,
      intervaloMs: 0,
      esperar: async (ms) => void esperas.push(ms),
    });
    await cliente.obtener(url, esquema);
    expect(esperas).toContain(2000);
  });

  it('se rinde tras el límite de reintentos', async () => {
    const fetch = vi.fn().mockImplementation(async () => json({}, 500));
    const cliente = crearClienteCima({
      fetch,
      intervaloMs: 0,
      maxReintentos: 2,
      esperar: async () => {},
    });
    await expect(cliente.obtener(url, esquema)).rejects.toBeInstanceOf(ErrorCima);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('reintenta ante un fallo de red', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(json({ ok: true }));
    const cliente = crearClienteCima({ fetch, intervaloMs: 0, esperar: async () => {} });
    expect(await cliente.obtener(url, esquema)).toEqual({ ok: true });
  });

  it('no reintenta un 400 y devuelve null en 404 y 204', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({}, 400))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const cliente = crearClienteCima({ fetch, intervaloMs: 0, esperar: async () => {} });
    await expect(cliente.obtener(url, esquema)).rejects.toThrow('400');
    expect(await cliente.obtener(url, esquema)).toBeNull();
    expect(await cliente.obtener(url, esquema)).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('rechaza respuestas con forma inesperada', async () => {
    const fetch = vi.fn().mockResolvedValue(json({ ok: false }));
    const cliente = crearClienteCima({ fetch, intervaloMs: 0 });
    await expect(cliente.obtener(url, esquema)).rejects.toThrow('forma inesperada');
  });

  it('separa las peticiones al menos `intervaloMs`', async () => {
    const fetch = vi.fn().mockImplementation(async () => json({ ok: true }));
    const esperas: number[] = [];
    const cliente = crearClienteCima({
      fetch,
      intervaloMs: 500,
      esperar: async (ms) => void esperas.push(ms),
    });
    await Promise.all([cliente.obtener(url, esquema), cliente.obtener(url, esquema)]);
    expect(esperas).toHaveLength(1);
    expect(esperas[0]).toBeGreaterThan(0);
    expect(esperas[0]).toBeLessThanOrEqual(500);
  });
});
