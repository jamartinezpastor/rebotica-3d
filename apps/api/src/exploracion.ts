import {
  CONSULTAS_FRECUENTES,
  ExplorarEntrada,
  consultasDeIndicacion,
  mencionaDolencia,
} from '@rebotica/shared';
import type { FastifyInstance } from 'fastify';
import { CatalogoNoSincronizado, crearCatalogo, type BaseDatos } from './catalogo';
import { pasilloInformativo } from './pasilloInformativo';
import { contarConsulta } from './analitica';
import { evaluarCobertura, leerEstadoCatalogo } from './cobertura';

// Compatibilidad con las comprobaciones existentes; la implementación es compartida con el informe.
export { mencionaDolencia } from '@rebotica/shared';

export function registrarExploracion(app: FastifyInstance, db?: BaseDatos) {
  const catalogo = db ? crearCatalogo(db) : null;
  const clasificar = consultasDeIndicacion;
  for (const [url, obtener] of [
    ['/api/catalogo/estado', leerEstadoCatalogo],
    ['/api/catalogo/cobertura', evaluarCobertura],
  ] as const)
    app.get(
      url,
      {
        logLevel: 'silent',
        onRequest: async (_req, reply) => {
          reply.header('Cache-Control', 'no-store');
        },
        errorHandler: (_error, _req, reply) =>
          reply.code(503).send({ error: 'Información de catálogo no disponible' }),
      },
      async (req, reply) => {
        if (Object.keys(req.query as object).length)
          return reply.code(400).send({ error: 'Consulta no válida' });
        if (!db) return reply.code(503).send({ error: 'Catálogo no disponible' });
        return obtener(db);
      },
    );
  app.get(
    '/api/catalogo',
    {
      logLevel: 'silent',
      onRequest: async (_req, reply) => {
        reply.header('Cache-Control', 'no-store');
      },
      errorHandler: (_error, _req, reply) =>
        reply.code(503).send({ error: 'Catálogo no disponible' }),
    },
    async (req, reply) => {
      if (Object.keys(req.query as object).length)
        return reply.code(400).send({ error: 'Consulta no válida' });
      if (!catalogo) return reply.code(503).send({ error: 'Catálogo no disponible' });
      const productos = await catalogo.todos(clasificar);
      if (!productos.length)
        return reply.code(503).send({ error: 'El catálogo aún no está sincronizado' });
      return pasilloInformativo(
        productos,
        'catalogo',
        'Catálogo de medicamentos',
        req.headers['x-rebotica-catalogo'] === '1' ? await leerEstadoCatalogo(db!) : undefined,
      );
    },
  );
  app.route({
    method: ['POST', 'GET', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE'],
    url: '/api/explorar',
    logLevel: 'silent',
    bodyLimit: 1024,
    // La respuesta ya está enviada: un fallo de métricas no retrasa ni bloquea el catálogo.
    onResponse: async (req, reply) => {
      if (!db || req.method !== 'POST' || reply.statusCode !== 200) return;
      const entrada = ExplorarEntrada.safeParse(req.body);
      if (entrada.success) await contarConsulta(db, entrada.data.consultaId).catch(() => {});
    },
    onRequest: async (_req, reply) => {
      reply.header('Cache-Control', 'no-store');
    },
    errorHandler: async (error, _req, reply) => {
      if (error instanceof CatalogoNoSincronizado) {
        const estado = db ? await leerEstadoCatalogo(db) : null;
        return reply.code(503).send(
          estado?.estado === 'completo'
            ? {
                error: 'La copia no contiene indicaciones consultables',
                codigo: 'CATALOGO_SIN_INDICACIONES',
              }
            : { error: 'El catálogo aún no está sincronizado', codigo: 'CATALOGO_NO_SINCRONIZADO' },
        );
      }
      return reply
        .code(
          error.statusCode && error.statusCode >= 400 && error.statusCode < 500
            ? error.statusCode
            : 503,
        )
        .send({ error: 'Catálogo no disponible', codigo: 'CATALOGO_NO_DISPONIBLE' });
    },
    handler: async (req, reply) => {
      if (req.method !== 'POST')
        return reply
          .code(405)
          .header('Allow', 'POST')
          .send({ error: 'Usa POST con un cuerpo JSON' });
      const entrada = ExplorarEntrada.safeParse(req.body);
      if (!entrada.success || Object.keys(req.query as object).length)
        return reply.code(400).send({ error: 'Consulta no válida' });
      if (!catalogo)
        return reply.code(503).send({
          error: 'Catálogo no disponible',
          codigo: 'CATALOGO_NO_CONFIGURADO',
        });
      const { consultaId } = entrada.data;
      const productos = await catalogo.buscarIndicaciones(
        (texto) => mencionaDolencia(texto, consultaId),
        clasificar,
      );
      return pasilloInformativo(
        productos,
        consultaId,
        CONSULTAS_FRECUENTES.find((c) => c.id === consultaId)!.etiqueta,
        req.headers['x-rebotica-catalogo'] === '1' ? await leerEstadoCatalogo(db!) : undefined,
      );
    },
  });
}
