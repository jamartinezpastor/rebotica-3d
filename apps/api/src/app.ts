import { HealthResponse } from '@rebotica/shared';
import Fastify, { type FastifyServerOptions } from 'fastify';
import pkg from '../package.json' with { type: 'json' };

export function buildApp(options: FastifyServerOptions = {}) {
  const app = Fastify(options);

  app.get('/api/health', async () =>
    HealthResponse.parse({
      status: 'ok',
      version: pkg.version,
      time: new Date().toISOString(),
    }),
  );

  return app;
}
