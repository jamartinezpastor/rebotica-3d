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
  (para quién, grupo, edad y duración). **No permite abrir un pasillo**: falta el triaje
  determinista F4-03. Una confianza de 0,8 es un umbral de interacción, no una medida
  clínicamente calibrada de seguridad.
- `tipo: "aclaracion"`: hasta tres alternativas distintas del catálogo. Sin coincidencias
  puede devolver cero alternativas para solicitar reformulación, en lugar de inventarlas.

El filtro local normaliza tildes, mayúsculas, separadores, caracteres invisibles y algunas
grafías adversarias. Bloquea antes de llamar a Claude, incluso sin configuración o con el
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

La API usa [Messages con salida estructurada](https://platform.claude.com/docs/en/build-with-claude/structured-outputs),
con esquema estático sin datos del paciente. El texto aparece únicamente en el mensaje
`user`, separado de las instrucciones. No hay herramientas, historial, caché de consultas
ni reintentos automáticos. La salida se valida otra vez con Zod, incluidos límites no
admitidos por el esquema del proveedor. Refusals, JSON inválido, respuestas truncadas,
campos inesperados y fallos del proveedor producen `503` con mensaje fijo, sin contenido
del error. Se limitan entrada, respuesta del proveedor, tiempo (10 s) y concurrencia (8).
La saturación devuelve `429`; las alarmas locales siguen respondiendo.

Configura en el entorno del proceso, solo en ejecución:

| Variable                            | Uso                                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `INTERPRETACION_IA_HABILITADA=true` | Activación explícita tras configurar el acuerdo de tratamiento sin retención  |
| `ANTHROPIC_API_KEY`                 | Secreto del servidor; nunca una variable `VITE_*`                             |
| `ANTHROPIC_MODEL`                   | Por defecto `claude-haiku-5-5`; también se admite `claude-haiku-4-5-20251001` |

Un modelo distinto requiere revisión del contrato, privacidad y evaluación antes de añadirlo
a la lista admitida. La bandera no configura por sí sola la retención de la cuenta del
proveedor. Verificarla con la organización según la documentación de
[retención de la API](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention).
Sin habilitación y clave, o con modelo no admitido, solo funciona el filtro local; las
otras consultas responden `503`. El arranque no lee archivos `.env` automáticamente:
la muestra `.env.example` sirve de referencia para el entorno o Coolify.

Se silencia el logger de la ruta, también en errores de JSON y métodos incorrectos. No
activar captura de cuerpos, cabeceras ni URLs de consultas en el proxy, APM o middleware.
Los errores operativos expuestos son constantes. No se ha añadido analítica.

## Evaluación reproducible y estado

`test/fixtures/consultas.ts` contiene **100 frases sintéticas** redactadas de forma natural:
60 alarmas (incluidas negaciones e inyecciones adversarias), 32 consultas clasificables y
8 entradas fuera del catálogo. No son datos reales de pacientes ni etiquetas aprobadas
por un profesional sanitario.

La CI comprueba las 100 contra el primer filtro a través de HTTP: las 60 alarmas derivan
sin llamar al proveedor y las otras 40 llegan al clasificador. Los tests adicionales usan
transporte simulado para contratos, privacidad, límites y fallos. **Esto no mide la
exactitud de Claude** y no completa la validación clínica del ticket.

Con el entorno configurado, ejecutar:

```powershell
pnpm --filter @rebotica/api eval:interpretacion
```

El comando evalúa el pipeline completo con esas 100 frases: 60 se resuelven localmente y
40 consultan el modelo. Imprime identificadores y contadores, nunca entrada, salida o
errores del proveedor; termina con código distinto de cero si hay desviaciones o errores.
Repetirlo al cambiar modelo o prompt y revisar los errores con el responsable farmacéutico.
También se necesita ampliar la evaluación secundaria de alarmas que no reconozca el filtro.

La ejecución real queda pendiente de credenciales y de revisión del corpus. F4-03 conecta el
mostrador únicamente tras revisión y envío explícito con `Continuar`, y aplica después el
[triaje determinista](TRIAJE.md). La clasificación por sí sola nunca abre un pasillo.
