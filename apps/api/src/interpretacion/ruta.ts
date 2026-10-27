import {
  InterpretarEntrada,
  InterpretarCatalogoRespuesta,
  consultasDeIndicacion,
  prepararBusquedaIndicaciones,
} from '@rebotica/shared';
import type { FastifyInstance } from 'fastify';
import { detectarAlarmas, derivar } from './alarmas';
import { interpretar, type Clasificador } from './interpretar';
import { CatalogoNoSincronizado, crearCatalogo, type BaseDatos } from '../catalogo';
import { pasilloInformativo } from '../pasilloInformativo';
import { leerEstadoCatalogo } from '../cobertura';

export interface OpcionesInterpretacion {
  clasificar?: Clasificador;
  /** También se limita el tiempo si falla un transporte inyectado que ignore AbortSignal. */
  plazoMs?: number;
  maxEnCurso?: number;
}

export function registrarInterpretacion(
  app: FastifyInstance,
  { clasificar, plazoMs = 10000, maxEnCurso = 8 }: OpcionesInterpretacion = {},
  db?: BaseDatos,
) {
  let enCurso = 0;
  const catalogo = db ? crearCatalogo(db) : null;
  app.route({
    method: ['POST', 'GET', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE'],
    url: '/api/interpretar',
    // Silencia incluso los registros automáticos de petición/error, antes de leer el JSON.
    logLevel: 'silent',
    bodyLimit: 16384,
    onRequest: async (_req, reply) => {
      reply.header('Cache-Control', 'no-store');
    },
    errorHandler: (_error, _req, reply) => {
      const estado = _error.statusCode === 413 ? 413 : 400;
      reply.code(estado).send({ error: 'Consulta no válida', codigo: 'CONSULTA_INVALIDA' });
    },
    handler: async (req, reply) => {
      if (req.method !== 'POST') {
        return reply.code(405).header('Allow', 'POST').send({
          error: 'Usa POST con un cuerpo JSON',
          codigo: 'METODO_NO_PERMITIDO',
        });
      }
      // La consulta solo se acepta por JSON, nunca en la URL ni con campos adicionales.
      const entrada = InterpretarEntrada.safeParse(req.body);
      if (!entrada.success || Object.keys(req.query as object).length > 0) {
        return reply.code(400).send({ error: 'Consulta no válida', codigo: 'CONSULTA_INVALIDA' });
      }
      const { texto } = entrada.data;
      // Aun saturado o sin proveedor, el filtro local sigue funcionando.
      const alarma = derivar(detectarAlarmas(texto));
      if (alarma) return alarma;
      if (!clasificar) {
        return reply
          .code(503)
          .send({ error: 'Interpretación no disponible', codigo: 'NO_DISPONIBLE' });
      }
      if (enCurso >= maxEnCurso) {
        return reply.code(429).header('Retry-After', '10').send({
          error: 'Inténtalo de nuevo más tarde',
          codigo: 'OCUPADO',
        });
      }
      enCurso++;
      const controlador = new AbortController();
      let temporizador: ReturnType<typeof setTimeout> | undefined;
      const desconectar = () => controlador.abort();
      const cerrar = () => {
        if (!reply.raw.writableEnded) desconectar();
      };
      req.raw.once('aborted', desconectar);
      reply.raw.once('close', cerrar);
      try {
        const limite = new Promise<never>((_, reject) => {
          temporizador = setTimeout(() => {
            controlador.abort();
            reject(new Error('Plazo agotado'));
          }, plazoMs);
        });
        const resolver = async () => {
          const resultado = entrada.data.modo
            ? await interpretar(texto, clasificar, controlador.signal, 'catalogo')
            : await interpretar(texto, clasificar, controlador.signal);
          if (resultado.tipo !== 'busqueda') return resultado;
          if (controlador.signal.aborted) throw new Error('Consulta cancelada');
          if (!catalogo)
            return reply
              .code(503)
              .send({ error: 'Catálogo no disponible', codigo: 'CATALOGO_NO_CONFIGURADO' });
          let coincide: (texto: string) => boolean;
          try {
            coincide = prepararBusquedaIndicaciones(resultado.busqueda.terminos);
          } catch {
            // Una búsqueda excesivamente amplia tampoco autoriza un catálogo indiscriminado.
            return {
              tipo: 'aclaracion',
              confianza: 0,
              alternativas: [],
              datosExtraidos: {
                paraQuien: 'desconocido',
                grupo: null,
                edad: null,
                duracion: null,
              },
            };
          }
          const productos = await catalogo.buscarIndicaciones(coincide, consultasDeIndicacion);
          if (controlador.signal.aborted) throw new Error('Consulta cancelada');
          const estado = await leerEstadoCatalogo(db!);
          return InterpretarCatalogoRespuesta.parse({
            tipo: 'catalogo',
            // Identificador fijo: no incluir texto ni términos del modelo en URL, métricas o logs.
            pasillo: pasilloInformativo(
              productos,
              'consulta-texto',
              // No publicar texto libre del modelo: ni consejos ni posibles ecos del paciente.
              'Medicamentos relacionados con la consulta',
              estado,
            ),
          });
        };
        return await Promise.race([resolver(), limite]);
      } catch (error) {
        if (error instanceof CatalogoNoSincronizado) {
          const estado = db ? await leerEstadoCatalogo(db).catch(() => null) : null;
          return reply.code(503).send({
            error: 'Catálogo aún no disponible',
            codigo:
              estado?.estado === 'completo'
                ? 'CATALOGO_SIN_INDICACIONES'
                : 'CATALOGO_NO_SINCRONIZADO',
          });
        }
        // Sin fallback a un pasillo ni eco de la entrada o de errores del modelo.
        return reply
          .code(503)
          .send({ error: 'Interpretación no disponible', codigo: 'NO_DISPONIBLE' });
      } finally {
        clearTimeout(temporizador);
        req.raw.removeListener('aborted', desconectar);
        reply.raw.removeListener('close', cerrar);
        enCurso--;
      }
    },
  });
}
