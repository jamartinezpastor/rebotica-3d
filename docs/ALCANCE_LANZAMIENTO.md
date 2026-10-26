# F6-03 — alcance de lanzamiento y análisis preliminar

Fecha: 26/10/2026. Base técnica revisada: commit `64efb07`. Ámbito previsto del análisis:
España/UE. **Dirección de producto: catálogo informativo por dolencia. Cualificación regulatoria
y decisión de lanzamiento: pendientes de revisión especializada y decisión del operador.**

Este documento registra el alcance solicitado y las cuestiones que debe resolver la revisión.
No es un dictamen jurídico ni acredita conformidad, marcado CE o autorización de lanzamiento.
El estado de la instalación desplegada y de su base de datos no se ha auditado en esta tarea.

## Decisión de producto que ya consta

Los cambios de alcance del usuario del 20 y 23/10/2026 fijan el recorrido: introducir o elegir
una dolencia, explorar todas las coincidencias documentales de la copia local comercializada de
CIMA y consultar fichas y prospectos completos. Agrupar conserva el conjunto. El 26/10/2026 el
usuario retira la búsqueda y los filtros adicionales; se mantienen el selector y el salto de
grupos. La condición de receta se mantiene visible y diferenciada.

Esto orienta el producto hacia el camino B del plan original. No convierte automáticamente la
implementación actual en software excluido del Reglamento de productos sanitarios. La futura
activación de reglas de dosis o protocolos necesita una decisión de alcance propia.

## Finalidad documental propuesta

Permitir a usuarios de una web pública consultar y organizar información oficial de medicamentos
de la copia CIMA mediante navegación 3D o lista y coincidencias textuales con una dolencia del
catálogo cerrado. Mostrar la información oficial y sus límites de cobertura, sin seleccionar
una pauta o un medicamento adecuado para una persona concreta.

La aparición de un producto expresa una coincidencia documental, no idoneidad clínica, prioridad
terapéutica ni equivalencia entre productos. No se define una población de tratamiento ni se
acredita que el catálogo sea exhaustivo si la sincronización o las secciones 4.1 están incompletas.
La parafarmacia requeriría su catálogo curado; no se da por cubierta con los medicamentos de CIMA.

Esta finalidad propuesta debe contrastarse con las funciones efectivas, los textos públicos y
la comprensión observada en F6-02. La siguiente matriz incluye capacidades que exceden la mera
consulta documental y que la revisión debe considerar.

## Funciones que contiene la versión revisada

| Función                  | Comportamiento comprobado en código                                                                       | Implicación para delimitar el alcance                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Consulta frecuente       | Identificador cerrado a `/api/explorar`; busca en indicaciones 4.1 locales                                | No depende de un protocolo clínico firmado; la cobertura depende de los datos                                       |
| Texto libre              | Filtro local de alarmas, Gemini opcional, clasificación o aclaración y posible derivación                 | Incluye interpretación de información de salud; no es solo recuperar un documento por nombre                        |
| Resultados y comparación | Agrupa todos los resultados, separa receta y permite leer ambos prospectos                                | Revisar si el usuario interpreta la asociación como recomendación o ranking                                         |
| Calculadora              | La API puede servir reglas validadas; el navegador comprueba fuente, cita y condiciones antes de calcular | Capacidad clínica condicional; que las semillas sean borradores no prueba que esté desactivada en una BD desplegada |
| Triaje clínico           | Rutas registradas; exigen protocolo firmado y condiciones ejecutables                                     | No forma parte del recorrido principal, pero existe y debe inventariarse junto con sus accesos                      |
| Demo explícita           | Escenario de prueba con productos ficticios                                                               | No demuestra cobertura ni funcionamiento del catálogo real                                                          |

Evidencia técnica:
[exploración](../apps/api/src/exploracion.ts),
[clasificación y alarmas](../apps/api/src/interpretacion/interpretar.ts),
[lectura de reglas](../apps/api/src/catalogo.ts),
[preparación de calculadora](../apps/web/src/escena/prepararCalculadora.ts),
[triaje](../apps/api/src/triaje.ts) y [registro de rutas](../apps/api/src/app.ts).

No hay un interruptor global de «solo catálogo» que por sí mismo garantice la exclusión de toda
capacidad clínica. `INTERPRETACION_IA_HABILITADA` controla el clasificador Gemini; el filtro local
de alarmas precede a su uso. Una variante documental estricta requiere decidir y verificar qué
funciones y rutas se incluyen, manteniendo coherentes sus dependencias. Este documento no
implementa esa variante ni acredita la configuración del despliegue.

## Referencias oficiales y razonamiento preliminar

El artículo 2.1 del MDR incluye software con finalidades médicas específicas; el 2.12 vincula la
finalidad prevista con la información facilitada por el fabricante. Primero debe resolverse si
el software cualifica como producto sanitario. Si cualifica y proporciona información para
decisiones terapéuticas o diagnósticas, procede analizar la regla 11, cuyas clases dependen del
impacto de las decisiones. No se asigna una clase a Rebotica en este documento.
[MDR: artículo 2 y anexo VIII, regla 11, texto publicado en BOE](https://www.boe.es/buscar/doc.php?id=DOUE-L-2017-80916).

La guía MDCG 2019-11 rev.1, de junio de 2025, distingue recuperación documental de búsqueda que
contribuye a una finalidad médica, también con lenguaje natural. Pide delimitar los módulos y
sus dependencias. La guía no es jurídicamente vinculante.
[MDCG, apartados 3.1 y 7](https://health.ec.europa.eu/system/files/2025-06/mdcg_2019_11_en.pdf).

**Inferencia para revisar:** clasificar síntomas y decidir una derivación introduce una cuestión
de finalidad médica que no queda resuelta porque los medicamentos se recuperen por texto. La
calculadora y el triaje necesitan análisis propio y de su relación con el resto de la aplicación.
Separar carpetas o añadir un aviso no constituye evidencia suficiente para cerrar esa cuestión.

Si la revisión concluye que el producto entra en el MDR, su puesta en el mercado o servicio debe
cumplir los requisitos aplicables. [Información de AEMPS sobre requisitos de comercialización](https://www.aemps.gob.es/productos-sanitarios/productos-sanitarios/comercializacion-de-productos-sanitarios-en-espana/que-requisitos-deben-cumplir-los-productos-sanitarios/).

Referencias consultadas el 26/10/2026. El enlace BOE corresponde al acto publicado; la revisión
especializada deberá contrastar la normativa consolidada aplicable al tomar la decisión final.

## Comparación de los caminos del plan

| Camino                  | Relación con el alcance actual                                             | Decisión registrada                                                                                   |
| ----------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| A. Prototipo/piloto     | Útil para evaluar la interfaz y recoger evidencia con escenarios ficticios | F6-02 está preparado; no se ha realizado. «Piloto» no se toma como una exención legal                 |
| B. Catálogo informativo | Es la dirección funcional elegida por el usuario                           | Finalidad documental propuesta; falta resolver alarmas, capacidades clínicas y límites de la variante |
| C. Funciones clínicas   | Comprendería el alcance clínico que se decidiera activar y revisar         | No se presume aprobado por disponer del motor, una firma en JSON o tests en verde                     |

La elección de B como dirección de producto no constituye una decisión de cualificación ni una
aprobación de lanzamiento público. El catálogo conserva las fichas completas y la separación de
receta solicitadas; las decisiones sobre funciones clínicas se documentarán antes de activarlas.

## Evidencias que faltan para la decisión

| Cuestión                   | Evidencia necesaria                                                                                                                       | Estado                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Finalidad y módulos        | Revisión especializada de texto libre, alarmas, catálogo, cálculo y triaje, incluidos accesos y dependencias                              | Pendiente                                                                                        |
| Variante a evaluar         | Versión, configuración y estado efectivo de reglas/protocolos de la instalación objetivo; mecanismos que mantienen sus límites            | No auditada                                                                                      |
| Contenido clínico          | Revisión profesional de lo que se pretenda activar, con fuentes y versiones exactas                                                       | [F6-01 preparado](REVISION_CLINICA.md); firma pendiente                                          |
| Comprensión y dispositivos | Resultados de personas y pruebas físicas de accesibilidad, instalación y fps                                                              | [Piloto](USABILIDAD_MOVIL.md) y [validación UI](VALIDACION_UI.md) pendientes de ejecución manual |
| Datos y proveedor          | Verificar en la infraestructura y proyecto de Google las condiciones de tratamiento y retención; revisar la información pública aplicable | [Información técnica documentada](PRIVACIDAD.md); comprobación de infraestructura pendiente      |

Se mantiene la decisión del usuario de publicar solo información técnica sobre datos, sin nombre
ni correo público. Esa decisión no se utiliza aquí como acreditación de cumplimiento legal.

## Registro de la decisión final

Completar sobre una versión y configuración concretas, conservando la evidencia revisada:

- Persona operadora que decide y fecha: pendiente.
- Finalidad y módulos incluidos, con rutas y condiciones de activación: pendiente.
- Conclusión de cualificación y, si procede, clasificación, con fundamento especializado: pendiente.
- Evidencia clínica, técnica y de usabilidad aceptada, y limitaciones pendientes: pendiente.
- Condiciones de tratamiento de datos verificadas: pendiente.
- Decisión de alcance y lanzamiento, con condiciones o acciones previas: pendiente.

F6-03 permanece abierto hasta completar este registro. Una modificación de finalidad, alarmas,
cálculos o módulos activa una nueva revisión del alcance documentado. Esta entrega documenta
el estado revisado del código.
