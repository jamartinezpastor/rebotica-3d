import { buildApp } from './app';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const app = buildApp({
  // Detrás del proxy de Coolify (Traefik): respeta X-Forwarded-For y X-Forwarded-Proto.
  fastify: { logger: true, trustProxy: true },
  webDist: process.env.WEB_DIST || undefined,
});

const cerrar = async () => {
  await app.close();
  process.exit(0);
};
process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
