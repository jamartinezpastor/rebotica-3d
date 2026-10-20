import { evaluarTriaje, protocoloEvaluable } from '@rebotica/protocolos';
import {
  ProtocoloConsulta,
  ProtocoloTriajeRespuesta,
  TriajeEntrada,
  TriajeRespuesta,
} from '@rebotica/shared';
import type { FastifyInstance } from 'fastify';
import { crearCatalogo, type BaseDatos } from './catalogo';
import { protocoloPublicado } from './protocolos';
import { construirPasillo } from './pasillo';

export function registrarTriaje(app: FastifyInstance, db?: BaseDatos) {
  const catalogo = db ? crearCatalogo(db) : null;
  app.get<{ Params: { id: string } }>('/api/protocolos/:id', {
    logLevel: 'silent',
    onRequest: async (_req, reply) => {
      reply.header('Cache-Control', 'no-store');
    },
    handler: async (req, reply) => {
      const id = ProtocoloConsulta.safeParse(req.params.id);
      if (!id.success || Object.keys(req.query as object).length)
        return reply.code(400).send({ error: 'Protocolo no válido' });
      if (!db) return reply.code(503).send({ error: 'Triaje no disponible' });
      const publicado = await protocoloPublicado(db, id.data);
      if (!publicado || publicado.estado !== 'validado' || !protocoloEvaluable(publicado.protocolo))
        return reply.code(503).send({ error: 'No hay un protocolo de triaje validado' });
      return ProtocoloTriajeRespuesta.parse({
        id: publicado.protocolo.id,
        version: publicado.protocolo.version,
        titulo: publicado.protocolo.titulo,
        preguntas: publicado.protocolo.preguntasTriaje,
      });
    },
    errorHandler: (_error, _req, reply) => reply.code(503).send({ error: 'Triaje no disponible' }),
  });
  app.route({
    method: ['POST', 'GET', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE'],
    url: '/api/triaje',
    logLevel: 'silent',
    bodyLimit: 16384,
    onRequest: async (_req, reply) => {
      reply.header('Cache-Control', 'no-store');
    },
    errorHandler: (_error, _req, reply) =>
      reply
        .code(
          _error.statusCode && _error.statusCode >= 400 && _error.statusCode < 500
            ? _error.statusCode
            : 503,
        )
        .send({ error: 'Triaje no disponible' }),
    handler: async (req, reply) => {
      if (req.method !== 'POST')
        return reply
          .code(405)
          .header('Allow', 'POST')
          .send({ error: 'Usa POST con un cuerpo JSON' });
      const entrada = TriajeEntrada.safeParse(req.body);
      if (!entrada.success || Object.keys(req.query as object).length)
        return reply.code(400).send({ error: 'Respuestas no válidas' });
      if (!db || !catalogo) return reply.code(503).send({ error: 'Triaje no disponible' });
      const publicado = await protocoloPublicado(db, entrada.data.protocoloId);
      if (!publicado || publicado.estado !== 'validado')
        return reply.code(503).send({ error: 'No hay un protocolo de triaje validado' });
      if (publicado.protocolo.version !== entrada.data.version)
        return reply
          .code(409)
          .send({ error: 'El protocolo ha cambiado. Empieza una nueva consulta.' });
      const r = evaluarTriaje(publicado.protocolo, entrada.data.respuestas);
      if (r.tipo === 'no-disponible')
        return reply
          .code(r.motivo === 'respuestas' ? 400 : 503)
          .send({ error: 'Triaje no disponible' });
      if (r.tipo !== 'apto') return TriajeRespuesta.parse(r);
      // La misma respuesta POST entrega el pasillo ya filtrado: los datos del paciente
      // nunca tienen que viajar en la URL del pasillo, historial o caché compartida.
      const pasillo = await construirPasillo(catalogo, publicado.protocolo, 'validado', r.perfil);
      return TriajeRespuesta.parse({
        tipo: 'recomendar',
        pasilloId: publicado.protocolo.id,
        version: publicado.protocolo.version,
        pasillo,
      });
    },
  });
}
