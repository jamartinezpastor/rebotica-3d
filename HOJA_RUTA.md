# Rebotica 3D — próximos pasos

Actualizada el 24/10/2026. Complementa el plan original y sus cambios de alcance; el recorrido
principal es un catálogo informativo por dolencia. Los medicamentos con receta conservan su
zona diferenciada y su ficha completa. Agrupar no elimina productos.

Cada paso se implementa y verifica por separado, con `pnpm check` antes de cerrarlo. Las
validaciones manuales se registran como pendientes hasta realizarlas.

| Paso | Ticket        | Entrega y criterio de cierre                                                                                                                                                                                                                                                   | Estado                   |
| ---- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| 1    | F5-02         | JavaScript inicial inferior a 250 kB gzip; Lighthouse móvil ≥90 en CI; escenas reales con un número acotado de cajas; conteos agregados de consultas por dolencia, sin texto ni identificadores de personas.                                                                   | Completado               |
| 2    | F1-06         | Estado verificable de sincronización y cobertura de indicaciones 4.1. Evaluar consultas conocidas, distinguir carga parcial de ausencia de coincidencias y documentar correspondencias textuales. No inferir indicaciones ni ampliar por principio activo.                     | Completado               |
| 3    | F5-04         | Buscar por nombre o principio activo dentro del resultado; filtros explícitos por forma, laboratorio y genérico; contador y quitar filtros; conservar posición al volver de una ficha y entre vistas. Sin filtros iniciales ocultos.                                           | Completado               |
| 4    | F2-08         | Saltar a un grupo, cargar solo cajas cercanas, reutilizar geometrías y materiales y adaptar calidad al dispositivo. Conservar acceso a todos los medicamentos y la separación de receta. Medir también consultas con muchos resultados.                                        | Completado               |
| 5    | F5-05         | Mejorar jerarquía de nombres y principios activos, fotos oficiales ampliables, controles compactos, siluetas de carga y transiciones entre páginas. Distinguir la foto oficial de la representación 3D generada. Refinar luces, sombras y etiquetas sin sobrecargar la escena. | Completado               |
| 6    | F5-06         | Comparar dos fichas con datos oficiales y su condición de receta. Sin rankings, equivalencias de dosis ni recomendaciones personalizadas.                                                                                                                                      | Completado               |
| 7    | F5-03         | Completar privacidad, uso de Gemini, fuentes y versiones de reglas en un lugar accesible. Conservar la portada limpia y describir el comportamiento real del almacenamiento y las métricas.                                                                                    | Pendiente                |
| 8    | F5-01 / F2-06 | Comprobar lector de pantalla, teclado, zoom, instalación iOS/Android y movimiento reducido; medir fps en un móvil de referencia. Las pruebas automáticas no sustituyen estos resultados.                                                                                       | Pendiente de dispositivo |
| 9    | F6-01 a F6-03 | Revisión y firma farmacéutica de reglas y protocolos que se activen, prueba con 5–8 personas y decisión documentada del alcance de lanzamiento. Sin regla validada y vigente no hay calculadora.                                                                               | Pendiente                |

## Base ya implementada

Monorepo, despliegue, CIMA local y sincronización reanudable; catálogo real por dolencia y
exploración general; interpretación con Gemini y filtro de alarmas; fichas y prospectos completos;
motor de dosis determinista; vista 3D y lista, agrupación, accesibilidad básica y PWA. La última
comprobación anterior a esta hoja de ruta pasó 632 tests.

F4-05 («Pedir cita») está descartado. El cuestionario clínico no bloquea la navegación informativa.
La parafarmacia del plan inicial requiere su propio catálogo curado y se planificará por separado
si se mantiene esa ampliación.

## Orden de trabajo

F5-02, F1-06, F5-04, F2-08, F5-05 y F5-06 están implementados. El siguiente paso es F5-03:
privacidad, uso de Gemini, fuentes y versiones de reglas. La
validación farmacéutica y las pruebas con personas requieren participantes reales; no se dan por
completadas mediante código ni datos ficticios.

## Verificación de F5-02 — 24/10/2026

- `pnpm check` correcto: 643 tests, formato, lint, tipos, build y presupuesto inicial.
- JavaScript inicial: 111 120 bytes gzip, incluido el registro de PWA; límite inferior a 250 000.
- `pnpm rendimiento` correcto: 99/100 en las tres mediciones Lighthouse móviles de la portada
  compilada, con contenido principal alrededor de 2 s. La primera medición fue 87; habilitar
  Brotli/gzip en el servidor corrigió el envío de archivos sin compresión. No se rebajó el umbral.
- La CI queda configurada para ejecutar Lighthouse y conservar informes como artefactos. Su
  ejecución remota corresponde al siguiente push; los resultados anteriores son comprobaciones locales.
- Máximo de 36 productos por página 3D real, también para consultas grandes; la lista por dolencia
  conserva todas las coincidencias. La demo explícita permite mediciones con otras cantidades.
- Conteos diarios en `consulta_conteo`, sin eventos individuales ni datos personales. La nueva
  migración crea solo esa tabla; se aplica al arrancar la API o el catálogo local actualizado.
- Sigue pendiente medir fps en dispositivos reales y comprobar la instalación móvil y lectores
  de pantalla. El resultado de Lighthouse no sustituye estas pruebas.

## Verificación de F1-06 — 24/10/2026

- `pnpm check` correcto: 672 tests, formato, lint, tipos y build. JavaScript inicial: 111,85 kB gzip.
- Copia local evaluada sin sincronizar: 16 100 medicamentos, 14 591 con indicaciones consultables
  y 1 509 sin sección 4.1 disponible. Estado completo según la marca de agua del 23/10/2026.
- Para dolor de cabeza: 30 coincidencias sin receta y 248 con receta en esa copia. No son
  cantidades fijas ni una validación de idoneidad clínica.
- Estado de la copia desplegable junto a los resultados; búsquedas vacías diferenciadas de una
  carga parcial. El índice vacío inicial se invalida para recuperar las primeras indicaciones
  guardadas sin esperar a la caducidad de la caché.
- Informe `pnpm cobertura`, con modo `--local` y explicación por `--registro`; las 14 consultas
  usan las mismas correspondencias textuales que la API. La versión 1 no amplía indicaciones.
- Metadatos optativos para conservar la compatibilidad de versiones anteriores de la PWA.
- Contratos, criterios, límites y resultado de la evaluación en [docs/COBERTURA.md](docs/COBERTURA.md).

## Verificación de F5-04 — 24/10/2026

- `pnpm check` correcto: 684 tests, formato, lint, tipos y build. JavaScript inicial: 113,51 kB gzip.
- Búsqueda local por nombre y principio activo, sin distinguir tildes ni mayúsculas, sobre todo
  el resultado antes de paginar. Filtros opcionales por forma farmacéutica, laboratorio e
  identificación EFG; contador de coincidencias y botón para quitar los filtros.
- No hay filtros iniciales ni nuevas peticiones para buscar. Las búsquedas, los filtros y la
  posición se mantienen en memoria; solo la preferencia de lista/3D se guarda como antes.
- Se conserva la separación de receta y la agrupación elegida. Una búsqueda sin coincidencias
  permite seguir escribiendo sin perder el foco y recuperar todos los productos al quitar filtros.
- Cerrar la ficha restaura el producto, la página y el desplazamiento. Al cambiar de vista,
  el medicamento visible determina la página y posición inicial del raíl o el retorno a lista.
- Revisado en Chrome con ventanas de 320, 390, 768 y 1440 píxeles, también con los filtros
  desplegados: sin desbordamiento horizontal. Comprobado el recorrido lista → 3D → ficha → lista
  con 80 productos ficticios: ficha correcta y mismo producto y desplazamiento al regresar.
- Estas comprobaciones de navegador no sustituyen las pruebas pendientes en móviles físicos.

## Verificación de F2-08 — 24/10/2026

- `pnpm check` correcto: 693 tests, formato, lint, tipos y build. JavaScript inicial: 113,78 kB gzip.
- Saltos al inicio de grupos de cualquier página, conservando búsqueda, agrupación y receta.
- Solo se montan las estanterías próximas: radio de dos en calidad normal y de una en ligera;
  la estantería de una ficha abierta se conserva hasta completar el vuelo de regreso. El raíl
  conserva todos los destinos de la página, aunque sus cajas todavía no estén montadas.
- Geometrías por forma, materiales del mismo envase, estructura y sombra compartidos dentro
  de la escena; liberación al salir del último usuario y al desmontar, incluida prueba en StrictMode.
- Calidad ligera inicial para equipos de capacidad baja y reducción automática al detectar lentitud:
  texturas con aproximadamente un cuarto de píxeles y DPR máximo 1. La ficha mantiene su resolución.
- En escenas con más estructuras que la ventana se evita la entrada escalonada de estructuras
  lejanas para que ningún salto quede esperando su animación.
- Chrome con viewport de 390 px y 200 productos ficticios: salto a la vitrina y selección por
  teclado correctos. Una muestra durante el recorrido registró 14 geometrías, 111 texturas GPU
  y 41 llamadas de dibujo. El contador `?fps=1` incluye estos recursos para medir en un móvil real.
- No se atribuyen los fps del navegador de pruebas a dispositivos físicos. Esa validación sigue pendiente.

## Verificación de F5-05 — 24/10/2026

- `pnpm check` correcto: 697 tests, formato, lint, tipos y build. JavaScript inicial: 114,97 kB gzip.
- Lista con nombres destacados y principio activo separado; imagen de carga y silueta cuando
  no hay foto o falla. Siluetas en la carga de catálogo y ficha, ocultas al lector de pantalla.
- Foto de CIMA ampliable en un diálogo nativo; cierre por botón, fondo o Escape con retorno
  del foco, conservando la ficha abierta. Se amplía la imagen disponible, sin inventar detalle.
- Barra compacta de 124 px en las ventanas comprobadas; «Grupos» y «Filtros» se despliegan
  de forma excluyente. Elegir un grupo cierra el desplegable y recupera el producto de destino.
- Fichas largas con contenido desplazable, Volver visible y enlaces oficiales accesibles.
  Avisos de receta y todas las secciones se conservan. La foto oficial se distingue del modelo
  3D generado mediante etiquetas explícitas.
- Transiciones breves al cambiar de página, desactivadas con menos movimiento. Iluminación
  y sombra de contacto más suaves y carteles largos en dos líneas, sin añadir sombras en tiempo real.
- Encuadre 3D adaptado al volumen del envase y al ancho de la pantalla para evitar recortes
  durante el giro. Prueba de las cinco formas con cuatro relaciones de aspecto y revisión en
  Chrome a 320 y 390 px.
- Con fotos y fichas ficticias de prueba: revisión en Chrome a 320, 390, 768 y 1440 px sin
  desbordamiento horizontal; diálogo de foto y Escape mantienen ficha y foco. Comprobado que
  la preferencia de menos movimiento elimina la transición de página.
- Las pruebas en dispositivos físicos, lectores de pantalla y con personas siguen pendientes.

## Verificación de F5-06 — 24/10/2026

- `pnpm check` correcto: 704 tests, formato, lint, tipos y build. JavaScript inicial: 115,88 kB gzip.
- «Añadir a comparación» desde una ficha; hasta dos medicamentos elegidos explícitamente y
  en ese orden. La selección se conserva entre páginas, filtros y lista/3D. Para añadir un
  tercero hay que quitar uno; se puede retirar desde su ficha o desde la barra de comparación.
- Comparación en columnas en escritorio y por pares de datos en móvil: principio activo,
  forma, laboratorio, categoría, EFG, pictograma de conducción y suministro. Textos oficiales
  disponibles de las secciones 4.1–4.7 y enlaces a prospecto y ficha técnica. Los resúmenes no
  sustituyen el texto oficial en esta vista.
- Medicamentos con receta diferenciados en cabecera y en los pares de datos, conservando
  el aviso de precaución. Posología en texto oficial, sin calculadoras, conversiones, rankings
  ni selección de tratamientos.
- Cada ficha se valida con el contrato y el registro solicitado. Errores y secciones ausentes
  se indican de forma independiente, sin ocultar la ficha que sí esté disponible ni inventar datos.
- Diálogo nativo con Escape y retorno del foco; ampliar una foto y cerrarla mantiene abierta
  la comparación. El módulo de comparación se carga en diferido.
- Selección solo en memoria: no se escribe en URL ni almacenamiento, se borra al salir de
  la página y al restaurar una página desde bfcache. Comparar solo consulta la API local de fichas.
- Chrome con fichas y fotos ficticias de prueba, en 320, 390, 768 y 1440 px: sin desbordamiento
  horizontal ni solapamiento entre barra y paginación; retorno de foco, fotos y uso desde 3D
  comprobados. Las pruebas de dispositivo físico y lector de pantalla siguen pendientes.

### Ajustes de interfaz solicitados — 24/10/2026

- Cursor verde visible en la comparación y en las fotos ampliadas: se dibuja dentro del
  diálogo activo de la capa superior y vuelve al catálogo al cerrarlo. Conserva el brillo de
  hover y no queda oculto por la mano 3D del fondo. Verificado en Chrome desde lista y 3D.
- Retirado el banner inferior «Catálogo informativo», incluido su desplegable de estado.
  Los diagnósticos de cobertura siguen disponibles mediante API y `pnpm cobertura`.
- `pnpm check` correcto: 706 tests, formato, lint, tipos y build. JavaScript inicial: 115,94 kB gzip.
