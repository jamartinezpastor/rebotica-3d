# Protocolos del MVP — F4-04

Catorce borradores versionados, uno por consulta del catálogo cerrado de Gemini y de los
chips del mostrador. Todos cumplen el esquema `Protocolo`, están en `borrador` y tienen
`validadoPor` y `validadoEn` a `null`. **No son protocolos clínicos validados ni autorizan
triaje, recomendaciones o calculadoras.** Su revisión y firma corresponden a F6-01.

## Contenido y trazabilidad

Cada JSON contiene sinónimos, preguntas de triaje, condiciones estructuradas de derivación,
baldas por principio activo, grupos de vitrina, autocuidados y parafarmacia asociada. No
contiene marcas comerciales, cantidades de dosis ni pautas. El orden de las baldas es una
propuesta editorial pendiente de revisión, no una combinación de tratamientos.

| Borrador                                            | Baldas propuestas                                       | Vitrina propuesta                                          |
| --------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| [Dolor de cabeza](dolor-cabeza.json)                | Paracetamol, ibuprofeno                                 | Sumatriptán, solo con diagnóstico de migraña               |
| [Fiebre](fiebre.json)                               | Paracetamol, ibuprofeno                                 | Vacía: no se deduce un tratamiento etiológico de la fiebre |
| [Resfriado y congestión](resfriado-congestion.json) | Paracetamol para malestar asociado                      | Vacía                                                      |
| [Dolor de garganta](dolor-garganta.json)            | Paracetamol                                             | Vacía                                                      |
| [Tos](tos.json)                                     | Sin medicamento seleccionado                            | Vacía                                                      |
| [Acidez](acidez.json)                               | Almagato                                                | Presentaciones de omeprazol con receta                     |
| [Diarrea](diarrea.json)                             | Loperamida, sin sustituir la rehidratación              | Vacía                                                      |
| [Estreñimiento](estrenimiento.json)                 | Lactulosa                                               | Vacía                                                      |
| [Alergia estacional](alergia-estacional.json)       | Loratadina, cetirizina como alternativas                | Mometasona nasal con receta                                |
| [Picaduras](picaduras.json)                         | Hidrocortisona cutánea                                  | Vacía                                                      |
| [Quemadura solar](quemadura-solar.json)             | Paracetamol para dolor asociado                         | Vacía                                                      |
| [Herpes labial](herpes-labial.json)                 | Aciclovir cutáneo                                       | Aciclovir sistémico con receta                             |
| [Dolor muscular](dolor-muscular.json)               | Paracetamol, ibuprofeno                                 | Vacía                                                      |
| [Piojos](piojos.json)                               | Sin medicamento seleccionado; peinado húmedo y lendrera | Vacía                                                      |

No se fuerza una balda de medicamentos ni un grupo con receta donde todavía no se ha
seleccionado uno. En tos y piojos, el borrador se centra en autocuidados y parafarmacia.
Los antibióticos no se añaden como respuesta automática a síntomas inespecíficos.

El campo `revision` conserva la fecha de consulta **20/10/2026**, enlaces directos a las
fuentes oficiales y tareas pendientes. Las fichas técnicas de **CIMA/AEMPS**, secciones
4.1–4.6, sustentan indicaciones y precauciones; las páginas del **NHS**, servicio público
de salud británico, sirven como punto de partida para síntomas, alarmas y autocuidados.
Las referencias farmacológicas identifican documentos, no marcas que recomendar.

Consultar las fuentes no constituye validación farmacéutica. La selección y redacción de
preguntas, los niveles de urgencia y su adaptación al circuito español son propuestas
editoriales: no se trasladan teléfonos británicos a la interfaz. Deben contrastarse con
guías españolas de indicación farmacéutica y firmarse antes del uso clínico.

## Alcance y revisión pendiente

El subconjunto inicial se limita editorialmente a adultos de **18 a 64 años**, sin embarazo,
lactancia, comorbilidad, alergias medicamentosas ni medicación concomitante. El resto se
remite a atención presencial, con prioridad para cualquier alarma. Estos límites delimitan
el trabajo de curación: **no son las edades de autorización de los medicamentos**. Fiebre
incluye además la derivación urgente del lactante menor de tres meses. La edad se expresa
en meses y la duración de síntomas en horas; las preguntas no tienen respuestas por defecto.

Los borradores no se publican cambiando solo `estado` y añadiendo un nombre. El esquema
rechaza un protocolo `validado` si `revision.pendienteDe` conserva tareas. Antes de F6-01:

- Revisar cobertura de alarmas, urgencias y poblaciones; completar anamnesis, alergias,
  contraindicaciones e interacciones y reducir el número de tarjetas tras probar la comprensión.
- Delimitar presentaciones, vías y formas. El catálogo actual filtra por principio activo y
  condición de receta, sin restringir vías: esto es especialmente relevante para aciclovir,
  hidrocortisona y mometasona. Las baldas propuestas no autorizan cualquier presentación.
- Revisar los límites de duración y distinguir tiempo con síntomas de tiempo de tratamiento.
  En diarrea se propone conservadoramente derivar a las 48 horas de síntomas; la ficha citada
  limita la duración del tratamiento, por lo que esa adaptación requiere revisión expresa.
  En garganta se pregunta aparte por el uso continuado de analgésicos.
- Completar selección de sales de rehidratación, descongestionantes, pediculicidas y otras
  alternativas. La parafarmacia sigue siendo una asociación textual, sin un catálogo propio
  de productos revisados. Una vitrina vacía no afirma que no exista tratamiento médico.
- Preparar casos clínicos dorados y adversarios, verificar el catálogo comercializado y
  documentar decisiones pendientes antes de incorporar firma y fecha reales.

Las pruebas de lógica del motor siguen usando exclusivamente umbrales ficticios fuera de
esta carpeta. Las pruebas de estos archivos verifican estructura, cobertura de los 14 ids,
referencias coherentes y bloqueo de publicación; no certifican sus decisiones clínicas.

## Carga local y Docker

La API con PostgreSQL importa los JSON al arrancar si se define `PROTOCOLOS_DIR`. Para
desarrollo, en `.env` de la raíz puede configurarse una ruta absoluta a esta carpeta:

```dotenv
PROTOCOLOS_DIR=C:/Users/mippr/Documents/desarrollo/rebotica-3d/packages/protocolos/data
```

En Docker los archivos se incluyen en `/app/protocolos`; configurar opcionalmente
`PROTOCOLOS_DIR=/app/protocolos` en tiempo de ejecución. No hay migraciones nuevas ni llamadas
a CIMA o Gemini al importar. La opción no se activa automáticamente ni cambia `.env`.

La importación es idempotente por `(id, version)` y **nunca sobrescribe una versión existente**,
incluida una firmada. Devuelve el número de inserciones nuevas. Toda modificación persistida
exige una versión nueva; revisar y publicar una versión corresponde al proceso de curación,
no al cargador de arranque. Un borrador posterior no desplaza una versión firmada vigente.

Con estos archivos instalados, `GET /api/protocolos/:id` y `POST /api/triaje` siguen
respondiendo `503` porque no hay protocolo firmado. La demostración de medicamentos sigue
disponible por su acceso independiente. Habilitar Gemini solo activa la clasificación de
texto; no salta esta barrera clínica.

Tras el cambio de alcance del 20/10/2026, la portada permite explorar un catálogo informativo
por dolencia sin usar estos borradores: busca menciones del tema en las indicaciones oficiales
4.1 de CIMA local. La falta de firma bloquea el recorrido clínico, no esa navegación documental.
