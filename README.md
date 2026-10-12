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

| Variable         | Por defecto    | Para qué                                                      |
| ---------------- | -------------- | ------------------------------------------------------------- |
| `PORT`           | `3000`         | Puerto HTTP                                                   |
| `WEB_DIST`       | `/app/public`  | Carpeta de la web compilada; vacía, la API no la sirve        |
| `DATABASE_URL`   | —              | PostgreSQL; la API aplica las migraciones al arrancar         |
| `ASSETS_DIR`     | `/data/assets` | Carpeta persistente de fotos y miniaturas (montar un volumen) |
| `PROTOCOLOS_DIR` | —              | Carpeta con los JSON de protocolos que se cargan al arrancar  |

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
- Con `ASSETS_DIR` definido, genera tras la sincronización el aspecto de cada caja: descarga la
  miniatura del envase que publica CIMA (como máximo 200 px), extrae su paleta de colores y guarda
  una miniatura WebP servible. Rellena `asset_caja` con la paleta, el color dominante, la forma de
  la caja y la ruta de la miniatura. Las fotos descargadas se guardan en `ASSETS_DIR/fotos` y no
  se piden dos veces; las miniaturas llevan en el nombre la huella de su contenido.
- Imprime un informe de recuento en JSON y sale con código 1 si hubo errores.
- Ritmo de 4 peticiones por segundo (`CIMA_INTERVALO_MS`, 250 por defecto) y reintentos con espera
  creciente ante 429 y 5xx.

## Demo con datos reales (sin PostgreSQL)

```bash
pnpm demo
```

Levanta la API con una base de datos en memoria (PGlite), descarga de CIMA unos 18 medicamentos
sin receta con sus fichas y fotos, extrae la paleta de sus envases, monta un pasillo de ejemplo y
arranca la web. Tarda un par de minutos la primera vez (las fotos se guardan en la carpeta
temporal del sistema y se reutilizan). Cuando veas «API lista», abre:

- <http://localhost:5173/escena?pasillo=demo>: pasillo con cajas reales y ficha con el texto
  oficial en las pestañas Uso, Precauciones y Dosis.
- `DEMO_MEDICAMENTOS=40 pnpm demo` cambia la cantidad (4 a 120).

El protocolo que monta es un borrador de demostración: no es clínico ni está validado. Ctrl+C
para pararlo.

## Vista de desarrollo de la escena 3D

`pnpm dev` y abre `http://localhost:5173/escena`: estantería con productos ficticios. Con
`?pasillo=<id>` coloca los productos reales de `/api/pasillos/<id>` (necesita la API con la base
de datos sincronizada; `pnpm demo` lo monta).

**Cómo se dibuja una caja.** Las cajas no llevan la foto pegada: CIMA solo publica miniaturas de
hasta 200 px y en perspectiva, que quedan borrosas y raras sobre una cara plana. Cada caja se
genera en el navegador con Canvas 2D a partir de los datos del producto y de los colores de su
envase, así que el texto sale nítido a cualquier zoom. Las seis caras llevan información:

| Cara              | Contenido                                                                   |
| ----------------- | --------------------------------------------------------------------------- |
| Frente            | Nombre, principio activo, dosis, forma farmacéutica, EFG y aviso conducción |
| Trasera           | Ficha: principio activo, dosis, forma, categoría, laboratorio y avisos      |
| Lateral izquierdo | Nombre y dosis · forma, girados a lo largo de la cara                       |
| Lateral derecho   | Categoría y laboratorio titular                                             |
| Tapa y base       | Nombre y dosis / laboratorio y categoría                                    |

La foto real de CIMA se ve en la vista lista y en la cabecera de la ficha.

La cámara viaja por un raíl, no es libre:

| Entrada                 | Acción                                                             |
| ----------------------- | ------------------------------------------------------------------ |
| Arrastrar en horizontal | Mueve la cámara con inercia y se ajusta al producto más cercano    |
| Arrastrar en vertical   | Cambia de balda (dedo arriba = baja, como al desplazar una página) |
| Flechas ← →             | Producto anterior o siguiente                                      |
| Flechas ↑ ↓             | Balda superior o inferior                                          |
| Inicio / Fin            | Primer o último producto de la balda                               |
| Rueda o trackpad        | Un golpe = un producto (horizontal) o una balda (vertical)         |

Con `prefers-reduced-motion` la cámara salta al destino sin muelle.

### Vista lista y rendimiento

- **Vista lista:** el mismo pasillo como lista de botones (baldas con sus productos, etiquetas de
  genérico y conducción); elegir un producto abre la misma ficha. El botón «Ver como lista» / «Ver
  en 3D» está siempre visible.
- **Vista inicial:** `?vista=3d|lista` manda; si no, la preferencia guardada
  (`localStorage['rebotica.vista']`) y, si tampoco hay, la que recomienda el dispositivo. Sin WebGL,
  con renderizado por software, GPU antigua, ≤ 2 GB de memoria, ≤ 2 núcleos o ahorro de datos, la
  recomendada es la lista.
- **Aviso de lentitud:** si la escena va por debajo de 24 fps sostenidos se ofrece cambiar a la lista.
- **Medir en un dispositivo:** `/escena?vista=3d&fps=1&cajas=40` muestra un contador con los fps
  medios, el percentil 95 y el fotograma más largo mientras se arrastra la cámara. Criterio del plan:
  60 fps con 40 cajas en un Android de gama media.
- El JavaScript inicial no puede importar three (lo vigila `test/presupuesto.test.ts`).

La ficha lleva tres pestañas (Uso, Precauciones, Dosis) con el texto oficial de la ficha técnica
y enlaces al prospecto y a la ficha técnica en CIMA. La caja gira sola; se puede arrastrar para
girarla y a los 3 s sin tocarla vuelve a girar. La pestaña Dosis muestra siempre la posología
oficial en texto: la calculadora solo aparecerá con una regla validada y vigente.

Selección: tocar una caja (o Enter sobre la que tiene delante la cámara) la hace salir de la balda
y volar hasta la cámara, mientras el resto se apaga tras un velo blanco; en la ficha gira despacio.
«Volver al pasillo», Escape y el botón atrás del navegador reproducen el vuelo al revés. Un
arrastre nunca selecciona: solo cuenta un toque que se mueve menos de 8 px.

## API de datos

| Ruta                             | Qué devuelve                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------- |
| `GET /api/pasillos/:id`          | Baldas con productos por principio activo y vitrina con receta (sin marcas)       |
| `GET /api/productos/:nregistro`  | Ficha: secciones 4.1–4.7, presentaciones, enlaces a CIMA y regla de dosis vigente |
| `GET /media/miniaturas/:archivo` | Miniatura del envase (solo productos sin receta), con caché inmutable             |

- El pasillo acepta el perfil del triaje: `?grupo=nino&edadMeses=30&condiciones=asma,ulcera`.
- `estado: "borrador"` en un pasillo obliga a la UI a mostrar la banda de demostración.
- Un medicamento con receta o no comercializado no tiene ficha: `404`.
- `reglaDosis` solo viaja si la regla está `validada` y su hash coincide con la 4.2 actual.
- Los contratos (`PasilloResponse`, `ProductoResponse`…) están en `@rebotica/shared`.

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
