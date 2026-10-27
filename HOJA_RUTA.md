# Rebotica 3D — próximos pasos

Actualizada el 26/10/2026. Complementa el plan original y sus cambios de alcance; el recorrido
principal es un catálogo informativo por dolencia. Los medicamentos con receta conservan su
zona diferenciada y su ficha completa. Agrupar no elimina productos.

Cambio del 26/10/2026: todos los resultados se muestran sin paginación en lista y en un pasillo
3D continuo. La carga de estanterías cercanas acota los recursos, sin recortar el resultado.
La zona de receta se dispone perpendicular al lateral sin receta, con puertas de cristal;
el ambiente lejano incorpora siluetas desenfocadas con movimiento opcional.

Cada paso se implementa y verifica por separado, con `pnpm check` antes de cerrarlo. Las
validaciones manuales se registran como pendientes hasta realizarlas.

| Paso | Ticket        | Entrega y criterio de cierre                                                                                                                                                                                                                                                   | Estado                                                  |
| ---- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| 1    | F5-02         | JavaScript inicial inferior a 250 kB gzip; Lighthouse móvil ≥90 en CI; escenas reales con un número acotado de cajas; conteos agregados de consultas por dolencia, sin texto ni identificadores de personas.                                                                   | Completado                                              |
| 2    | F1-06         | Estado verificable de sincronización y cobertura de indicaciones 4.1. Evaluar consultas conocidas, distinguir carga parcial de ausencia de coincidencias y documentar correspondencias textuales. No inferir indicaciones ni ampliar por principio activo.                     | Completado                                              |
| 3    | F5-04         | Organizar el resultado con el selector y salto de grupos, conservando todos los productos, posición y separación de receta. Búsqueda y filtros adicionales retirados por petición del 26/10/2026.                                                                              | Completado; alcance simplificado                        |
| 4    | F2-08         | Saltar a un grupo, cargar solo cajas cercanas, reutilizar geometrías y materiales y adaptar calidad al dispositivo. Conservar acceso a todos los medicamentos y la separación de receta. Medir también consultas con muchos resultados.                                        | Completado                                              |
| 5    | F5-05         | Mejorar jerarquía de nombres y principios activos, fotos oficiales ampliables, controles compactos, siluetas de carga y transiciones entre páginas. Distinguir la foto oficial de la representación 3D generada. Refinar luces, sombras y etiquetas sin sobrecargar la escena. | Completado                                              |
| 6    | F5-06         | Comparar dos fichas con datos oficiales y su condición de receta. Sin rankings, equivalencias de dosis ni recomendaciones personalizadas.                                                                                                                                      | Completado                                              |
| 7    | F5-03         | Información técnica de privacidad, uso de Gemini, fuentes y versiones de reglas en un lugar accesible. Conservar la portada limpia y describir el comportamiento real del almacenamiento y las métricas. Sin contacto público por decisión del usuario.                        | Completado                                              |
| 8    | F5-01 / F2-06 | Comprobar lector de pantalla, teclado, zoom, instalación iOS/Android y movimiento reducido; medir fps en un móvil de referencia. Las pruebas automáticas no sustituyen estos resultados.                                                                                       | Automático verificado; manual pendiente                 |
| 9    | F6-01         | Revisión y firma farmacéutica de reglas y protocolos que se activen. Sin regla validada y vigente no hay calculadora.                                                                                                                                                          | Expediente preparado; revisión profesional pendiente    |
| 10   | F6-02         | Prueba de usabilidad móvil con 5–8 personas, hallazgos y decisiones documentadas.                                                                                                                                                                                              | Guion y plantillas preparados; sesiones pendientes      |
| 11   | F6-03         | Decisión documentada del alcance de lanzamiento.                                                                                                                                                                                                                               | Análisis preparado; cualificación y decisión pendientes |

## Base ya implementada

Monorepo, despliegue, CIMA local y sincronización reanudable; catálogo real por dolencia y
exploración general; interpretación con Gemini y filtro de alarmas; fichas y prospectos completos;
motor de dosis determinista; vista 3D y lista, agrupación, accesibilidad básica y PWA. La última
comprobación anterior a esta hoja de ruta pasó 632 tests.

F4-05 («Pedir cita») está descartado. El cuestionario clínico no bloquea la navegación informativa.
La parafarmacia del plan inicial requiere su propio catálogo curado y se planificará por separado
si se mantiene esa ampliación.

## Orden de trabajo

F5-02, F1-06, F5-04, F2-08, F5-05, F5-06 y la información técnica de F5-03 están implementados.
El usuario ha decidido publicar solo información técnica, sin responsable ni correo público.
La revisión automática de la etapa 8 está implementada; siguen pendientes las comprobaciones
en móviles físicos, con lector de pantalla y zoom real del navegador. La
validación farmacéutica y las pruebas con personas requieren participantes reales; no se dan por
completadas mediante código ni datos ficticios.

El expediente técnico de F6-01 se prepara con `pnpm revision:clinica`. Reúne fuentes, versiones,
huellas y tareas pendientes sin alterar reglas ni protocolos. La siguiente acción de ese ticket
es la revisión profesional descrita en [docs/REVISION_CLINICA.md](docs/REVISION_CLINICA.md).

F6-02 tiene guion, criterios propuestos y plantillas en [docs/USABILIDAD_MOVIL.md](docs/USABILIDAD_MOVIL.md).
La siguiente acción es realizar las sesiones en móviles con personas reales.
El análisis preliminar de F6-03 está en [docs/ALCANCE_LANZAMIENTO.md](docs/ALCANCE_LANZAMIENTO.md):
la dirección de producto sigue siendo el catálogo informativo elegido, con cualificación y
decisión de lanzamiento pendientes. Las capacidades clínicas y la instalación objetivo deben
evaluarse expresamente; la existencia de los documentos no completa las validaciones humanas.

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

## Verificación de F5-03 — 24/10/2026

- `pnpm check` correcto: 716 tests, formato, lint, tipos y build. JavaScript inicial: 116,55 kB gzip.
- Página `/informacion` cargada en diferido, con enlaces discretos desde portada, filtros,
  fichas y comparación. La portada mantiene el input de tres líneas, sin reponer el aviso
  sobre Gemini junto al formulario ni el banner inferior del catálogo.
- Explicación del flujo de chips y texto, filtro local, Gemini, memoria de pestaña, preferencia
  de vista, cachés, conteos diarios y registros técnicos. Retención de Google diferenciada de
  la ausencia de almacenamiento del texto en la app, con enlaces a fuentes oficiales.
- `GET /api/informacion` devuelve versiones reales de paquetes y correspondencias,
  configuración de interpretación y estado local del catálogo. Sin secretos, consultas al
  proveedor ni registros de solicitudes; salida validada y `no-store`. La página sigue legible
  si el endpoint o la BD no están disponibles.
- Id, versión, firma, fecha, cita y huella de las reglas validadas consultables antes de
  rellenar la calculadora. Los metadatos de borradores se identifican sin habilitar cálculos.
- Edad, peso, motivo, condiciones y confirmación de peso se limpian también en `pagehide`
  y al restaurar desde bfcache. Los tests usan únicamente reglas y datos ficticios.
- Revisada en Chrome a 320, 390, 768 y 1440 px, incluidos detalles abiertos: sin desbordamiento
  horizontal. Acceso directo, errores de metadatos y navegación por teclado cubiertos por pruebas.
- El usuario ha decidido el 25/10 publicar solo información técnica, sin responsable ni correo
  público; la página no se presenta como aviso identificativo completo. La configuración
  de retención del proyecto de Google y del alojamiento no se ha verificado desde el código.
- Fuentes, alcance y datos tratados en [docs/PRIVACIDAD.md](docs/PRIVACIDAD.md). Las pruebas con
  móviles físicos, lector de pantalla y personas, y la validación farmacéutica siguen pendientes.

## Avance de F5-01 / F2-06 — 25/10/2026

- `pnpm check` correcto: 717 tests, formato, lint, tipos y build. JavaScript inicial: 116,86 kB gzip.
- `pnpm rendimiento` correcto: 99/100 en las tres mediciones Lighthouse móviles de la portada
  compilada, con LCP entre 1,96 y 1,98 s. Son mediciones locales, no fps de un móvil físico.
- Nuevo `pnpm validar:ui`: servidor de producción temporal sin BD ni credenciales, catálogo
  ficticio, axe, recorridos de teclado, reflow, movimiento reducido y comprobaciones PWA.
  Informes y capturas locales en `.local/validacion-ui/`, ignorados por Git.
- 16 revisiones en Chrome sin incidencias automáticas. El informe conserva los casos que
  axe no puede resolver y que requieren revisión manual; no es una certificación WCAG.
- Corregidos los controles que tapaban productos en ventanas bajas, el desplazamiento
  de fichas y comparaciones, la visibilidad del foco y el nombre accesible de las fotos.
  Escape ya no retrocede por una entrada antigua cuando no hay ficha abierta.
- Manifiesto e iconos disponibles; service worker controla la portada, que abre al recargar
  sin red. Cache Storage no contiene rutas de datos `/api` ni `/media`.
- Lector de pantalla real, zoom real, instalación iOS/Android y fps en móvil físico siguen
  pendientes. Guion, evidencias automáticas y límites en [docs/VALIDACION_UI.md](docs/VALIDACION_UI.md).

## Preparación de F6-01 — 26/10/2026

- `pnpm revision:clinica` genera un expediente JSON y Markdown en `.local/revision-clinica/`:
  versiones, huellas de archivo, fuentes, estados y firmas declarados y tareas editoriales.
  Sin cargar `.env`, conectarse a servicios o modificar los JSON clínicos.
- Inventario actual: cinco reglas y catorce protocolos, diecinueve borradores, ninguna firma
  declarada y cero errores técnicos de estructura. No comprueba vigencia CIMA ni identidad
  profesional y no publica reglas o protocolos.
- Detecta archivos inválidos, identidades duplicadas y cobertura incompleta de protocolos;
  conserva el resto del expediente y devuelve error ante problemas técnicos.
- Guion y acta pendiente de completar en [docs/REVISION_CLINICA.md](docs/REVISION_CLINICA.md).
  F6-01 sigue abierto hasta la revisión profesional; F6-02 y F6-03 permanecen pendientes.
- `pnpm check` correcto: 724 tests, formato, lint, tipos y build. JavaScript inicial: 116,86 kB gzip.

## Preparación de F6-02 — 26/10/2026

- Guion de sesiones móviles de 30–35 minutos con 5–8 personas, seis tareas principales y
  escenarios ficticios. Incluye chip/texto, lista/3D, ficha y prospecto, organización de resultados
  y comparación con separación de receta; las tareas adicionales se registran aparte.
- Plantillas vacías de sesión y síntesis, con tiempos, evidencia, ayuda y fallos técnicos;
  notas individuales en `.local/piloto-usabilidad/`, sin telemetría nueva en la app.
- Objetivos propuestos de finalización sin ayuda y tiempo a primera ficha, con denominadores
  explícitos y revisión de confusiones sobre receta y alcance informativo.
- Materiales en [docs/USABILIDAD_MOVIL.md](docs/USABILIDAD_MOVIL.md). No se han realizado sesiones
  ni registrado resultados. F6-02 sigue abierto; la preparación no sustituye el piloto real.
- Enlaces locales comprobados y `pnpm check` correcto: 724 tests, formato, lint, tipos y build.
  JavaScript inicial: 116,86 kB gzip. Son comprobaciones técnicas, no resultados del piloto.

## Preparación de F6-03 — 26/10/2026

- Finalidad documental propuesta y matriz del comportamiento real: búsqueda local, clasificación,
  alarmas, comparación, calculadora condicional y rutas clínicas registradas.
- Comparación de los caminos A/B/C. La dirección funcional elegida sigue siendo B, sin dar por
  acreditada la exclusión del MDR, asignar una clase o aprobar un lanzamiento.
- Referencias primarias del MDR, MDCG 2019-11 rev.1 (junio de 2025) y AEMPS; cuestiones de
  cualificación, dependencias entre módulos y estado de la instalación pendientes de revisión.
- Análisis y registro de decisión final en [docs/ALCANCE_LANZAMIENTO.md](docs/ALCANCE_LANZAMIENTO.md).
  F6-03 sigue abierto. No se modifican funciones, variables, contenido clínico ni despliegues.
- Enlaces locales comprobados y `pnpm check` correcto: 724 tests, formato, lint, tipos y build.
  JavaScript inicial: 116,86 kB gzip. Estas pruebas no acreditan cualificación ni conformidad legal.

## Ajustes solicitados de grupos y arrastre — 26/10/2026 (F5-04 / F2-04)

- Retirados el campo de búsqueda y los filtros adicionales. Se mantienen el selector de
  agrupación y el salto a grupo, con todos los productos y la separación de receta. El código
  y las pruebas exclusivos del filtrado se eliminan; el foco vuelve al selector al vaciar la comparación.
- Corregido el sentido durante el arrastre vertical: el desplazamiento provisional usaba el
  signo opuesto al ajuste al soltar. Ahora el contenido acompaña al dedo en ambos sentidos y
  continúa hacia la balda correspondiente. Se conserva el comportamiento horizontal, rueda y teclado.
- `pnpm check` correcto: 719 tests, formato, lint, tipos y build; 116,00 kB gzip iniciales.
  El recuento elimina siete casos de la búsqueda/filtros retirados y añade dos regresiones del gesto.
- `pnpm validar:ui`: 16 revisiones sin incidencias automáticas. Chrome con viewport móvil
  y eventos táctiles: arrastre vertical arriba/abajo, ajuste al soltar y retorno a lista con
  40 productos ficticios correctos, sin selección accidental. Capturas en `.local/gestos-movil/`.
  Es emulación en escritorio; no completa la validación física de F5-01/F2-06.
- Guion de usabilidad y documentación actualizados para organizar resultados solo con grupos.

## Catálogo sin paginación — 26/10/2026 (F2-08 / F5-02)

- Retirada la división en tramos de 36 productos y sus controles Anterior/Siguiente, tanto del
  catálogo general como de las consultas por dolencia, en lista y 3D. Todos los productos forman
  un único recorrido con salto a grupo, conservación de identidad y regreso desde la ficha.
- Se mantiene la ventana de estanterías cercanas: el modelo y el raíl conservan todos los destinos
  y solo se montan los próximos. Una prueba con 278 productos verifica que ninguno desaparece,
  que las estructuras no mezclan receta y que la ventana normal sin ficha no supera 90 cajas.
- `pnpm check` correcto: 719 tests, formato, lint, tipos y build. Se retira el test de paginación
  y se incorpora la regresión de recursos con 278 productos. Build final: 115,63 kB gzip iniciales.
- `pnpm validar:ui`: 16 revisiones sin incidencias automáticas, con comprobación de colección
  completa y ausencia de paginación. Chrome a 390×844 con 278 productos ficticios: agrupación,
  salto a receta, selección del último producto desde el raíl y retorno al mismo en lista correctos.
  Informe y capturas en `.local/catalogo-continuo/`; no sustituye mediciones en móvil físico.

## Precarga progresiva del pasillo — 26/10/2026 (F2-08)

- Preparación de envases por proximidad: uno por turno libre, subiendo sus texturas a GPU antes
  de llegar. Se reutilizan los mismos recursos al montar la caja y al volver a una zona visitada.
  La geometría y los destinos de todas las estanterías ya forman parte del modelo completo.
- La cola cede al arrastre, movimiento de cámara, rueda, teclado, ficha abierta y pestaña oculta.
  Los cambios de destino repriorizan las estanterías próximas; al cambiar de catálogo/calidad
  o salir se cancelan los turnos y se sueltan las reservas compartidas.
- Se prepara todo el recorrido cuando cabe en la reserva estimada; en catálogos grandes se
  conserva la zona prioritaria dentro del presupuesto. Estimación de lienzo RGBA más GPU:
  48 MiB hasta 2 GB declarados, 192 MiB hasta 4 GB o sin dato, 512 MiB por encima.
  El presupuesto es de precarga, no una medición o límite total de memoria del navegador.
- Se mantiene el dibujo de las estructuras cercanas y el acceso a todos los medicamentos sin
  páginas. El contador de texturas GPU incluye también las reservas, aunque sus cajas estén lejos.
- `pnpm check` correcto: 729 tests; lint, tipos, pruebas de recursos y build final comprobados.
  JavaScript inicial: 115,63 kB gzip. Diez nuevos casos cubren orden, presupuesto, cesión de
  turnos, cancelación, reutilización y liberación ante errores de GPU.
- Chrome instrumentado con 80 productos ficticios: preparación en segundo plano, pausa táctil,
  salto al final con reutilización y liberación al volver a lista correctos. Evidencia en
  `.local/precarga-gpu/`; no acredita fps o memoria real de un teléfono.

## Ambiente y separación espacial — 26/10/2026 (F2-08 / F5-05)

- Las estanterías sin receta y con receta forman una esquina de 90°. El raíl lógico conserva
  todos los destinos; la cámara gira de forma continua entre ambas paredes y la caja seleccionada
  vuela orientada hacia ella, también desde la vitrina. Se conserva la precarga por proximidad.
- Vitrinas con dos puertas translúcidas, reflejos suaves, marco, tiradores y cierre ámbar.
  Los elementos decorativos no interceptan los clics: todas las cajas conservan ficha y prospecto.
- Ambiente lejano con siluetas de personal que recogen envases y clientes caminando.
  Solo se desenfoca esta capa CSS, sin redibujar el lienzo de productos. Se detiene
  con ficha abierta, pestaña oculta, menos movimiento o calidad ligera.
- Ocho regresiones verifican orientación y separación, destinos completos, continuidad de la
  curva, catálogos sin receta o solo de receta y colocación de puertas sin alterar los productos.
- Revisión en Chrome con datos ficticios: movimiento y pausa, clic a través del cristal,
  selección por teclado, ficha de receta y conservación de los 23 productos al pasar a lista.
  Capturas de escritorio y viewport móvil en `.local/ambiente-esquina/`. Se simuló la capacidad
  de GPU para revisar la animación con WebGL por software; no acredita rendimiento físico.
- `pnpm check` correcto: 737 tests, formato, lint, tipos y build. JavaScript inicial: 115,63 kB
  gzip. `pnpm validar:ui`: 16 revisiones y 0 incidencias automáticas.

### Ajuste del ambiente solicitado después

- Retirado el botón de pausa. El fondo también se anima en la landing, sin cargar WebGL;
  las preferencias de menos movimiento y la pestaña oculta siguen deteniéndolo.
- Ambiente envolvente con perspectiva y giro sincronizados con la cámara y paralaje suave.
  Más personal y clientes, de mayor presencia visual, conservando el desenfoque.
- Eliminado el suelo blanco opaco que cortaba las siluetas; se mantienen las sombras de contacto.
- Chrome con datos ficticios: movimiento en landing, giro continuo hasta 90° y menos movimiento
  comprobados. Capturas en `.local/fondo-envolvente/`, incluyendo portada móvil emulada.
- Verificación final: `pnpm check` correcto (737 tests); `pnpm validar:ui`, 16 revisiones y
  0 incidencias automáticas. JavaScript inicial: 116,11 kB gzip.

## Identidad de la landing — 27/10/2026 (F5-05)

- Cabecera «REBOTICA» y etiqueta «Cuéntanos qué te pasa», conservando las consultas frecuentes.
- Cruz verde con frente, reverso y cantos extruidos en CSS, sin cargar WebGL en la portada.
  Un giro completo sobre Y cada diez segundos, con reposo entre giros y sin animación al
  activar menos movimiento.
- `pnpm check` correcto: 737 tests y 116,29 kB gzip iniciales. `pnpm validar:ui`: 16 revisiones,
  0 incidencias automáticas. Giro, reposo y menos movimiento revisados en Chrome; capturas
  en `.local/marca-landing/`, incluyendo viewport móvil emulado.
