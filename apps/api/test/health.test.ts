import { HealthResponse } from '@rebotica/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

const app = buildApp();
afterAll(() => app.close());

describe('GET /api/health', () => {
  it('responde ok con el contrato compartido', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = HealthResponse.parse(res.json());
    expect(body.status).toBe('ok');
  });

  it('devuelve 404 en rutas desconocidas', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/no-existe' });
    expect(res.statusCode).toBe(404);
  });
});
