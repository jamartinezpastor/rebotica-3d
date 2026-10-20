# Semillas de curación — F3-04

Cinco transcripciones iniciales de fichas técnicas de CIMA consultadas el **20/10/2026**.
Todas están en `borrador`, sin firma ni fecha de validación. No son reglas clínicas completas
ni se pueden publicar cambiando solo el estado. No habilitan calculadoras ni generan pautas.

| Archivo                     | Registro y ficha oficial                                                                  | Alcance inicial                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `paracetamol-52010.json`    | [52010 · Gelocatil](https://cima.aemps.es/cima/dochtml/ft/52010/FT_52010.html)            | Comprimido entero; subconjunto adulto, con límite de peso conservador              |
| `ibuprofeno-67968.json`     | [67968 · Nurofen](https://cima.aemps.es/cima/dochtml/ft/67968/FT_67968.html)              | Comprimido entero; subconjunto adulto anterior a la edad que requiere reevaluación |
| `acetilcisteina-67763.json` | [67763 · Acetilcisteína Cinfa](https://cima.aemps.es/cima/dochtml/ft/67763/FT_67763.html) | Comprimido efervescente entero; adultos                                            |
| `loratadina-63696.json`     | [63696 · Loratadina Cinfa](https://cima.aemps.es/cima/dochtml/ft/63696/FT_63696.html)     | Comprimido entero; subconjunto adulto sin ajuste hepático                          |
| `cetirizina-66605.json`     | [66605 · Cetirizina Cinfa](https://cima.aemps.es/cima/dochtml/ft/66605/FT_66605.html)     | Comprimido entero; subconjunto adulto sin ajuste renal                             |

La presentación procede de las secciones 2 y 3; las cantidades, intervalos y límites proceden
de la 4.2. Una toma diaria se representa como intervalo de 24 horas y su cantidad como límite
diario. La edad mínima adulta y las exclusiones conservadoras delimitan este borrador; no
pretenden transcribir toda la población autorizada. No se ofrecen alternativas entre dosis
ni se incorporan tramos pediátricos, ajustes orgánicos o fracciones de comprimido.

`fuente.hashSeccion` es el SHA-256 del texto normalizado por el sincronizador de **toda** la
sección 4.2, incluidos 4.2.1 y 4.2.2 cuando CIMA los separa. `fuente.cita` es un fragmento literal
de esa sección. La fecha de consulta de este documento no es una fecha de validación.

En loratadina y cetirizina, la sección 4.2 no establece días máximos sin consultar:
`diasMaxSinConsultar` queda vacío. No se inventa una duración; el motor rechaza ese caso incluso
si se añadiera una firma. Los motivos de consulta son etiquetas de la regla, no protocolos
de indicación ni autorización para recomendar el medicamento.

Antes de F6-01 faltan revisión de la transcripción y de los límites exactos, completar los
bloqueos, alergias e interacciones de las secciones 4.3–4.6, y resolver condiciones que aún
no expresa el esquema (por ejemplo, cardiopatía y hepatopatía no grave). Los arrays actuales
no son listas exhaustivas de contraindicaciones. También faltan casos dorados clínicos
revisados, decisiones sobre duraciones no especificadas y firma farmacéutica. Las pruebas
aritméticas del motor siguen usando exclusivamente datos ficticios.

## Verificación y carga

Desde la raíz del repositorio, esta comprobación consulta CIMA con validación Zod, límite de
peticiones y reintentos; no cambia dosis ni estados:

```bash
pnpm --filter @rebotica/sync-cima exec tsx scripts/verificar-reglas.ts
```

`pnpm demo` descarga además los cinco productos y sus fichas, los distribuye por su condición
de prescripción actual y carga las semillas que coincidan con el texto oficial. En
`/escena?pasillo=demo`, sus fichas muestran la banda «Demostración: pendiente de validación
farmacéutica», tanto en lista como en 3D, conservando la posología oficial sin calculadora.

Con PostgreSQL, sincronizar primero el catálogo y reiniciar la API con `REGLAS_DOSIS_DIR`
apuntando a esta carpeta (ruta absoluta recomendada). En la imagen Docker está en
`/app/reglas-dosis`; la carga es opcional. La API no accede a CIMA para importar ni servir las
fichas. Omite registros ausentes o retirados, fuentes obsoletas y citas que no coincidan.
Importa solo borradores sin firma y no sobrescribe una versión existente, aunque esté
`validada` o `revisar`. Una nueva revisión requiere una nueva versión.

Los borradores solo se guardan en la base local: la API devuelve `reglaDosis: null` y, en
`borradorDosis`, únicamente id y versión para la banda. Si ya existe una regla validada y
vigente, esta conserva la prioridad y no se etiqueta como demostración por un borrador posterior.
