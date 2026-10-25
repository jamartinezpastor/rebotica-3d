import { Writable } from 'node:stream';
import { expect, it, vi } from 'vitest';
import { InformacionPublica, VERSION_CORRESPONDENCIAS } from '@rebotica/shared';
import { buildApp } from '../src/app';
import type { BaseDatos } from '../src/catalogo';
import pkg from '../package.json' with { type: 'json' };
import dosis from '../../../packages/dosis/package.json' with { type: 'json' };

it('publica versiones reales y disponibilidad de interpretación sin depender de CIMA o Gemini', async () => {
  const clasificar = vi.fn();
  const app = buildApp({ interpretacion: { clasificar } });
  try {
    const r = await app.inject({ method: 'GET', url: '/api/informacion' });
    expect(r.statusCode).toBe(200);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(InformacionPublica.parse(r.json())).toEqual({
      versionApp: pkg.version,
      versionMotorDosis: dosis.version,
      versionCorrespondencias: VERSION_CORRESPONDENCIAS,
      interpretacionConfigurada: true,
      catalogo: null,
    });
    expect(clasificar).not.toHaveBeenCalled();
  } finally {
    await app.close();
  }
});
it('no inventa un catálogo sincronizado ni una interpretación activa cuando no están disponibles', async () => {
  const app = buildApp();
  try {
    const d = InformacionPublica.parse((await app.inject('/api/informacion')).json());
    expect(d.interpretacionConfigurada).toBe(false);
    expect(d.catalogo).toBeNull();
  } finally {
    await app.close();
  }
});
it('un fallo de la base conserva los metadatos y no filtra el error interno', async () => {
  const db = {
    select() {
      throw new Error('CONEXION_PRIVADA_FICTICIA');
    },
  } as unknown as BaseDatos;
  const app = buildApp({ db });
  try {
    const r = await app.inject('/api/informacion');
    expect(r.statusCode).toBe(200);
    expect(InformacionPublica.parse(r.json()).catalogo).toBeNull();
    expect(r.body).not.toContain('CONEXION_PRIVADA');
  } finally {
    await app.close();
  }
});
it('rechaza consultas adicionales sin registrarlas ni devolverlas', async () => {
  let logs = '';
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      logs += String(chunk);
      callback();
    },
  });
  const app = buildApp({ fastify: { logger: { stream } } });
  try {
    const r = await app.inject('/api/informacion?texto=MARCADOR_PRIVADO_FICTICIO');
    expect(r.statusCode).toBe(400);
    expect(r.body).not.toContain('MARCADOR_PRIVADO');
    expect(logs).not.toContain('MARCADOR_PRIVADO');
  } finally {
    await app.close();
  }
});
