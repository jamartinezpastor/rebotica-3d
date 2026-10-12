import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

let carpeta: string;
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  carpeta = mkdtempSync(join(tmpdir(), 'rebotica-media-'));
  mkdirSync(join(carpeta, 'atlas'));
  mkdirSync(join(carpeta, 'fotos'));
  writeFileSync(join(carpeta, 'atlas', 'abc-0.ktx2'), 'KTX');
  writeFileSync(join(carpeta, 'fotos', '1-aa.img'), 'foto de CIMA');
  app = buildApp({ assetsDir: carpeta });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  rmSync(carpeta, { recursive: true, force: true });
});

describe('/media/atlas', () => {
  it('sirve los atlas con caché inmutable', async () => {
    const res = await app.inject({ method: 'GET', url: '/media/atlas/abc-0.ktx2' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toContain('immutable');
    expect(res.body).toBe('KTX');
  });

  it('no publica la caché de fotos ni permite salir de la carpeta', async () => {
    for (const url of [
      '/media/fotos/1-aa.img',
      '/media/atlas/../fotos/1-aa.img',
      '/media/atlas/',
      '/media/atlas/%2e%2e/fotos/1-aa.img',
    ]) {
      const res = await app.inject({ method: 'GET', url });
      // 403 en el listado de la carpeta, 404 en el resto: ninguno entrega el archivo.
      expect([403, 404], url).toContain(res.statusCode);
      expect(res.body).not.toContain('foto de CIMA');
    }
  });
});
