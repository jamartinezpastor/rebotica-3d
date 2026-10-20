# Triaje — F4-03

El motor vive en `@rebotica/protocolos`. Evalúa únicamente condiciones estructuradas del
JSON firmado: nunca interpreta descripciones con un modelo, ejecuta código del JSON ni
incorpora umbrales clínicos de memoria. Las pruebas usan protocolos y umbrales ficticios
fuera de `data/`. Los 14 borradores clínicos corresponden a F4-04 y su validación a F6-01.

## Protocolo ejecutable

Cada criterio de derivación admite `cuando`, con `todas` o `alguna` y condiciones atómicas:

```json
{
  "id": "alarma-ficticia",
  "descripcion": "Señal ficticia de prueba",
  "urgencia": "112",
  "palabrasClave": [],
  "cuando": {
    "todas": [{ "preguntaId": "alarma", "operador": "igual", "valor": true }]
  }
}
```

Operadores: `igual`, `menor`, `menorIgual`, `mayor`, `mayorIgual`. Cada condición referencia
una pregunta existente y un valor compatible. No se permite comparar numéricamente grupos
o respuestas sí/no. Identificadores y opciones deben ser únicos. Se conservan los borradores
antiguos sin `cuando` para su revisión; **nunca autorizan un pasillo desde el triaje**.

Las preguntas tienen respuesta explícita, sin valores preseleccionados:

- `grupo`: adulto, niño, bebé, embarazo o lactancia.
- `edad`: meses, admitiendo fracciones para menores de un mes.
- `duracion`: horas.
- `siNo`: booleano real, sin coerción desde cadenas.
- `opciones`: uno de los valores cerrados definidos en el protocolo.

Las restricciones de balda deben estar cubiertas por preguntas. Grupo y edad proceden de
las preguntas correspondientes; una condición excluida se confirma mediante una pregunta
`siNo` con el mismo identificador, donde «sí» significa que está presente. El revisor debe
comprobar que las preguntas, condiciones, unidades y exclusiones son completas y coherentes;
la validación estructural no sustituye esa revisión.

Una respuesta ausente tiene valor desconocido. El motor deriva inmediatamente si un
criterio ya se cumple, aunque falten respuestas. Conserva todos los motivos y elige el mayor
nivel de urgencia: `112`, `urgencias`, `medico`, `farmaceutico`. Si no hay derivación, exige
todas las respuestas antes de permitir el pasillo. No inventa criterios transversales ni
umbrales de edad, embarazo o duración: deben constar en cada protocolo revisado.

## API

| Ruta                      | Comportamiento                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `GET /api/protocolos/:id` | Devuelve título, versión y preguntas de un protocolo firmado y ejecutable                     |
| `POST /api/triaje`        | Acepta `{ protocoloId, version, respuestas }`; devuelve `preguntas`, `derivar` o `recomendar` |

No se aceptan datos del paciente en la query ni texto libre en el triaje. La publicación
comprueba identidad, versión, estado y firma coherentes entre BD y JSON, con fecha no futura.
Sin protocolo válido o sin BD responde `503`. Una versión distinta responde `409`; la
interfaz solicita empezar de nuevo. Tipos, claves o respuestas no válidos responden `400`.
Los errores no exponen excepciones ni contenido de la petición. Las rutas silencian el
logger y devuelven `Cache-Control: no-store`, también en errores.

`recomendar` incluye `pasilloId`, versión y el pasillo **ya filtrado** por las respuestas.
Se reutiliza la construcción del catálogo existente: sin receta en baldas y con receta en
vitrina, con las mismas fichas. Esto evita enviar el perfil a un GET, al historial o a una
caché compartida. `derivar` no incluye productos, vitrina ni pasillo.

## Interfaz y privacidad

El mostrador conserva la revisión local. Solo `Continuar`, tras explicar el envío, inicia
la consulta: texto libre pasa por F4-02; chips cerrados van directamente al protocolo sin
Claude. Una clasificación no abre el pasillo. Los datos inferidos por el modelo no se
utilizan como respuestas confirmadas: el usuario responde las tarjetas, una por una.
Una confianza baja ofrece alternativas antes del triaje.

Desde la revisión se ocultan los enlaces a la demostración. Las alarmas sustituyen toda
vista de productos por el motivo y el contacto apropiado. Conducta suicida muestra apoyo
específico y emergencias, incluso si coincide con otra alarma. Contactos contrastados con
el servicio de líneas de ayuda de la sesión y el
[servicio público de emergencias en España](https://administracion.gob.es/tu-espacio-europeo/derechos-obligaciones/ciudadanos/asistencia-sanitaria/numeros-urgencia).
La cita por comunidad autónoma corresponde a F4-05; no se inventan teléfonos de centros.

`No lo sé` cierra el flujo de productos y ofrece consultar al farmacéutico. Los fallos de
red, contrato o disponibilidad también bloquean el pasillo, con opción de nueva consulta
y contacto de emergencias. La espera se limita a 30 segundos. No se guardan texto o respuestas
en URL, almacenamiento, registros ni analítica. Los datos viven en memoria; nueva consulta,
salida, restauración de BFCache y desmontaje abortan las peticiones e invalidan resultados
tardíos. El pasillo recibido se muestra en memoria en las vistas 3D y lista sin otra petición
con datos del paciente.

## Verificación y límite actual

Las pruebas cubren operadores y límites ficticios, condiciones todas/alguna, respuestas
ausentes, prioridad de derivación, contratos, firma/versiones, filtrado del catálogo,
privacidad, cancelación, resultados tardíos, foco y el flujo hasta la lista.

Sin protocolos clínicos firmados instalados, el mostrador muestra la indisponibilidad y
ofrece atención profesional. El código no convierte borradores en recomendaciones ni los
firma automáticamente. La evaluación real de Claude y la revisión clínica del corpus de
F4-02 siguen pendientes; este ticket no las da por realizadas.
