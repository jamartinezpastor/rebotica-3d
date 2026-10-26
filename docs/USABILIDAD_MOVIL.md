# F6-02 — prueba de usabilidad en móvil

Guion preparado el 26/10/2026. **Sesiones realizadas: ninguna. Resultados y conclusiones:
pendientes.** Preparar este material no completa F6-02.

## Objetivo y participantes

Comprobar si una persona encuentra rápidamente los medicamentos relacionados con una dolencia,
lee su información y entiende la separación de receta y el alcance documental del catálogo.
Observar también si puede organizar resultados sin creer que han desaparecido medicamentos.

Realizar sesiones moderadas de 30–35 minutos con 5–8 personas adultas que no hayan desarrollado
la app. Buscar variedad de soltura digital, al menos dos sesiones en iPhone y dos en Android,
y usar sus móviles habituales. Esta distribución es un objetivo del piloto, no una muestra
representativa. Las pruebas específicas con lector de pantalla, instalación y fps siguen el
[guion de validación UI](VALIDACION_UI.md); no se dan por realizadas con este estudio.

Una persona modera y toma notas; si hay otra observando, explicar su presencia. No contactar
participantes ni grabar desde la app. Usar códigos P01–P08, sin nombres, correos, diagnósticos
ni historias personales en las notas. No se necesita que tengan la dolencia de los escenarios.

## Preparación de cada ronda

1. Elegir una versión estable en una URL HTTPS accesible desde los móviles y registrar commit,
   cambios locales y versiones de `/api/informacion`. Usar la misma versión durante la ronda.
   No publicar ni desplegar una versión nueva como parte de este guion.
2. Ejecutar `pnpm check` y comprobar previamente los dos accesos a resultados (chip y texto),
   las fichas y los enlaces oficiales. El texto de prueba es exactamente `me duele la cabeza`.
   Si Gemini no está disponible, reparar o reprogramar T2; sustituirlo por un chip no valida T2.
3. Registrar la fecha de la copia CIMA, si la carga está completa, el total para dolor de cabeza
   y los conteos por receta. Elegir dos registros presentes en esa copia para T6, uno de cada
   condición, sin elegirlos por preferencia terapéutica. Anotar sus ids para repetir la tarea.
   No fijar marcas ni cantidades de coincidencias que puedan cambiar con la sincronización.
4. Comprobar que al menos un producto dispone de prospecto y de las secciones necesarias.
   Si faltan datos, registrarlo como incidencia técnica; no rellenarlos ni usar la demo ficticia
   para certificar el catálogo real. Registrar cualquier cambio de la copia entre sesiones.
5. Copiar [la plantilla de sesión](plantillas/SESION_USABILIDAD.md) una vez por persona y
   [la de resultados](plantillas/RESULTADOS_USABILIDAD.md) una vez por ronda a
   `.local/piloto-usabilidad/` (ignorado por Git). Mantener las plantillas originales vacías.
   Guardar las notas localmente y conservar para el repositorio solo una síntesis sin datos
   personales. Revisar y borrar notas temporales al terminar la síntesis.

No introducir consultas personales. El texto ficticio de T2 sigue el recorrido real y puede
enviarse a Gemini; explicar esto antes de empezar. Este piloto no evalúa tratamientos ni dosis,
ni acredita seguridad clínica o cualificación regulatoria.

## Apertura para leer a la persona

> Estamos probando la interfaz, no tus conocimientos. Usaremos situaciones inventadas y no
> necesitamos información sobre tu salud. Algunas tareas muestran medicamentos reales y enlaces
> oficiales; no tienes que elegir un tratamiento ni tomar nada. Puedes parar cuando quieras.
> En una tarea enviaremos un texto ficticio a la interpretación con Gemini. Tomaré notas sin
> tu nombre. Si te parece bien participar, cuéntame en voz alta qué intentas hacer y qué esperas
> que ocurra.

Confirmar verbalmente la voluntad de participar antes de tomar notas. No grabar audio, pantalla
ni vídeo en este protocolo. Preguntar únicamente por la familiaridad con webs y controles 3D,
sin pedir datos de salud. Permitir sus ajustes habituales de tamaño de texto y movimiento.

## Tareas principales

Leer solo la columna «Consigna». Las observaciones y criterios son para quien modera. No señalar
controles antes del primer intento. Alternar T1/T2: P01, P03… empiezan por T1; P02, P04… por T2.
Volver a portada entre ambas. Registrar el orden: la segunda tarea puede beneficiarse del aprendizaje.

| Id  | Consigna                                                                                                                                                                       | Qué observar y criterio de éxito                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T1  | «Situación inventada: quieres consultar el catálogo por dolor de cabeza sin escribir una consulta. Encuentra un producto y abre su información.»                               | Encuentra la consulta frecuente y abre una ficha. Cronometrar desde el fin de la consigna hasta la primera ficha cargada.                                                                                                      |
| T2  | «Desde el inicio, utiliza este texto de prueba: “me duele la cabeza”. Envíalo y abre la información de un producto del resultado.»                                             | Descubre el envío que aparece al escribir y llega a una ficha. Registrar por separado el tiempo de espera de interpretación/catálogo y el tiempo total. Un error del servicio es T, aunque encuentre el botón.                 |
| T3  | «Explora los resultados, abre un producto y vuelve a donde estabas. Después prueba la otra forma de ver los productos y encuentra el mismo.»                                   | Descubre lista/3D, abre y cierra ficha, conserva identidad y posición. Probar primero la vista que ofrezca su móvil; si no soporta 3D, registrar la limitación, sin forzarlo ni fingir que se probó.                           |
| T4  | «En esa ficha, encuentra para qué se usa, sus precauciones y la información de dosis. Abre el prospecto oficial y regresa.»                                                    | Localiza las tres pestañas y el documento del mismo registro; vuelve a la app. No introducir edad/peso ni pedir una pauta. Si hay foto, observar su ampliación como comprobación adicional, sin penalizar su ausencia.         |
| T5  | «Organiza el resultado por principio activo. Después limita lo que ves a una forma disponible y recupera el resultado completo.»                                               | Distingue agrupación de filtro, reconoce el contador y quita los filtros. Anotar total sin filtros antes/después y selección aplicada; agrupar debe conservar el conjunto completo. No contar solo las cajas de una página 3D. |
| T6  | «Con estos dos registros de prueba, uno sin receta y otro con receta, encuentra sus fichas y compara sus datos. Explica qué diferencias muestra la app y qué puedes concluir.» | Usa la comparación, reconoce la condición de receta y mantiene acceso al prospecto. Observar si interpreta comparación como ranking o recomendación. No pedir cuál tomar, cuál es mejor ni equivalencias de dosis.             |

En T6 dar únicamente los nombres/registros elegidos en la preparación; no explicar dónde están
las herramientas. Preguntar al terminar: «En este escenario inventado, ¿qué significa que un
medicamento aparezca relacionado con la consulta?». Anotar primero la interpretación espontánea;
después aclarar el alcance si hay confusión. No convertir la corrección del moderador en un éxito.

Si queda tiempo, tareas adicionales B1: localizar «Piojos» entre las consultas frecuentes;
B2: acceder al catálogo general desde el inicio. Registrar aparte: no mezclarlas con los seis
criterios principales ni atribuir resultados a quienes no las hayan realizado.

## Moderación y registro

Dejar hasta tres minutos por tarea. Ante bloqueo, preguntar «¿Qué esperabas encontrar?» sin
señalar el camino; registrar cualquier ayuda que revele un control o una secuencia. Si se agota
el tiempo, marcar abandono o ayuda y continuar. Separar el primer intento de cualquier repetición.

| Código | Resultado                                 | Registro                                                                           |
| ------ | ----------------------------------------- | ---------------------------------------------------------------------------------- |
| I      | Completada sin indicaciones de navegación | Tiempo, recorrido y evidencia observada                                            |
| H      | Completada con ayuda que revela el camino | Qué ayuda hizo falta y cuándo                                                      |
| A      | Abandono o tiempo agotado                 | Punto de bloqueo y expectativa                                                     |
| T      | Bloqueo técnico                           | Pantalla, error o dato ausente; no atribuirlo a habilidad de la persona            |
| N      | No ejecutada                              | Motivo, por ejemplo retirada o falta de tiempo; nunca convertirlo en cero segundos |

Registrar tiempos manualmente, sin añadir telemetría individual a la app. Para T1/T2 anotar
también el tiempo hasta ver resultados. Distinguir esos tiempos de la primera ficha y no restar
esperas estimadas como si se hubieran medido. Las notas deben describir hechos («intentó cerrar
tres veces»), separados de interpretaciones («quizá el botón no se distingue»).

Al cerrar, preguntar qué resultó más confuso, si prefirió lista o 3D y por qué, y qué cambiaría
primero. No solicitar relatos de enfermedad. Si surge información personal, no transcribirla.

## Síntesis y criterio propuesto para esta ronda

Completar [la plantilla de resultados](plantillas/RESULTADOS_USABILIDAD.md) con datos observados.
Mostrar por tarea I/H/A/T/N, denominadores y tiempos individuales o rangos sin identificar personas.
No atribuir significación estadística a 5–8 participantes ni usar los conteos agregados de la app
como evidencia de que completaron tareas.

Objetivos propuestos para decidir si hace falta otra iteración:

- Al menos cinco personas intentan las seis tareas; si faltan tareas o entornos, dejarlo explícito.
- Al menos el 80% de quienes intentaron cada tarea principal la completa sin ayuda: 4/5, 5/6,
  6/7 o 7/8 según el denominador real. T cuenta como intento fallido; N se informa aparte y no
  debe esconder la falta de cobertura. No mezclar repeticiones con primeros intentos.
- En T1/T2, objetivo exploratorio de primera ficha en hasta 60 s sin ayuda; mostrar cuántas
  personas lo cumplen y las esperas medidas. No es una garantía del servicio ni un resultado obtenido.
- Resolver antes de aceptar la ronda cualquier confusión persistente entre catálogo y tratamiento
  personalizado, entre con/sin receta, o cualquier pérdida de acceso al prospecto. Una incidencia
  de ese tipo no se compensa con buenos tiempos en otras tareas.

Priorizar hallazgos con evidencia, frecuencia observada y efecto: crítico (confusión de alcance
o receta), mayor (impide completar una tarea), menor (la retrasa) o visual (sin bloqueo observado).
Asignar a cada cambio una comprobación posterior. Si se modifica la app, abrir una ronda nueva
y conservar por separado resultados anteriores y posteriores.

F6-02 se cierra cuando se hayan realizado las 5–8 sesiones, documentado hallazgos y decisiones,
y resuelto o planificado con justificación los problemas encontrados. Si no se cumplen los
objetivos, registrar la ronda y mantener pendiente su aceptación. El piloto no sustituye F6-01
ni decide por sí solo F6-03.
