import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { gunzipSync, brotliDecompressSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

let webDist: string;
let app: ReturnType<typeof buildApp>;
const bundleGrande = 'console.log("archivo ficticio para comprobar compresión");\n'.repeat(500);

beforeAll(async () => {
  webDist = mkdtempSync(join(tmpdir(), 'rebotica-web-'));
  mkdirSync(join(webDist, 'assets'));
  writeFileSync(join(webDist, 'index.html'), '<!doctype html><title>Rebotica 3D</title>');
  writeFileSync(join(webDist, 'assets', 'index-abc123.js'), 'console.log(1)');
  writeFileSync(join(webDist, 'assets', 'grande-abc123.js'), bundleGrande);
  writeFileSync(join(webDist, 'favicon.svg'), '<svg/>');
  app = buildApp({ webDist });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  const ruta = resolve(webDist);
  if (dirname(ruta) !== resolve(tmpdir()) || !basename(ruta).startsWith('rebotica-web-'))
    throw new Error('Ruta temporal no válida');
  rmSync(webDist, { recursive: true, force: true });
});

describe('API sirviendo la web', () => {
  it.each(['gzip', 'br'])(
    'comprime JavaScript con %s y conserva su contenido y caché',
    async (encoding) => {
      const res = await app.inject({
        method: 'GET',
        url: '/assets/grande-abc123.js',
        headers: { 'accept-encoding': encoding },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-encoding']).toBe(encoding);
      expect(String(res.headers.vary).toLowerCase()).toContain('accept-encoding');
      expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
      const descomprimido =
        encoding === 'br' ? brotliDecompressSync(res.rawPayload) : gunzipSync(res.rawPayload);
      expect(descomprimido.toString()).toBe(bundleGrande);
      expect(res.rawPayload.length).toBeLessThan(Buffer.byteLength(bundleGrande));
    },
  );
  it('sin negociación conserva la respuesta sin comprimir', async () => {
    const res = await app.inject({ method: 'GET', url: '/assets/grande-abc123.js' });
    expect(res.headers['content-encoding']).toBeUndefined();
    expect(res.body).toBe(bundleGrande);
  });

  it('sirve index.html en la raíz sin caché larga', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Rebotica 3D');
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('cachea un año los archivos con hash', async () => {
    const res = await app.inject({ method: 'GET', url: '/assets/index-abc123.js' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('revalida los archivos sin hash', async () => {
    const res = await app.inject({ method: 'GET', url: '/favicon.svg' });
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('devuelve la web en rutas de la SPA', async () => {
    const res = await app.inject({ method: 'GET', url: '/pasillo/fiebre' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Rebotica 3D');
  });

  it('mantiene el 404 en JSON para la API', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/no-existe' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'No encontrado' });
  });

  it('sigue respondiendo el health', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
  });

  it('añade cabeceras de seguridad', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('falla al arrancar si la carpeta no tiene index.html', () => {
    expect(() => buildApp({ webDist: tmpdir() + '/no-existe-rebotica' })).toThrow(/index.html/);
  });
});
