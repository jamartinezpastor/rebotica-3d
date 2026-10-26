# Validación de interfaz — F5-01 / F2-06

Revisión del 25/10/2026. Alcance: comprobaciones reproducibles en Chrome de escritorio y
preparación de las pruebas en dispositivos. La etapa sigue abierta hasta completar las
comprobaciones manuales; este informe no certifica conformidad WCAG ni instalación móvil.

## Repetir la comprobación automática

```powershell
pnpm check
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
pnpm validar:ui
pnpm rendimiento
```

`validar:ui` requiere el build y Chrome instalado. Inicia un servidor de producción temporal en
`127.0.0.1:4176`, sin BD ni credenciales de Gemini, y usa el catálogo ficticio de los tests.
No envía consultas a Google ni a CIMA. El puerto debe estar libre. Cierra navegador y servidor
al terminar y devuelve error si detecta violaciones automáticas o falla algún recorrido.

El informe y las capturas quedan en `.local/validacion-ui/`, ignorado por Git. El JSON incluye
fecha, versión del navegador, violaciones, casos incompletos de axe y comprobaciones PWA.
La revisión no se añade automáticamente a CI: puede ejecutarse explícitamente donde haya Chrome.
`pnpm rendimiento` conserva sus propios informes en `.lighthouseci/`.

## Hallazgos corregidos

| Hallazgo                                                    | Impacto                                                      | Referencia                | Corrección                                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------ | ------------------------- | ----------------------------------------------------------------------------------------- |
| Barras fijas tapaban productos con poco alto disponible     | Mayor: un clic no abría la ficha a 640×360                   | Reflow 1.4.10             | Herramientas, paginación y selección pasan al flujo de documento en vistas bajas de lista |
| Paneles limitados de alto dejaban poco espacio al contenido | Mayor: dificultad para leer fichas y comparaciones en reflow | Reflow 1.4.10             | Panel desplazable con acciones visibles y contenido accesible a 320×256                   |
| Foco podía quedar debajo de las barras                      | Mayor para teclado                                           | Foco visible 2.4.7        | Se revela el producto enfocado cuando queda tapado, conservando el retorno entre vistas   |
| El texto «Foto CIMA» no formaba parte del nombre accesible  | Serio en axe: afecta a activación por voz                    | Etiqueta en nombre 2.5.3  | Nombre accesible «Foto CIMA: ampliar foto del envase»                                     |
| Escape podía retroceder con una entrada antigua de ficha    | Regresión de navegación                                      | Comportamiento de teclado | Escape solo cierra cuando hay una ficha abierta                                           |

Referencias: [Reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow),
[Foco visible](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html) y
[Etiqueta en nombre](https://www.w3.org/WAI/WCAG21/Understanding/label-in-name.html).

## Resultado de navegador

`pnpm check` correcto: 717 tests, formato, lint, tipos y build. JavaScript inicial:
116,86 kB gzip, por debajo de 250 kB.
`pnpm rendimiento` correcto: 99/100 en las tres mediciones Lighthouse móviles de la portada
compilada; LCP entre 1,96 y 1,98 s. Estas mediciones locales no comprueban los fps de la escena.

Chrome de escritorio, build local, axe-core con reglas WCAG 2 A/AA y 2.1 A/AA:

- 16 revisiones, sin violaciones automáticas tras las correcciones.
- Portada, información técnica, lista y ficha a 390×844, 640×360 y 320×256; ficha con receta,
  foto, comparación y comparación estrecha. Las medidas pequeñas comprueban reflow equivalente,
  no un zoom real del navegador ni un dispositivo físico.
- Tab desde la cabecera abre el primer producto con Enter; Mayús+Tab y Tab mantienen el foco
  en la ficha, con controles visibles. Escape devuelve el foco al producto.
- Cerrar la foto conserva la ficha. Las transiciones se desactivan con menos movimiento.
- Manifiesto e iconos disponibles. Service worker activo y portada abierta al recargar sin red.
  Cache Storage solo contiene archivos de app, sin rutas `/api` ni `/media`.
- Estos resultados no comprueban que el catálogo funcione sin red: la ausencia de respuesta
  de datos no se sustituye por una recomendación ni por productos ficticios de forma automática.

### Contraste

| Uso              | Texto     | Fondo     | Ratio   |
| ---------------- | --------- | --------- | ------- |
| Controles verdes | `#08773e` | `#ffffff` | 5,65:1  |
| Texto secundario | `#5c6660` | `#ffffff` | 5,96:1  |
| Texto principal  | `#1d2420` | `#faf8f4` | 14,94:1 |

Los tests contrastan la paleta sobre sus fondos habituales. El informe conserva resultados
incompletos de axe para iconos decorativos hechos con caracteres y para texto sobre fondos
que el motor no resuelve por solapamiento. No se convierten esos casos en una aprobación
automática: hay que revisarlos junto con las capturas y las pruebas de asistencia reales.

## Pruebas manuales pendientes

Registrar para cada sesión: fecha, commit y cambios sin commit, URL HTTPS evaluada, modelo de
dispositivo, sistema y navegador con versión. Usar datos ficticios, sin información de pacientes.
Una comprobación pendiente no se marca como correcta por analogía con Chrome de escritorio.

| Entorno                                               | Recorrido                                                              | Evidencia que falta                                                          |
| ----------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Windows con NVDA                                      | Portada, chips, formulario, lista, ficha, pestañas, foto y comparación | Nombres anunciados, orden de lectura, retorno del foco y ausencia de trampas |
| iPhone con Safari y VoiceOver                         | Mismo recorrido; teclado virtual, retrato y paisaje                    | Lectura y acciones accesibles sin depender del gesto de arrastre 3D          |
| Android con Chrome y TalkBack                         | Mismo recorrido; teclado virtual y cambio lista/3D                     | Anuncios, objetivos táctiles, navegación y retorno a producto                |
| Navegador de escritorio, zoom real 200% y 400%        | Grupos, ficha larga, receta y comparación                              | Contenido y foco accesibles sin scroll horizontal no esencial                |
| iOS/Android, menos movimiento y contraste del sistema | Navegación, apertura de ficha y controles                              | Sin animación imprescindible y foco identificable                            |

### Instalación real

En iPhone, seguir la opción de Safari para añadir a Inicio y abrir como app web según la
[guía de Apple](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios).
En Android, instalar desde Chrome según la
[guía de Google](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid).

En ambos: comprobar icono y nombre, apertura sin barra del navegador cuando corresponda,
consulta y enlaces oficiales, cierre y reapertura. Después abrir la portada sin red y volver
a activar la conexión. Verificar actualización con una ficha abierta: debe conservar el
recorrido hasta cerrar las ventanas anteriores. Anotar cada resultado, no solo la presencia
del botón de instalación.

### Medición F2-06 en un móvil de referencia

1. Abrir `/escena?demo=1&vista=3d&fps=1&cajas=40` en el dispositivo y registrar tamaño de
   ventana, DPR, modelo, sistema, navegador y configuración de ahorro de energía/datos.
2. Medir carga inicial y repetición con caché. Mover el raíl y cambiar de balda durante al
   menos 60 segundos; las pausas en reposo no cuentan porque el render es bajo demanda.
3. Registrar fps, p95, máximo, geometrías, texturas y llamadas de dibujo. Anotar si se reduce
   el detalle automáticamente y medir también después de la reducción.
4. Repetir con `/escena?demo=1&vista=3d&fps=1&cajas=35&vitrina=1` (40 productos, incluida receta),
   abrir una ficha, girar la caja, cerrar y cambiar a lista. Confirmar las mismas identidades.
5. Repetir el recorrido grande con `cajas=195&vitrina=1`, incluido salto a grupo. Confirmar que
   la ventana de recursos permanece acotada y todos los productos son alcanzables.

El criterio del plan es 60 fps con 40 cajas en un Android de gama media. No se considera
demostrado por Lighthouse, una emulación de viewport o fps de renderizado por software en
el equipo de desarrollo. Modelo de referencia, medidas y decisión de aceptación: **pendientes**.

## Cierre de la etapa

La parte automática y las correcciones están implementadas. Para cerrar F5-01/F2-06 faltan
los resultados de lector de pantalla, zoom real, instalación móvil y fps en hardware físico.
Las revisiones farmacéuticas y las pruebas con personas de F6 son una etapa posterior.

## Comprobación tras simplificar controles — 26/10/2026

Por petición del usuario se retiran búsqueda y filtros adicionales, manteniendo agrupación
y salto a grupo. Se corrige el signo del arrastre vertical para que el contenido siga al dedo
tanto durante el gesto como al soltar. La validación automática vuelve a pasar las 16 revisiones.

Chrome con viewport de 390×844 y eventos táctiles: capturas revisadas de arrastre arriba/abajo
y ajuste al soltar, sin selección accidental; al volver a lista se conservan los 40 productos
de la demo explícita y no hay desbordamiento horizontal. Evidencia local en `.local/gestos-movil/`.
Es una emulación de escritorio; no registra fps ni valida el comportamiento en un teléfono real.

`pnpm check` correcto: 719 tests, formato, lint, tipos y build; JavaScript inicial de 116,00 kB gzip.
Se retiran siete casos del filtrado eliminado y se añaden dos regresiones de dirección vertical.

## Comprobación del recorrido sin páginas — 26/10/2026

Retirada la paginación de lista y 3D. El validador comprueba ahora que todos los productos de
su catálogo están presentes en lista y que no hay navegación de páginas. Las 16 revisiones pasan.

En Chrome a 390×844, con un catálogo ficticio de 278 productos (30 sin receta y 248 con receta),
la lista contiene los 278, agrupar conserva el total y el salto a receta coloca el mismo producto
en 3D. Desde el raíl se abre la ficha del último registro y se regresa a ese registro en lista,
sin desbordamiento horizontal. Informe y capturas: `.local/catalogo-continuo/`.

La prueba de modelo y ventana de recursos conserva 278 destinos y acota las cajas próximas sin
ficha abierta a 90 en calidad normal. No es una medición de fps de un dispositivo real.
`pnpm check` correcto: 719 tests; build final con 115,63 kB gzip iniciales.

## Precarga de envases — 26/10/2026

Las cajas próximas siguen siendo las que se montan y dibujan. En reposo se preparan materiales
y texturas por proximidad, con reserva compartida y presupuesto; cuando cabe el recorrido completo
se prepara entero. En un catálogo mayor, la reserva se concentra en la zona de la cámara.
La calidad de la ficha conserva su ciclo independiente. Presupuestos y límites en el README.

Chrome de escritorio con 80 productos ficticios, viewport 390×844 y eventos táctiles:

- Instrumentación de creación, operaciones de textura, eliminación y pérdida de contexto WebGL.
  Las operaciones en turnos de reposo pasaron de 30 a 732 mientras la vista permanecía quieta.
- Durante el gesto el contador de operaciones de fondo quedó en 30. Después retomó la cola.
- El salto al final produjo cuatro operaciones de textura fuera de los turnos de reposo;
  los envases preparados se reutilizaron. Son contadores de API, no tiempos ni bytes medidos.
- Al salir del 3D, los handles vivos registrados pasaron de 441 a cero, incluida la liberación
  del contexto. La lista conservó los 80 productos. No hubo errores de página.
- Informe y captura en `.local/precarga-gpu/`. Los tests cubren además cancelar turnos,
  mantener recursos compartidos y soltar la reserva si falla la inicialización GPU.

`pnpm check` correcto: 729 tests; tipos, lint y build final correctos, con 115,63 kB gzip iniciales.
La memoria de reserva se estima a partir de píxeles RGBA de lienzo y GPU; no es una medición real
de memoria ni de fps en un móvil. Las pruebas físicas de F5-01/F2-06 siguen pendientes.
