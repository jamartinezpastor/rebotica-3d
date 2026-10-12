import { aplicarMigraciones, conectar } from '@rebotica/db';
import { buildApp } from './app';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const app = buildApp({
  // Detrás del proxy de Coolify (Traefik): respeta X-Forwarded-For y X-Forwarded-Proto.
  fastify: { logger: true, trustProxy: true },
  webDist: process.env.WEB_DIST || undefined,
});

// Sin DATABASE_URL la API arranca igual: /api/health no necesita base de datos.
const conexion = process.env.DATABASE_URL ? conectar(process.env.DATABASE_URL) : undefined;

const cerrar = async () => {
  await app.close();
  await conexion?.pool.end();
  process.exit(0);
};
process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);

try {
  if (conexion) {
    await aplicarMigraciones(
      conexion.db,
      process.env.MIGRATIONS_DIR ?? '../../packages/db/migrations',
    );
    app.log.info('migraciones aplicadas');
  }
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
