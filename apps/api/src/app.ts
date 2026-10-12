import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import { HealthResponse } from '@rebotica/shared';
import Fastify, { type FastifyServerOptions } from 'fastify';
import pkg from '../package.json' with { type: 'json' };
import type { BaseDatos } from './catalogo';
import { registrarRutas } from './rutas';

export interface AppOptions {
  fastify?: FastifyServerOptions;
  /**
   * Carpeta con el build de `apps/web`. En producción la API sirve también la web, así todo vive
   * en el mismo dominio y `/api` no necesita CORS. En desarrollo la sirve Vite y esto queda vacío.
   */
  webDist?: string;
  /** Base de datos con el catálogo sincronizado; sin ella, las rutas de datos responden 503. */
  db?: BaseDatos;
  /**
   * Carpeta del job de assets. Solo se publica `atlas/` en `/media/atlas/`; la caché de fotos
   * descargadas de CIMA queda fuera.
   */
  assetsDir?: string;
}

/** Los archivos con hash de Vite no cambian nunca; el resto se revalida en cada visita. */
const CACHE_INMUTABLE = 'public, max-age=31536000, immutable';
const CACHE_REVALIDAR = 'no-cache';

export function buildApp({ fastify = {}, webDist, db, assetsDir }: AppOptions = {}) {
  const app = Fastify(fastify);

  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('X-Frame-Options', 'DENY');
  });

  app.get('/api/health', async () =>
    HealthResponse.parse({
      status: 'ok',
      version: pkg.version,
      time: new Date().toISOString(),
    }),
  );

  registrarRutas(app, db);

  if (assetsDir) {
    const atlas = join(assetsDir, 'atlas');
    // El job puede ejecutarse después de que la API arranque: la carpeta debe existir ya.
    mkdirSync(atlas, { recursive: true });
    // Los nombres llevan la huella del catálogo: nunca cambian de contenido.
    app.register(fastifyStatic, {
      root: atlas,
      prefix: '/media/atlas/',
      decorateReply: false,
      cacheControl: false,
      index: false,
      list: false,
      setHeaders: (reply) => reply.header('Cache-Control', CACHE_INMUTABLE),
    });
  }

  if (webDist) {
    if (!existsSync(join(webDist, 'index.html'))) {
      throw new Error(`WEB_DIST no contiene index.html: ${webDist}`);
    }

    app.register(fastifyStatic, {
      root: webDist,
      wildcard: false,
      cacheControl: false,
      setHeaders: (reply, ruta) => {
        const conHash = /[\\/]assets[\\/]/.test(ruta);
        reply.header('Cache-Control', conHash ? CACHE_INMUTABLE : CACHE_REVALIDAR);
      },
    });
  }

  app.setNotFoundHandler((request, reply) => {
    const esApi = request.url === '/api' || request.url.startsWith('/api/');
    const esNavegacion = request.method === 'GET' || request.method === 'HEAD';
    // Rutas de la SPA (p. ej. /pasillo/fiebre): devuelven la web y React decide qué pantalla mostrar.
    if (webDist && !esApi && esNavegacion) {
      return reply.header('Cache-Control', CACHE_REVALIDAR).sendFile('index.html');
    }
    return reply.code(404).send({ error: 'No encontrado' });
  });

  return app;
}
