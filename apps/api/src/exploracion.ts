import {
  CONSULTAS_FRECUENTES,
  ExplorarEntrada,
  ExplorarRespuesta,
  type BaldaPasillo,
  type ProductoResumen,
} from '@rebotica/shared';
import type { FastifyInstance } from 'fastify';
import { CatalogoNoSincronizado, crearCatalogo, type BaseDatos } from './catalogo';

/** Términos de búsqueda textual en 4.1, sin elegir principios activos ni inferir indicaciones. */
const TERMINOS: Record<(typeof CONSULTAS_FRECUENTES)[number]['id'], string[]> = {
  'dolor-cabeza': ['dolor de cabeza', 'cefalea', 'migraña'],
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
      const productos = await catalogo.buscarIndicaciones((texto) =>
        mencionaDolencia(texto, consultaId),
      );
      const grupos = (receta: boolean) => {
        const mapa = new Map<string, ProductoResumen[]>();
        for (const p of productos.filter((p) => p.receta === receta)) {
          const clave = normalizar(p.principioActivo);
          mapa.set(clave, [...(mapa.get(clave) ?? []), p]);
        }
        return [...mapa.values()].sort((a, b) =>
          a[0]!.principioActivo.localeCompare(b[0]!.principioActivo, 'es'),
        );
      };
      const baldas: BaldaPasillo[] = grupos(false).map((ps, i) => ({
        titulo: ps[0]!.principioActivo,
        principioActivo: ps[0]!.principioActivo,
        orden: i + 1,
        productos: ps,
      }));
      return ExplorarRespuesta.parse({
        id: consultaId,
        version: 1,
        titulo: CONSULTAS_FRECUENTES.find((c) => c.id === consultaId)!.etiqueta,
        estado: 'informativo',
        baldas,
        ocultasPorPerfil: 0,
        vitrina: grupos(true).map((ps) => ({
          principioActivo: ps[0]!.principioActivo,
          productos: ps,
          formas: [...new Set(ps.flatMap((p) => (p.forma ? [p.forma] : [])))],
          paraQueSeUsa: 'Consulta las indicaciones completas en la ficha oficial.',
          porQueNecesitaReceta: 'Requiere prescripción médica.',
          situacion: 'Su aparición aquí no indica que sea adecuado para ti.',
        })),
        consejos: [],
        parafarmacia: [],
      });
    },
  });
}
