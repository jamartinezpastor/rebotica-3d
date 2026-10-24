# Rebotica 3D

Catálogo informativo por dolencia: escribes qué te pasa o pulsas una consulta frecuente y recorres
un pasillo 3D con los medicamentos cuyas indicaciones oficiales mencionan ese tema. Los medicamentos que
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

La portada incluye un campo de texto de tres líneas y cuatro consultas frecuentes iniciales
(catorce al pulsar «Ver más consultas»). «Realizar consulta» aparece debajo del campo únicamente
cuando contiene texto. «Explorar medicamentos» abre el pasillo ficticio con vitrina, sin necesitar catálogo sincronizado
ni base de datos. Dentro se puede cambiar a la vista lista. El dictado está retirado de la interfaz.

### Mostrador y privacidad

Cambio de alcance del 20/10/2026: un clic en un chip abre el catálogo relacionado. Al escribir,
«Realizar consulta» valida hasta 2000 caracteres y envía el texto al filtro de alarmas y Gemini.
Si se identifica una dolencia, se abre directamente el catálogo;
si hay dudas se pide elegir una alternativa. Las alarmas sustituyen los productos por derivación.
No hay revisión intermedia ni cuestionario obligatorio en este recorrido informativo.

`POST /api/explorar` recibe únicamente el id cerrado del tema y busca términos en la sección
**4.1 (indicaciones)** de la copia local de CIMA. No busca en la posología ni elige medicamentos
por su nombre o por un protocolo en borrador. Solo incluye medicamentos comercializados, agrupa
alfabéticamente por principio activo y separa los de receta en la vitrina. Una coincidencia
documental no determina si un medicamento está indicado para una persona concreta. Se advierte
en el pasillo; los resultados vacíos se explican sin inventar productos.

El estado `informativo` se distingue de un protocolo `validado` o un `borrador`: no autoriza
tratamientos. Al pulsar un producto se conserva la ficha completa, fotos, caja 3D, pestañas Uso,
Precauciones y Dosis y enlaces a CIMA. La calculadora conserva sus requisitos de validación.
Texto y selección viven en memoria, sin almacenamiento, registros ni URL; nueva consulta y salida
cancelan las peticiones. Un error no abre automáticamente una demostración.

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

| Variable         | Por defecto    | Para qué                                                                      |
| ---------------- | -------------- | ----------------------------------------------------------------------------- |
| `PORT`           | `3000`         | Puerto HTTP                                                                   |
| `WEB_DIST`       | `/app/public`  | Carpeta de la web compilada; vacía, la API no la sirve                        |
| `DATABASE_URL`   | —              | PostgreSQL; la API aplica las migraciones al arrancar                         |
| `ASSETS_DIR`     | `/data/assets` | Carpeta persistente de fotos y miniaturas (montar un volumen)                 |
| `PROTOCOLOS_DIR` | —              | Carpeta con JSON de protocolos; en Docker, `/app/protocolos` (carga opcional) |

El job se lanza dentro del contenedor con `node jobs/sync-cima/dist/index.js` (tarea programada
diaria en Coolify). Necesita `DATABASE_URL` y solo habla con CIMA:

La base recién creada está vacía: desplegar la API aplica migraciones, pero no descarga el catálogo.
Ejecutar la primera carga antes de dar la consulta por disponible. En Coolify, crear una tarea
programada dentro de la aplicación, con el comando anterior, frecuencia `0 3 * * *` (zona horaria
del servidor) y un tiempo máximo de 36 000 segundos para la carga inicial. Comprobar el informe de
ejecución y que `/api/explorar` devuelve productos para una dolencia conocida. Las cargas siguientes
son incrementales; no lanzar otra mientras haya una en curso.

Si todavía no hay productos comercializados con indicaciones 4.1, `/api/explorar` devuelve
`503 CATALOGO_NO_SINCRONIZADO`. Una consulta sin coincidencias en una copia con indicaciones devuelve
`200` con listas vacías. Así la interfaz distingue la carga pendiente de la ausencia de coincidencias.

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
- La carga completa guarda su fecha de inicio y se reanuda tras una interrupción: reutiliza los
  medicamentos ya guardados en esa carga y continúa con los pendientes. El informe distingue
  descargados y reutilizados; `--completo` inicia una carga nueva. La pasada incremental posterior
  parte del inicio original, para recoger también los cambios ocurridos durante la carga.
- La respuesta oficial «No existen secciones para el medicamento indicado» conserva los datos
  del medicamento sin bloquear la carga. Sin texto 4.1 no se le asignan dolencias ni dosis por
  su nombre o por otro producto de su grupo.
- Con `ASSETS_DIR` definido, genera tras la sincronización el aspecto de cada caja: descarga la
  miniatura del envase que publica CIMA (como máximo 200 px), extrae su paleta de colores y guarda
  una miniatura WebP servible. Rellena `asset_caja` con la paleta, el color dominante, la forma de
  la caja y la ruta de la miniatura. Las fotos descargadas se guardan en `ASSETS_DIR/fotos` y no
  se piden dos veces; las miniaturas llevan en el nombre la huella de su contenido.
  Si falta alguna miniatura referenciada, se reconstruye aunque la huella del catálogo no cambie.
- Imprime un informe de recuento en JSON y sale con código 1 si hubo errores.
- Ritmo de 4 peticiones por segundo (`CIMA_INTERVALO_MS`, 250 por defecto) y reintentos con espera
  creciente ante 429 y 5xx.

## Catálogo completo en local (sin PostgreSQL externo)

```bash
pnpm catalogo
```

Arranca la web y la API con una base PGlite persistente en `.local/catalogo/`, ignorada por Git.
Descarga ambos catálogos de CIMA completos, sin límite ni muestra de marcas, y conserva los datos
y el progreso entre reinicios. La API sirve lo que ya hay en disco mientras sincroniza en segundo
plano. La primera carga puede durar horas: **hasta terminar, los resultados son parciales**.
Después aplica los cambios de CIMA al arrancar y cada 24 horas mientras esté abierto.
Las fotos se generan al acabar la pasada de datos. La consola muestra el progreso.

Usa `.env` para Gemini, como la demo. `PORT` cambia el puerto de API (3000 por defecto) y
`CATALOGO_DIR` permite elegir otro directorio de datos. Solo un proceso puede abrir ese directorio.
Detener la demo anterior antes de iniciar el catálogo en el mismo puerto.

## Cobertura y estado de la copia (F1-06)

El estado de la copia se consulta mediante los diagnósticos y el comando de cobertura: vacía,
parcial o completa según sus marcas de sincronización, con la fecha cubierta y el número de
medicamentos con indicaciones consultables. El banner inferior del catálogo se ha retirado.
Una búsqueda vacía en una copia parcial se presenta como provisional. Una copia
completa puede tener fichas sin sección 4.1 segmentada; estas siguen disponibles en el catálogo
general, pero no se les asignan dolencias por su nombre o principio activo.

```bash
pnpm cobertura                       # consulta la API propia en :3000
pnpm cobertura --registro 67968       # explica las coincidencias de un medicamento
pnpm cobertura --local               # lee la base persistente con el servidor detenido
```

`GET /api/catalogo/estado` y `GET /api/catalogo/cobertura` sirven los diagnósticos desde la copia
local, sin llamadas a CIMA ni Gemini. El informe cubre las 14 dolencias con los mismos términos
que usa la búsqueda y separa sin receta y con receta. Son coincidencias documentales, no una
medida de exhaustividad clínica. Detalles, limitaciones y verificación de la copia actual en
[docs/COBERTURA.md](docs/COBERTURA.md).

## Demo con muestra de datos reales (sin PostgreSQL)

```bash
pnpm demo
```

Levanta la API con una base de datos en memoria (PGlite), descarga de CIMA hasta 18 medicamentos
de cada catálogo, más una muestra de registros para explorar distintas indicaciones, con sus
fichas y fotos, extrae la paleta de sus envases y arranca la web. No requiere configurar PostgreSQL.
La API de demostración carga también la configuración de Gemini desde `.env` de la raíz. Los
chips funcionan sin Gemini; para texto libre se requiere su clave y activación. Abre la portada
para probar **dolencia → medicamentos → ficha completa**, o el pasillo general siguiente.
Tarda un par de minutos al arrancar (las fotos se guardan en la carpeta
temporal del sistema y se reutilizan). Cuando veas «API lista», abre:

- <http://localhost:5173/escena?pasillo=demo>: pasillo con cajas reales y ficha con el texto
  oficial en las pestañas Uso, Precauciones y Dosis.
- `DEMO_MEDICAMENTOS=40 pnpm demo` cambia la cantidad (4 a 120).

El protocolo que monta es un borrador de demostración: no es clínico ni está validado. Ctrl+C
para pararlo.

## Vista de desarrollo de la escena 3D

La portada y `/escena` abren el catálogo real de `/api/catalogo`: todos los medicamentos
comercializados de la copia local, separados entre sin receta y con receta, con acceso a sus fichas.
La exploración general se divide en páginas de 36 productos, tanto en 3D como en lista, para no
cargar miles de cajas simultáneamente. Los botones Anterior y Siguiente permiten recorrerlos todos;
agrupar vuelve a la primera página. Las consultas por dolencia conservan su colección completa
en lista; en 3D también se recorren en páginas de 36 cajas para acotar el trabajo de la GPU.
Si la API no está disponible se muestra un error; no se sustituyen por datos ficticios.

Para las pruebas visuales, abre `http://localhost:5173/escena?demo=1`: productos ficticios. Con
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

- **Comparación (F5-06):** «Añadir a comparación» en una ficha permite elegir hasta dos
  medicamentos. La barra conserva la selección entre páginas, filtros y vistas; «Comparar»
  abre sus datos oficiales en columnas en escritorio y por pares en móvil. Incluye textos
  completos disponibles de las secciones 4.1–4.7, enlaces oficiales y fotos ampliables, con
  la condición de receta diferenciada. Faltas de datos y errores se indican por separado.
  La posología se muestra como texto oficial; no hay rankings, conversiones ni calculadoras
  en esta vista. La selección vive solo en memoria y se borra al abandonar la página; no se
  escribe en URL ni almacenamiento. Se comprueba que cada ficha corresponde al registro pedido.
- **Grupos y recursos 3D (F2-08):** «Grupos» abre el salto al inicio de cualquier grupo del
  resultado, también en otras páginas. El raíl conserva todos los destinos y la GPU solo carga
  las estanterías próximas; conserva el original de una ficha durante su vuelo de regreso.
  La escena comparte geometrías, materiales y sombra y libera los recursos al dejar de usarlos.
  Equipos de capacidad baja empiezan con texturas ligeras y DPR máximo 1; la lentitud sostenida
  también activa esa reducción. La ficha mantiene su resolución. `?fps=1` incluye las geometrías,
  texturas GPU y llamadas de dibujo para comprobar el coste durante el recorrido.
- **Presentación y fotos (F5-05):** nombres y principios activos con jerarquía diferenciada,
  siluetas durante la carga y transiciones de página que respetan menos movimiento. Las fotos
  de CIMA se amplían desde la ficha, sin alterarlas ni aumentar su detalle; cerrar la foto
  devuelve el foco y mantiene la ficha abierta. Una foto fallida se sustituye por una silueta.
  El modelo 3D generado está identificado y su encuadre deja margen durante todo el giro,
  también en móvil vertical. Volver y los enlaces oficiales permanecen accesibles mientras
  el contenido de una ficha larga se desplaza.
- **Búsqueda y filtros (F5-04):** buscar por nombre o principio activo dentro de todos los
  resultados, antes de paginar. La búsqueda ignora tildes y mayúsculas. «Filtros» permite elegir
  forma farmacéutica, laboratorio e identificación EFG; el contador muestra las coincidencias
  y «Quitar filtros» recupera el resultado completo. No se aplican filtros por defecto ni se
  hacen peticiones adicionales. La separación de receta y la agrupación se conservan.
- **Volver al mismo punto:** cerrar una ficha restaura el foco y el desplazamiento. Al alternar
  lista y 3D, el medicamento visible determina la página y la posición del raíl. La búsqueda,
  los filtros y esta posición solo viven en memoria; no se guardan en la URL ni en almacenamiento.
- **Vista lista:** el mismo pasillo como lista de botones (baldas con sus productos, etiquetas de
  genérico y conducción); elegir un producto abre la misma ficha. El botón «Ver como lista» / «Ver
  en 3D» está siempre visible.
- **Vista inicial:** `?vista=3d|lista` manda; si no, la preferencia guardada
  (`localStorage['rebotica.vista']`) y, si tampoco hay, la que recomienda el dispositivo. Sin WebGL,
  con renderizado por software, GPU antigua, ≤ 2 GB de memoria, ≤ 2 núcleos o ahorro de datos, la
  recomendada es la lista.
- **Aviso de lentitud:** si la escena va por debajo de 24 fps sostenidos se ofrece cambiar a la lista.
- **Medir en un dispositivo:** `/escena?demo=1&vista=3d&fps=1&cajas=40` muestra un contador con los fps
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

- Vista ficticia: `/escena?demo=1&vitrina=1` (o `&vista=lista`), sin descargar datos clínicos.
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
- Consultas/enfermedades del catálogo informativo: coincidencias textuales en la sección 4.1
  local, separando baldas y vitrina. No se deducen del nombre ni del principio activo.
  Sin coincidencias aparece «Sin dolencia clasificada». Si hay varias consultas,
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

F4-02 incorpora `POST /api/interpretar`: filtro local de alarmas prioritario, clasificación
cerrada opcional con Gemini y validación de esquema. No decide tratamientos. La portada envía
el texto solo al pulsar Realizar consulta y navega al catálogo informativo. Configuración,
privacidad, pruebas y resultado de la evaluación real en [Interpretación](apps/api/INTERPRETACION.md).
F4-03 conserva las tarjetas y el [motor de triaje y derivación](apps/api/TRIAJE.md) para un futuro
recorrido clínico: solo un protocolo firmado y todas las respuestas confirmadas pueden autorizar
una recomendación mediante ese motor. El catálogo informativo no utiliza esa autorización.
Las alarmas y los errores bloquean la vista de productos. F4-04 incorpora los
[14 borradores de protocolos](packages/protocolos/data/README.md), con fuentes oficiales,
preguntas, criterios, baldas y grupos de vitrina. Se importan opcionalmente mediante
`PROTOCOLOS_DIR`, sin sustituir versiones existentes. Todos siguen sin firma, con revisión
pendiente: todavía no hay protocolos clínicos validados que autoricen recomendaciones clínicas.

Se descarta F4-05 («Pedir cita») por el cambio de alcance del 23/10/2026. El recorrido principal
es consulta → todos los medicamentos del catálogo comercializado cuya sección 4.1 coincida →
ficha y prospecto. No se recortan marcas ni productos por grupo, y la IA no selecciona los
medicamentos. La interfaz muestra el número de coincidencias y las agrupaciones conservan el
conjunto completo, separado entre sin receta y con receta. La agrupación por dolencias usa las
mismas coincidencias documentales, sin necesitar un protocolo clínico validado. La cobertura depende de completar
la sincronización y de que CIMA publique las indicaciones estructuradas de cada producto.

El paquete [`@rebotica/dosis`](packages/dosis/README.md) implementa el cálculo puro con reglas
validadas, cita literal y hash vigente de la sección 4.2. Incluye redondeo decimal hacia abajo,
límites por toma y por día, bloqueos y confirmación de peso con referencias OMS locales. Las
pruebas aritméticas de dosis usan solo reglas ficticias; las cinco semillas en borrador no son
reglas clínicas de producción.

| Ruta                             | Qué devuelve                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `POST /api/explorar`             | Catálogo informativo por `consultaId`, desde las indicaciones 4.1 de CIMA local         |
| `GET /api/catalogo`              | Catálogo general real, sin filtrar por dolencia, con baldas y vitrina separadas         |
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

## Accesibilidad e instalación (F5-01)

La vista lista conserva todos los medicamentos y anuncia su título al entrar. Incluye navegación
por teclado, enlace «Saltar al contenido» visible al recibir foco y foco visible en los controles.
La ficha devuelve el foco al producto al cerrarse; en lista funciona como diálogo modal, con el
fondo inerte, Tab dentro de la ficha y Escape para volver. En 3D se conserva el giro del envase.
El verde de los textos mantiene contraste AA sobre blanco, papel y verde claro. El pasillo
escucha los cambios de `prefers-reduced-motion` sin recargar: elimina entrada, muelles y giro
automático; se mantienen los gestos manuales. El cursor también evita destellos con esa preferencia.

La compilación de producción incluye manifiesto, iconos y service worker para instalar la app
desde un navegador compatible, mediante HTTPS o localhost. No añade un botón a la portada.
La caché solo guarda archivos estáticos de la aplicación; las consultas, fichas, resultados de API
y datos de la calculadora no se guardan en ella. Sin red puede abrirse la interfaz, pero consultar
medicamentos requiere conexión. Una nueva versión se activa al cerrar las ventanas anteriores,
sin recargar una consulta o calculadora abierta. El service worker está desactivado en `pnpm dev`.

Para comprobar la instalación local: `pnpm --filter @rebotica/web build` y
`pnpm --filter @rebotica/web preview --host 127.0.0.1`, manteniendo la API en el puerto 3000.
La revisión con un lector de pantalla real y la instalación en iOS/Android quedan como validación
manual de dispositivo; las pruebas automáticas cubren foco, teclado, contraste y cambios de movimiento.

## Rendimiento y conteos agregados (F5-02)

`pnpm check` incluye la comprobación del JavaScript inicial durante el build: sigue todos los
imports estáticos del manifiesto de Vite, suma el tamaño gzip de cada archivo una sola vez e
incluye el registro de la PWA. Falla a partir de 250 000 bytes. La escena 3D y la calculadora
diferidas quedan fuera de ese presupuesto inicial. El informe está en
`apps/web/dist/presupuesto-js.json`.

La API negocia Brotli o gzip para las respuestas de texto de más de 1 kB, incluidos JavaScript
y CSS. Conserva las políticas de caché y añade `Vary: Accept-Encoding`. No depende de que el
proxy del despliegue configure compresión ni cambia el tratamiento de las peticiones de entrada.

Después del build, `pnpm rendimiento` ejecuta tres mediciones Lighthouse con perfil móvil sobre
la portada compilada, con el servidor real de la aplicación en `127.0.0.1:4175`. No conecta con
CIMA, PostgreSQL ni Gemini: mide la carga de la portada, no los tiempos de interpretación o de
búsqueda. Requiere Chrome instalado; si no se detecta automáticamente, indicar su ejecutable en
`CHROME_PATH`. Falla si la mediana del rendimiento es inferior a 90. CI ejecuta ambas comprobaciones
y guarda los informes como artefactos durante 14 días. Los informes locales quedan en
`.lighthouseci/`, fuera de Git; no se publican en almacenamiento externo de Lighthouse.

La exploración real 3D monta como máximo 36 productos de la colección por página. La vista lista
por dolencia conserva todos sus resultados. El contador de fps indica las cajas de la página
dibujada. La demostración explícita permite otras cantidades para medir en dispositivos; estos
límites y Lighthouse no certifican por sí solos 60 fps en un móvil.

Cada respuesta correcta de `POST /api/explorar` incrementa un contador en `consulta_conteo`
después de enviar la respuesta. Solo guarda `dia` (UTC), `protocolo_id` (dolencia del catálogo) y
`total`, con una única fila por día y dolencia y actualización atómica. No escribe eventos
individuales, texto libre, perfiles, IP, cookies, identificadores de sesión ni cabeceras. No añade
peticiones de analítica desde el navegador ni usa servicios de terceros. El catálogo general y
las consultas rechazadas o fallidas no se cuentan. Un error de escritura no bloquea la consulta.

Los conteos representan solicitudes, no personas únicas ni tratamientos. Se consultan de forma
administrativa en PostgreSQL; no hay un endpoint público de estadísticas. Ejemplo de agregado:

```sql
SELECT dia, protocolo_id, total
FROM consulta_conteo
ORDER BY dia DESC, total DESC;
```

La migración `0006_whole_husk` añade esta tabla sin modificar medicamentos, reglas o protocolos.
La tabla histórica `consulta_evento` se conserva por compatibilidad, pero la app no escribe en ella.

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

- Próximos pasos y criterios de cierre: [HOJA_RUTA.md](HOJA_RUTA.md).
- Plan del proyecto: https://claude.ai/code/artifact/8a917b01-db4d-45a1-a901-83b044842fd7
- Reglas para agentes de código: [CLAUDE.md](CLAUDE.md)
- Datos: [API REST de CIMA (AEMPS)](https://sede.aemps.gob.es/docs/CIMA-REST-API_1_19.pdf)
