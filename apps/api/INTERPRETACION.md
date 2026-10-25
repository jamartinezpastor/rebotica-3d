# Interpretación — F4-02

`POST /api/interpretar` acepta exclusivamente JSON `{ "texto": "…" }` de 1 a 2000
caracteres, sin query ni campos adicionales. Funciona sin base de datos; no consulta CIMA.
El texto no se persiste, no se registra ni aparece en la respuesta. Todas las respuestas,
incluidos errores y métodos incorrectos, llevan `Cache-Control: no-store`.

## Contrato y prioridad

Los esquemas están en `packages/shared/src/interpretacion.ts`.

- `tipo: "derivacion"`: identificadores de alarmas y destino fijo; no contiene protocolo,
  medicamentos ni dosis. El consumidor debe sustituir el pasillo y la vitrina por la
  derivación. La alarma de conducta suicida conserva su identificador si concurre otra
  emergencia; la pantalla debe ofrecer también el apoyo específico y explicar que ante
  peligro inmediato se contacta con emergencias.
- `tipo: "clasificacion"`: protocolo del catálogo cerrado, confianza y datos explícitos
  (para quién, grupo, edad y duración). Permite navegar al **catálogo informativo por tema**;
  no autoriza un tratamiento ni convierte los datos extraídos en un perfil confirmado.
  Una confianza de 0,8 es un umbral de interacción, no una medida
  clínicamente calibrada de seguridad.
- `tipo: "aclaracion"`: hasta tres alternativas distintas del catálogo. Sin coincidencias
  puede devolver cero alternativas para solicitar reformulación, en lugar de inventarlas.

El filtro local normaliza tildes, mayúsculas, separadores, caracteres invisibles y algunas
grafías adversarias. Bloquea antes de llamar a Gemini, incluso sin configuración o con el
proveedor saturado. Es conservador: las menciones negadas, históricas o citadas también
activan la derivación; no es un sistema de comprensión ni un triaje completo. Las alarmas
del modelo siempre prevalecen sobre su clasificación. La prioridad del destino se calcula
en código. Fiebre con grupo bebé también bloquea aunque el modelo omita esa alarma.

El alcance de las señales sigue el plan: dolor torácico, dificultad respiratoria,
convulsiones, sangrado, fiebre en lactantes y conducta suicida; añade pérdida de conciencia,
intoxicación y otras emergencias evidentes. Las referencias públicas para revisar el filtro
son [dolor torácico](https://www.nhs.uk/symptoms/chest-pain/),
[sangre al toser](https://www.nhs.uk/symptoms/coughing-up-blood/) y
[señales de alarma en menores de cinco años](https://www.nhs.uk/baby/health/when-to-get-urgent-medical-help-for-babies-and-children-under-5/).
La revisión farmacéutica y la ampliación del corpus siguen pendientes; no hay garantía de
detectar todas las expresiones de urgencia.

## Proveedor y configuración

La API usa [`generateContent` con salida estructurada](https://ai.google.dev/api/generate-content),
con esquema estático sin datos del paciente. El texto aparece únicamente en el mensaje
`user`, separado de las instrucciones. No hay herramientas, historial, caché de consultas
ni reintentos automáticos. La salida se valida otra vez con Zod. Se solicita un único
candidato y solo se acepta `finishReason: STOP` sin bloqueos de seguridad. Los bloques de
razonamiento se ignoran. Bloqueos de seguridad, JSON inválido, respuestas truncadas,
campos inesperados y fallos del proveedor producen `503` con mensaje fijo, sin contenido
del error. Se limitan entrada, respuesta del proveedor, tiempo (10 s) y concurrencia (8).
La saturación devuelve `429`; las alarmas locales siguen respondiendo.

Configura en el entorno del proceso, solo en ejecución:

| Variable                            | Uso                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `INTERPRETACION_IA_HABILITADA=true` | Activación explícita después de revisar el tratamiento y la retención del proveedor         |
| `GEMINI_API_KEY`                    | Secreto del servidor, enviado mediante `x-goog-api-key`, nunca en URL ni variables `VITE_*` |
| `GEMINI_MODEL`                      | Por defecto `gemini-3.5-flash-lite`; también se admite `gemini-3.8-flash`                   |

Se utiliza la API REST nativa de Gemini Developer API, con `systemInstruction` separado de
`contents` y JSON Schema en `generationConfig.responseFormat.text`. El razonamiento se
configura con nivel `LOW`. No se cambian los contratos públicos del mostrador y el triaje.

Migración desde el proveedor anterior: sustituir `ANTHROPIC_API_KEY` y `ANTHROPIC_MODEL`
por las variables de Gemini y reiniciar el proceso. Las variables antiguas no se usan como
alternativa. No hay fallback a otro proveedor ni SDK añadido al navegador.

Un modelo distinto requiere revisión del contrato, privacidad y evaluación antes de añadirlo
a la lista admitida. Sin habilitación y clave, o con modelo no admitido, solo funciona el
filtro local; las otras consultas responden `503`. Los comandos `dev`, `start` y
`eval:interpretacion` de la API cargan el `.env` de la raíz si existe, sin sobrescribir
variables ya definidas en el entorno. La clave usa el nombre `GEMINI_API_KEY` (con guiones
bajos). El `.env` está excluido de Git y del contexto Docker. La muestra `.env.example`
sirve de referencia; Docker/Coolify siguen recibiendo las variables en tiempo de ejecución.

La aplicación no persiste ni registra consultas. Eso no configura la retención de Google:
la [documentación de retención](https://ai.google.dev/gemini-api/docs/zdr) indica que la API
estándar conserva prompts y respuestas durante un período limitado para supervisar abusos,
incluso en servicios de pago. Para retención cero garantizada o acuerdos empresariales,
Google remite a Vertex AI; **este cliente utiliza Developer API, no Vertex AI**. La bandera
de activación no garantiza retención cero ni acredita un acuerdo. Antes de usar datos
reales debe resolverse este requisito del plan; dejar la integración deshabilitada mientras
no se haya revisado. No se han enviado datos reales durante la migración.

Se silencia el logger de la ruta, también en errores de JSON y métodos incorrectos. No
activar captura de cuerpos, cabeceras ni URLs de consultas en el proxy, APM o middleware.
Los errores operativos expuestos son constantes. Esta ruta no añade analítica. El recorrido de
exploración conserva solo conteos diarios agregados por dolencia, sin texto ni identificadores de
personas (F5-02); la información pública y sus límites se documentan en
[Privacidad y fuentes](../../docs/PRIVACIDAD.md).

## Evaluación reproducible y estado

`test/fixtures/consultas.ts` contiene **100 frases sintéticas** redactadas de forma natural:
60 alarmas (incluidas negaciones e inyecciones adversarias), 32 consultas clasificables y
8 entradas fuera del catálogo. No son datos reales de pacientes ni etiquetas aprobadas
por un profesional sanitario.

La CI comprueba las 100 contra el primer filtro a través de HTTP: las 60 alarmas derivan
sin llamar al proveedor y las otras 40 llegan al clasificador. Los tests adicionales usan
transporte simulado para contratos, privacidad, límites y fallos. **Esto no mide la
exactitud de Gemini** y no completa la validación clínica del ticket.

Con el entorno configurado, ejecutar:

```powershell
pnpm --filter @rebotica/api eval:interpretacion
```

El comando evalúa el pipeline completo con esas 100 frases: 60 se resuelven localmente y
40 consultan el modelo. Separa las peticiones al modelo al menos cuatro segundos; se puede
ajustar con `EVALUACION_INTERVALO_MS` (0–60000) según la cuota disponible. No reintenta
automáticamente las consultas. Imprime identificadores y contadores, nunca entrada, salida o
errores del proveedor; termina con código distinto de cero si hay desviaciones o errores.
Repetirlo al cambiar modelo o prompt y revisar los errores con el responsable farmacéutico.
También se necesita ampliar la evaluación secundaria de alarmas que no reconozca el filtro.

Prueba real del 20/10/2026 con `gemini-3.5-flash-lite`: 100 casos procesados (60 locales y
40 llamadas al modelo), cero desviaciones del corpus, cero fallos de derivación y cero errores
de servicio. La revisión clínica del corpus sigue pendiente; esta prueba no la sustituye.
Se eligió Flash-Lite tras observar tiempos de espera agotados con 3.8 Flash, mientras que
Flash-Lite completó una clasificación sintética con JSON válido en aproximadamente 1,8 s.
La primera tanda sin pausas tuvo errores de disponibilidad; la ejecución completa con pausas
terminó sin errores. No se conservan claves ni respuestas del modelo en este documento.

Cambio de alcance del usuario el 20/10/2026: la portada envía el texto con `Realizar consulta`
y abre `POST /api/explorar` con el identificador del tema.
Los chips cerrados omiten el modelo. No se exige revisión intermedia ni cuestionario para
navegar por indicaciones oficiales; una alarma sigue sustituyendo el catálogo por derivación.
El [triaje determinista](TRIAJE.md) se conserva para un futuro recorrido clínico independiente.
