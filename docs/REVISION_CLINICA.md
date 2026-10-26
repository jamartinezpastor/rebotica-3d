# F6-01 — preparación de revisión farmacéutica

Preparado el 26/10/2026 para quien revise las reglas de dosis y los protocolos. El comando
genera un expediente técnico de los archivos del repositorio; la revisión y firma profesionales
siguen pendientes. El catálogo informativo por dolencia conserva su recorrido actual.

## Generar el expediente

Desde la raíz:

```bash
pnpm revision:clinica
```

Produce `.local/revision-clinica/informe.json` e `informe.md`, ignorados por Git. Una ejecución
sustituye el informe anterior. Antes de iniciar una revisión, conservar una copia del expediente
y anotar el commit y los cambios locales de esa sesión. El informe contiene fecha de generación
UTC y SHA-256 de los bytes de cada archivo, por lo que identifica también cambios sin commit.

No carga `.env`, no conecta con BD, CIMA ni Gemini y no modifica los JSON originales. No importa
contenido, cambia estados ni habilita calculadoras o triaje. No contiene datos de pacientes ni
resultados de dosis. Las pruebas aritméticas siguen utilizando exclusivamente datos ficticios.

El código de salida `0` significa que se generó el inventario sin errores técnicos. **No significa
que se pueda publicar su contenido.** Los borradores y la falta de firma son trabajo pendiente,
no errores de ejecución. JSON ilegible, esquema inválido, archivo con id distinto, identidad o
versión duplicada, huella 4.2 mal formada o protocolos que no cubran el catálogo cerrado producen
un código de salida distinto de cero. El informe conserva esos errores sin ocultar otros archivos.

## Qué revisar en el informe

| Campo                                | Significado                                                    | Límite                                                            |
| ------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| `sha256Archivo`                      | Huella exacta del JSON leído                                   | No demuestra corrección clínica ni vigencia de CIMA               |
| `hashSeccionDeclarado`               | Huella de la sección 4.2 que declara la regla                  | El inventario no consulta ni compara la fuente actual             |
| `estadoDeclarado` y `firmaDeclarada` | Metadatos presentes en el documento                            | Un nombre escrito no acredita identidad profesional ni aprobación |
| `fuentes`                            | Enlaces para contrastar el contenido                           | No se descargan ni se certifica su actualidad                     |
| `tareasEditoriales`                  | Pendientes transcritos de `revision.pendienteDe` del protocolo | No son una revisión exhaustiva                                    |
| `comprobacionesPendientes`           | Trabajo que debe quedar documentado en la revisión             | No se borra por detectar un estado firmado                        |
| `errores`                            | Problemas técnicos del archivo o del inventario                | Su ausencia no valida decisiones clínicas                         |

Para reglas, el expediente identifica registro, versión y referencia a la sección 4.2. El contenido
numérico permanece en el JSON original; no se generan nuevas dosis ni una pauta de ejemplo. Para
protocolos, conserva las referencias y tareas específicas de cada borrador. Los documentos sin
trazabilidad o criterios ejecutables quedan señalados.

## Sesión de revisión profesional

1. Identificar qué versiones se revisan y el alcance que se pretende habilitar. Conservar el
   expediente y los archivos correspondientes. Los borradores clínicos no determinan las
   coincidencias de la búsqueda documental del catálogo.
2. Contrastar cada regla con las secciones oficiales vigentes, presentación y registro concretos;
   revisar sus límites, exclusiones, interacciones y poblaciones no representadas. El alcance
   inicial y las carencias conocidas están en las [semillas de reglas](../packages/dosis/data/reglas/README.md).
3. Revisar las alarmas, urgencias, poblaciones, vías y presentaciones de cada protocolo, resolver
   sus tareas editoriales y documentar decisiones. Véanse los [borradores de protocolos](../packages/protocolos/data/README.md).
4. Aportar y revisar casos clínicos y adversarios con el profesional. Los tests ficticios del
   motor comprueban lógica y aritmética, sin certificar decisiones clínicas.
5. Registrar identidad profesional, fecha, decisiones, fuentes, casos y versiones o huellas
   exactas revisadas en un acta. Una modificación posterior exige revisar el contenido cambiado.
6. Incorporar los cambios mediante revisión de código y nuevas versiones; comprobar la fuente
   local actual, los contratos y `pnpm check` antes de cualquier decisión de publicación.
   El cargador de semillas solo importa borradores y no sobrescribe versiones existentes.

El comando no incluye una opción de firma o publicación. Completar el expediente no sustituye
la verificación profesional ni una decisión de lanzamiento. F6-02 (prueba con personas) y F6-03
(decisión documentada de alcance) siguen siendo etapas distintas.

## Acta que debe completar la persona revisora

- Fecha, identidad profesional y alcance de la revisión.
- Commit, cambios locales, ids, versiones y huellas de los archivos revisados.
- Referencias oficiales y evidencia de la vigencia comprobada.
- Decisiones sobre cada tarea editorial, exclusión y limitación pendiente.
- Casos revisados, resultados esperados y discrepancias resueltas.
- Resultado por documento: pendiente, requiere cambios o aprobado por la persona revisora.
- Firma y condiciones de la revisión, si procede.

No se ha rellenado ni firmado esta acta automáticamente.

## Estado inicial

Inventario del 26/10/2026: cinco reglas y catorce protocolos; diecinueve borradores, ninguna firma
declarada y cero errores técnicos del informe. Vigencia de las fuentes e identidad de firmantes:
no comprobadas por esta herramienta. F6-01 permanece abierto.

Verificación técnica: `pnpm check` correcto, con 724 tests, formato, lint, tipos y build;
JavaScript inicial de 116,86 kB gzip. Los siete tests nuevos cubren el inventario, archivos
inválidos, duplicados, directorios ausentes, huellas y la distinción entre firma declarada
y comprobación profesional.
