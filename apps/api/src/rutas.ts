import {
  PasilloResponse,
  PerfilPasillo,
  ProductoResponse,
  type BaldaPasillo,
  type ErrorResponse,
} from '@rebotica/shared';
import type { FastifyInstance } from 'fastify';
import { crearCatalogo, type BaseDatos } from './catalogo';
import { protocoloPublicado } from './protocolos';

/** Los datos se renuevan cada noche: los navegadores pueden reutilizar la respuesta unos minutos. */
const CACHE_DATOS = 'public, max-age=300, stale-while-revalidate=3600';

const error = (mensaje: string): ErrorResponse => ({ error: mensaje });
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NREGISTRO = /^[A-Za-z0-9]{1,16}$/;

export function registrarRutas(app: FastifyInstance, db: BaseDatos | undefined): void {
  if (!db) {
    app.get('/api/pasillos/:id', async (_req, reply) =>
      reply.code(503).send(error('Base de datos no disponible')),
    );
    app.get('/api/productos/:nregistro', async (_req, reply) =>
      reply.code(503).send(error('Base de datos no disponible')),
    );
    return;
  }
  const catalogo = crearCatalogo(db);

  app.get<{ Params: { id: string }; Querystring: Record<string, string> }>(
    '/api/pasillos/:id',
    async (request, reply) => {
      const { id } = request.params;
      if (!SLUG.test(id)) return reply.code(400).send(error('Identificador de pasillo no válido'));
      const perfil = PerfilPasillo.safeParse(request.query);
      if (!perfil.success) return reply.code(400).send(error('Perfil no válido'));
      const { grupo, edadMeses, condiciones = [] } = perfil.data;

      const publicado = await protocoloPublicado(db, id);
      if (!publicado) return reply.code(404).send(error('Pasillo no encontrado'));
      const { protocolo, estado } = publicado;

      const visibles = protocolo.baldas
        .filter((b) => {
          if (grupo && b.gruposExcluidos.includes(grupo)) return false;
          if (
            edadMeses !== undefined &&
            b.edadMinMeses !== undefined &&
            edadMeses < b.edadMinMeses
          ) {
            return false;
          }
          return !b.condicionesExcluidas.some((c) => condiciones.includes(c));
        })
        .sort((a, b) => a.orden - b.orden);

      const baldas: BaldaPasillo[] = [];
      for (const b of visibles) {
        baldas.push({
          titulo: b.titulo,
          principioActivo: b.principioActivo,
          orden: b.orden,
          productos: await catalogo.productosDe(b.principioActivo),
        });
      }

      const vitrina = [];
      for (const g of protocolo.vitrina) {
        vitrina.push({
          principioActivo: g.principioActivo,
          formas: await catalogo.formasConReceta(g.principioActivo),
          paraQueSeUsa: g.paraQueSeUsa,
          porQueNecesitaReceta: g.porQueNecesitaReceta,
          situacion: g.situacion,
        });
      }

      // Se valida la salida con el mismo contrato que usa la web: un fallo aquí es un bug nuestro.
      const respuesta = PasilloResponse.parse({
        id: protocolo.id,
        version: protocolo.version,
        titulo: protocolo.titulo,
        estado,
        baldas,
        ocultasPorPerfil: protocolo.baldas.length - visibles.length,
        vitrina,
        consejos: protocolo.consejos,
        parafarmacia: protocolo.parafarmacia,
      });
      return reply.header('Cache-Control', CACHE_DATOS).send(respuesta);
    },
  );

  app.get<{ Params: { nregistro: string } }>(
    '/api/productos/:nregistro',
    async (request, reply) => {
      const { nregistro } = request.params;
      if (!NREGISTRO.test(nregistro)) {
        return reply.code(400).send(error('Número de registro no válido'));
      }
      const ficha = await catalogo.ficha(nregistro);
      // Los medicamentos con receta no tienen ficha: ni existen para esta API (principio 1).
      if (!ficha) return reply.code(404).send(error('Producto no encontrado'));
      return reply.header('Cache-Control', CACHE_DATOS).send(ProductoResponse.parse(ficha));
    },
  );
}
