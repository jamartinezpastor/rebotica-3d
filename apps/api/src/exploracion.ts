import { CONSULTAS_FRECUENTES, ExplorarEntrada, type ProductoResumen } from '@rebotica/shared';
import type { FastifyInstance } from 'fastify';
import { CatalogoNoSincronizado, crearCatalogo, type BaseDatos } from './catalogo';
import { pasilloInformativo } from './pasilloInformativo';

/** Términos de búsqueda textual en 4.1, sin elegir principios activos ni inferir indicaciones. */
const TERMINOS: Record<(typeof CONSULTAS_FRECUENTES)[number]['id'], string[]> = {
  'dolor-cabeza': [
    'dolor de cabeza',
    'dolores de cabeza',
    'cefalea',
    'cefaleas',
    'migraña',
    'migrañas',
  ],
  fiebre: ['fiebre', 'estados febriles'],
  'resfriado-congestion': ['resfriado', 'congestión nasal', 'catarro', 'procesos catarrales'],
  'dolor-garganta': ['dolor de garganta', 'irritación de garganta', 'irritación de la garganta'],
  tos: ['tos', 'secreciones mucosas', 'secreciones bronquiales'],
  acidez: ['acidez', 'ardor de estómago', 'reflujo gastroesofágico'],
  diarrea: ['diarrea'],
  estrenimiento: ['estreñimiento'],
  'alergia-estacional': ['rinitis alérgica', 'rinoconjuntivitis alérgica'],
  picaduras: ['picaduras'],
  'quemadura-solar': ['quemaduras solares', 'quemadura solar'],
  'herpes-labial': ['herpes labial', 'herpes simple labial'],
  'dolor-muscular': ['dolor muscular', 'dolores musculares', 'contracturas', 'lumbalgia'],
  piojos: ['pediculosis', 'piojos'],
};
const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function mencionaDolencia(texto: string, id: keyof typeof TERMINOS): boolean {
  const contenido = ` ${normalizar(texto)} `;
  return TERMINOS[id].some((t) => contenido.includes(` ${normalizar(t)} `));
}

export function registrarExploracion(app: FastifyInstance, db?: BaseDatos) {
  const catalogo = db ? crearCatalogo(db) : null;
  const clasificar = (texto: string): NonNullable<ProductoResumen['clasificacion']>['consultas'] =>
    CONSULTAS_FRECUENTES.filter((c) => mencionaDolencia(texto, c.id)).map((c) => ({
      id: c.id,
      titulo: c.etiqueta,
    }));
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
      return pasilloInformativo(productos, 'catalogo', 'Catálogo de medicamentos');
    },
  );
  app.route({
    method: ['POST', 'GET', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE'],
    url: '/api/explorar',
    logLevel: 'silent',
    bodyLimit: 1024,
    onRequest: async (_req, reply) => {
      reply.header('Cache-Control', 'no-store');
    },
    errorHandler: (error, _req, reply) => {
      if (error instanceof CatalogoNoSincronizado)
        return reply.code(503).send({
          error: 'El catálogo aún no está sincronizado',
          codigo: 'CATALOGO_NO_SINCRONIZADO',
        });
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
      );
    },
  });
}
