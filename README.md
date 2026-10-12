# Rebotica 3D

Consejo farmacéutico visual para síntomas leves: cuentas qué te pasa, recorres un pasillo 3D con
los productos sin receta adecuados y calculas la dosis según la ficha técnica oficial. Lo que
necesita receta aparece en una vitrina cerrada que te invita a pedir cita con tu médico.

> Información orientativa. No sustituye la valoración de un médico o farmacéutico.

## Requisitos

- Node.js 22.12 o superior
- pnpm 10 (`corepack enable` lo activa con la versión del proyecto)

## Arranque

```bash
pnpm install
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:3000/api/health

## Comprobaciones

```bash
pnpm check   # formato, lint, tipos, tests y build; es lo mismo que ejecuta la CI
```

## Docker

Una sola imagen: la API sirve también la web compilada (mismo dominio, sin CORS) e incluye el job
de sincronización con CIMA.

```bash
docker build -t rebotica-3d .
docker run --rm -p 3000:3000 rebotica-3d
```

| Variable       | Por defecto   | Para qué                                               |
| -------------- | ------------- | ------------------------------------------------------ |
| `PORT`         | `3000`        | Puerto HTTP                                            |
| `WEB_DIST`     | `/app/public` | Carpeta de la web compilada; vacía, la API no la sirve |
| `DATABASE_URL` | —             | PostgreSQL; la API aplica las migraciones al arrancar  |

El job se lanza dentro del contenedor con `node jobs/sync-cima/index.js` (tarea programada en
Coolify a partir de F1-03).

## Despliegue

Producción: https://rebotica.martinezpastor.dev

| Pieza         | Configuración en Coolify                                                      |
| ------------- | ----------------------------------------------------------------------------- |
| Proyecto      | `rebotica`, entorno `production`                                              |
| Aplicación    | `rebotica-3d`, build pack Dockerfile, puerto 3000                             |
| Origen        | GitHub App `coolifyrebotica`, rama `main`; cada push a `main` despliega       |
| Healthcheck   | `GET http://127.0.0.1:3000/api/health` (con `localhost` falla: resuelve IPv6) |
| Base de datos | `rebotica-postgres` (PostgreSQL 17, sin puerto público)                       |
| Variables     | `DATABASE_URL` solo en tiempo de ejecución                                    |

## Documentación

- Plan del proyecto: https://claude.ai/code/artifact/8a917b01-db4d-45a1-a901-83b044842fd7
- Reglas para agentes de código: [CLAUDE.md](CLAUDE.md)
- Datos: [API REST de CIMA (AEMPS)](https://sede.aemps.gob.es/docs/CIMA-REST-API_1_19.pdf)
