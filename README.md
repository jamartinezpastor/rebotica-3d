# Rebotica 3D

Consejo farmacéutico visual para síntomas leves: cuentas qué te pasa, recorres un pasillo 3D con
los productos sin receta adecuados y consultas la ficha técnica oficial. Los medicamentos que
necesitan receta aparecen en una vitrina diferenciada, con aviso de precaución y ficha completa.

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

La portada ya permite entrar con «Explorar demostración 3D» o «Explorar como lista», sin
necesitar catálogo sincronizado ni base de datos. Abre el pasillo ficticio con vitrina; «Inicio»
permite volver a la portada. La entrada de síntomas y el triaje corresponden a F4-01–F4-03.

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

- Catálogo sin receta y con receta con presentaciones, fotos y secciones 4.1–4.7. Los
  medicamentos con receta se sirven en la vitrina y no se mezclan con las baldas sin receta.
- Pasada diaria: relee los medicamentos con cambios en la ficha técnica, el estado, la
  comercialización o el suministro. Si cambia la sección 4.2, sus reglas de dosis pasan a `revisar`
  y la calculadora se oculta hasta que un farmacéutico las revise.
- Lo que pasa a receta se mueve a la vitrina y sus reglas pasan a `revisar`; lo que deja de
  comercializarse sale de ambas zonas (`comerc = false`).
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

Levanta la API con una base de datos en memoria (PGlite), descarga de CIMA hasta 18 medicamentos
de cada catálogo con sus fichas y fotos, extrae la paleta de sus envases, monta un pasillo de ejemplo y
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

Con ratón, el cursor del lienzo es un modelo 3D de un guante, con palma, dedos articulados,
perspectiva, iluminación y sombras propias. Se dibuja con Three.js sobre el mismo contexto WebGL
del pasillo, sin SVG ni otro lienzo. Está abierta al recorrer el pasillo y se cierra al arrastrar,
también al girar la caja en la ficha. Se inclina suavemente al cambiar de
dirección y vuelve a reposo al detenerse. Con menos movimiento no se inclina; con entrada táctil
o colores forzados se conserva el cursor nativo. Fuera de la mano 3D, el ratón se representa
con un punto verde que se ilumina y emite un halo y destellos al pasar por botones, enlaces
y otros controles pulsables. Con menos movimiento conserva el brillo, sin destellos.
Al pasar por un medicamento seleccionable, en 3D o en lista, el punto cambia a un ojo verde
con resplandor. Al arrastrar en el lienzo vuelve la mano cerrada; sobre el resto del pasillo,
la mano abierta.

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
oficial en texto: la calculadora solo aparece con una regla validada y vigente.

Selección: tocar una caja (o Enter sobre la que tiene delante la cámara) la hace salir de la balda
y volar hasta la cámara, mientras el resto se apaga tras un velo blanco; en la ficha gira despacio.
«Volver al pasillo», pulsar fuera de la ficha, Escape y el botón atrás del navegador reproducen
el vuelo al revés. Arrastrar para girar la caja no cierra la ficha. Un
arrastre nunca selecciona: solo cuenta un toque que se mueve menos de 8 px.

## Vitrina con receta

Cambio de alcance del 19/10/2026 respecto al plan original: los medicamentos sujetos a
prescripción permiten las mismas acciones que el resto (selección, ficha con pestañas y caja
3D), conservando el diseño actual de las cajas Canvas. Se agrupan en una estructura propia,
oscura y con frisos ámbar, cristal translúcido y letreros «Requiere receta». La vista lista y la
ficha incluyen el aviso de precaución y de no iniciar ni cambiar tratamientos sin indicación
médica. El motor de dosis (F3-02) y su interfaz (F3-03) están implementados para ambos catálogos;
solo se habilitan con reglas validadas y vigentes. La derivación por alarmas sigue teniendo prioridad.

- Vista ficticia: `/escena?vitrina=1` (o `&vista=lista`), sin descargar datos clínicos.
- `pnpm demo` incluye también productos reales con receta de CIMA en la vitrina.
- Al actualizar una instalación existente, ejecutar una sincronización `--completo` para cargar
  las fichas y fotos con receta que antes no se almacenaban; la API aplica la nueva migración
  al arrancar. El job debe ejecutarse después de que esas migraciones estén aplicadas.

## Agrupación del pasillo

El selector «Agrupar por» reorganiza las mismas cajas en 3D y en lista: orden original,
farmacéutica/laboratorio titular, tipo de fármaco (categoría terapéutica de CIMA), uso infantil,
enfermedades y consultas comunes, principio activo, forma farmacéutica y genéricos (EFG).
Conserva la elección al alternar entre vistas. Se puede abrir con `?agrupar=laboratorio`,
`tipo`, `infantil`, `consultas`, `principio`, `forma` o `generico`.

- Los productos con receta permanecen en una vitrina independiente en todos los modos.
- Cada balda tiene como máximo seis cajas para evitar pérdidas al agrupar muchos productos.
- No se añade ni se recomienda un producto por agruparlo; se reorganiza el pasillo ya servido.
- Uso infantil: solo se indica una edad mínima si hay una regla validada y vigente con tramo
  pediátrico. No equivale a indicación para cualquier niño; se mantienen las restricciones de
  edad, peso y condiciones de la ficha. Sin esa regla aparece «Sin uso infantil verificado».
- Consultas/enfermedades: asociaciones de los últimos protocolos firmados, por principio activo
  y separando baldas y vitrina. No se deducen del nombre ni de palabras de la ficha técnica.
  Sin protocolo firmado aparece «Sin protocolo clínico validado». Si hay varias consultas,
  se muestran juntas para evitar duplicar una misma caja.
- La demostración ficticia tiene varios laboratorios y tipos. No inventa clasificaciones
  pediátricas o enfermedades: esas agrupaciones reflejarán los datos revisados cuando existan.

## Calculadora en la ficha — F3-03

La pestaña Dosis carga la calculadora en diferido cuando la API entrega una regla. Antes de
mostrar controles se comprueba firma, estado, registro, hash de la sección 4.2 y cita literal.
Si faltan, permanece la posología en texto. No hay reglas clínicas de producción incorporadas.

Los sliders y campos numéricos permiten indicar edad (0–1200 meses, presentada en años a partir
de dos años) y peso (3–150 kg). No se calcula con valores de paciente preseleccionados: hay que
introducir ambos y elegir el motivo. Las condiciones y otros medicamentos aplican los bloqueos
y avisos de la regla. El resultado muestra cantidad por toma, intervalo mínimo, máximos diarios,
días antes de consultar, versión y fuente literal, más un esquema de jeringa o unidades reales.
El esquema no reproduce la escala de un dispositivo dosificador concreto.

Un bloqueo o una entrada fuera de tramo elimina la pauta. Un peso fuera de referencia requiere
confirmación; esta se invalida al editar los datos. Al cambiar de producto se borra el formulario.
Edad, peso y condiciones no se envían al servidor, no se guardan y no se añaden a la URL.
Los tests de interfaz usan reglas ficticias. F3-04 incorpora
[cinco semillas de curación](packages/dosis/data/reglas/README.md) en `borrador`, verificadas
contra CIMA y sin firma. `pnpm demo` incluye sus productos y muestra la banda «Demostración:
pendiente de validación farmacéutica» en sus fichas, sin calculadora. Con PostgreSQL se cargan
opcionalmente al arrancar mediante `REGLAS_DOSIS_DIR` (en Docker, `/app/reglas-dosis`), después
de sincronizar el catálogo. Nunca sobrescriben versiones existentes. F6-01 sigue pendiente.

## API de datos

El paquete [`@rebotica/dosis`](packages/dosis/README.md) implementa el cálculo puro con reglas
validadas, cita literal y hash vigente de la sección 4.2. Incluye redondeo decimal hacia abajo,
límites por toma y por día, bloqueos y confirmación de peso con referencias OMS locales. Las
pruebas aritméticas de dosis usan solo reglas ficticias; las cinco semillas en borrador no son
reglas clínicas de producción.

| Ruta                             | Qué devuelve                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `GET /api/pasillos/:id`          | Baldas sin receta y vitrina con receta, ambas con productos y condición de prescripción |
| `GET /api/productos/:nregistro`  | Ficha: secciones 4.1–4.7, presentaciones, enlaces a CIMA y regla de dosis vigente       |
| `GET /media/miniaturas/:archivo` | Miniatura del envase, con caché inmutable                                               |

- El pasillo acepta el perfil del triaje: `?grupo=nino&edadMeses=30&condiciones=asma,ulcera`.
- `estado: "borrador"` en un pasillo obliga a la UI a mostrar la banda de demostración.
- Un medicamento no comercializado no tiene ficha: `404`. Los que requieren receta devuelven
  `receta: true`, también en los resúmenes del pasillo.
- `reglaDosis` solo viaja si la regla está `validada` y su hash coincide con la 4.2 actual.
- Los resúmenes incorporan `clasificacion` para las agrupaciones revisadas. Las secciones de la
  ficha incluyen su `hash` actual para verificar la calculadora en el navegador.
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
