# Imagen única de Rebotica 3D: la API de Fastify sirve también la web estática (mismo dominio,
# sin CORS) e incluye el job de sincronización con CIMA para lanzarlo como tarea programada.

ARG NODE_VERSION=22

# ---------- build: instala todo el monorepo y compila web, API y job ----------
FROM node:${NODE_VERSION}-alpine AS build
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true
RUN corepack enable
WORKDIR /repo

# Primero solo los manifiestos, para que la capa de dependencias se reutilice entre builds.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/dosis/package.json packages/dosis/
COPY packages/protocolos/package.json packages/protocolos/
COPY jobs/sync-cima/package.json jobs/sync-cima/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @rebotica/web --filter @rebotica/api --filter @rebotica/sync-cima build \
 && pnpm --filter @rebotica/api deploy --prod --legacy /out/api \
 && pnpm --filter @rebotica/sync-cima deploy --prod --legacy /out/sync-cima

# ---------- runtime: solo lo necesario para ejecutar ----------
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    WEB_DIST=/app/public \
    MIGRATIONS_DIR=/app/migrations \
    ASSETS_DIR=/data/assets
WORKDIR /app

COPY --from=build --chown=node:node /out/api ./api
COPY --from=build --chown=node:node /repo/apps/web/dist ./public
COPY --from=build --chown=node:node /repo/packages/db/migrations ./migrations
COPY --from=build --chown=node:node /out/sync-cima ./jobs/sync-cima

# El generador de texturas dibuja texto con SVG: necesita una fuente instalada en el sistema.
RUN apk add --no-cache fontconfig ttf-dejavu \
 && mkdir -p /data/assets \
 && chown node:node /data/assets

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "api/dist/server.js"]
