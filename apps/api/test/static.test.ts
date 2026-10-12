import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

let webDist: string;
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  webDist = mkdtempSync(join(tmpdir(), 'rebotica-web-'));
  mkdirSync(join(webDist, 'assets'));
  writeFileSync(join(webDist, 'index.html'), '<!doctype html><title>Rebotica 3D</title>');
  writeFileSync(join(webDist, 'assets', 'index-abc123.js'), 'console.log(1)');
  writeFileSync(join(webDist, 'favicon.svg'), '<svg/>');
  app = buildApp({ webDist });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  rmSync(webDist, { recursive: true, force: true });
});

describe('API sirviendo la web', () => {
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
