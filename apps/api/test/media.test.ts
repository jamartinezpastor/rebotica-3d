import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

let carpeta: string;
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  carpeta = mkdtempSync(join(tmpdir(), 'rebotica-media-'));
  mkdirSync(join(carpeta, 'miniaturas'));
  mkdirSync(join(carpeta, 'fotos'));
  writeFileSync(join(carpeta, 'miniaturas', '1-abc.webp'), 'miniatura');
  writeFileSync(join(carpeta, 'fotos', '1-aa.img'), 'foto de CIMA');
  app = buildApp({ assetsDir: carpeta });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  rmSync(carpeta, { recursive: true, force: true });
});

describe('/media/miniaturas', () => {
  it('sirve las miniaturas con caché inmutable', async () => {
    const res = await app.inject({ method: 'GET', url: '/media/miniaturas/1-abc.webp' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toContain('immutable');
    expect(res.body).toBe('miniatura');
  });

  it('no publica la caché de fotos ni permite salir de la carpeta', async () => {
    for (const url of [
      '/media/fotos/1-aa.img',
      '/media/miniaturas/../fotos/1-aa.img',
      '/media/miniaturas/',
      '/media/miniaturas/%2e%2e/fotos/1-aa.img',
    ]) {
      const res = await app.inject({ method: 'GET', url });
      // 403 en el listado de la carpeta, 404 en el resto: ninguno entrega el archivo.
      expect([403, 404], url).toContain(res.statusCode);
      expect(res.body).not.toContain('foto de CIMA');
    }
  });
});
