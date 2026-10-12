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

| Variable       | Por defecto    | Para qué                                                 |
| -------------- | -------------- | -------------------------------------------------------- |
| `PORT`         | `3000`         | Puerto HTTP                                              |
| `WEB_DIST`     | `/app/public`  | Carpeta de la web compilada; vacía, la API no la sirve   |
| `DATABASE_URL` | —              | PostgreSQL; la API aplica las migraciones al arrancar    |
| `ASSETS_DIR`   | `/data/assets` | Carpeta persistente de fotos y atlas (montar un volumen) |

El job se lanza dentro del contenedor con `node jobs/sync-cima/dist/index.js` (tarea programada
diaria en Coolify). Necesita `DATABASE_URL` y solo habla con CIMA:

| Invocación   | Qué hace                                                                 |
| ------------ | ------------------------------------------------------------------------ |
| (sin opción) | Primera vez: sincronización completa. Después: solo los cambios de CIMA. |
| `--completo` | Fuerza la sincronización completa.                                       |
| `--limite N` | Ensayo con N medicamentos; no avanza la marca de la última pasada.       |

- Catálogo sin receta con presentaciones y secciones 4.1–4.7, más los grupos con receta (solo
  principio activo) para la vitrina.
- Pasada diaria: relee los medicamentos con cambios en la ficha técnica, el estado, la
  comercialización o el suministro. Si cambia la sección 4.2, sus reglas de dosis pasan a `revisar`
  y la calculadora se oculta hasta que un farmacéutico las revise.
- Lo que pasa a receta o deja de comercializarse sale de las baldas (`comerc = false`).
- La marca de la última pasada (`sync_estado`) solo avanza si no hubo errores.
- Con `ASSETS_DIR` definido, genera tras la sincronización la cara frontal de cada producto (foto
  del embalaje de CIMA o textura generada con el color del grupo terapéutico), la empaqueta en
  atlas KTX2 de 1024×1024 y rellena `asset_caja` con la URL del atlas, el rectángulo UV, el color
  dominante y la forma de la caja. Los atlas llevan en el nombre la huella del catálogo: se
  regeneran solo si algo cambia y se borran los antiguos. Las fotos descargadas se guardan en
  `ASSETS_DIR/fotos` y no se piden dos veces.
- Imprime un informe de recuento en JSON y sale con código 1 si hubo errores.
- Ritmo de 4 peticiones por segundo (`CIMA_INTERVALO_MS`, 250 por defecto) y reintentos con espera
  creciente ante 429 y 5xx.

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
