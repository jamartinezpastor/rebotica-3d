import type { FastifyInstance } from 'fastify';
import { InformacionPublica, VERSION_CORRESPONDENCIAS } from '@rebotica/shared';
import pkg from '../package.json' with { type: 'json' };
import dosis from '../../../packages/dosis/package.json' with { type: 'json' };
import type { BaseDatos } from './catalogo';
import { leerEstadoCatalogo } from './cobertura';

export function registrarInformacion(
  app: FastifyInstance,
  db: BaseDatos | undefined,
  interpretacionConfigurada: boolean,
) {
  app.get(
    '/api/informacion',
    {
      logLevel: 'silent',
      onRequest: async (_req, reply) => {
        reply.header('Cache-Control', 'no-store');
      },
      errorHandler: (_err, _req, reply) =>
        reply.code(503).send({ error: 'Información no disponible' }),
    },
    async (req, reply) => {
      if (Object.keys(req.query as object).length)
        return reply.code(400).send({ error: 'Consulta no válida' });
      const catalogo = db ? await leerEstadoCatalogo(db).catch(() => null) : null;
      return InformacionPublica.parse({
        versionApp: pkg.version,
        versionMotorDosis: dosis.version,
        versionCorrespondencias: VERSION_CORRESPONDENCIAS,
        interpretacionConfigurada,
        catalogo,
      });
    },
  );
}
