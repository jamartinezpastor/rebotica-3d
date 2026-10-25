# Privacidad y fuentes — F5-03

Revisión técnica del 24/10/2026. La interfaz pública está en `/informacion`, con enlaces desde
el pie de portada, fichas, comparación y filtros. Este documento describe el código y sus límites;
no verifica la configuración del alojamiento ni la cuenta de Google del despliegue.

## Recorridos y datos

| Recorrido             | Datos enviados                                                                                        | Conservación en la app                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Consulta frecuente    | Identificador cerrado a `POST /api/explorar`                                                          | Conteo agregado por día UTC y dolencia si la respuesta es 200                               |
| Texto libre           | JSON a `POST /api/interpretar`; texto a Gemini si pasa el filtro local y hay clasificador configurado | Sin guardar entrada o respuesta en BD ni logger de la ruta; respuestas `no-store`           |
| Calculadora           | No envía edad, peso, motivo ni condiciones                                                            | Estado en memoria; se limpia al desmontar, `pagehide` y restaurar bfcache                   |
| Filtros y comparación | La comparación solicita solo fichas públicas por registro                                             | Selección en memoria, sin URL ni almacenamiento persistente; comparación se limpia al salir |
| Vista lista/3D        | Sin solicitud adicional                                                                               | Preferencia en `localStorage['rebotica.vista']`                                             |

La PWA guarda archivos de la aplicación, con exclusión de rutas `/api` y `/media` de su fallback
y sin caché de peticiones en ejecución. Los navegadores sí pueden guardar fichas públicas y
miniaturas de acuerdo con sus cabeceras HTTP. El texto de consulta no se guarda en el historial
de navegación por la aplicación.

Los conteos de `consulta_conteo` contienen día, id de dolencia y total. No hay identificador de
persona, IP, texto, perfil ni evento individual. No existe una tarea de eliminación automática
de estos agregados. Los logs de acceso de otras rutas y del proxy o alojamiento pueden incluir
IP, fecha y URL; su configuración y plazos requieren comprobación en esa infraestructura.

## Gemini y sus condiciones

El modelo clasifica en un catálogo cerrado y detecta alarmas; no selecciona medicamentos ni
dosis. Una alarma local puede resolver la petición antes de contactar al proveedor. Los chips
no llaman al modelo. El cálculo de dosis se realiza con código determinista.

La ausencia de almacenamiento del texto en Rebotica no implica retención cero en Google.
El tratamiento del proveedor depende de sus condiciones y de la configuración del proyecto.
No se han comprobado facturación, región, opciones de registro o contribución de esa cuenta.
La activación mediante variables de entorno no certifica ninguno de esos extremos.

Fuentes oficiales consultadas el 24/10/2026:

- [Condiciones de Gemini API](https://ai.google.dev/gemini-api/terms).
- [Registros y uso de datos de Gemini API](https://ai.google.dev/gemini-api/docs/logs-policy).
- [CIMA — AEMPS](https://cima.aemps.es/cima/publico/home.html).

Por decisión del usuario del 25/10/2026, se publica solo información técnica sobre el uso de
datos, sin nombre de responsable ni correo público. La página no se presenta como un aviso
identificativo completo ni una certificación legal.

## Fuentes y versiones verificables

`GET /api/informacion` valida su salida con `InformacionPublica` y devuelve únicamente:

- Versión del paquete de API y de `@rebotica/dosis`, incluidas en el build.
- Versión de correspondencias textuales de indicaciones que usa el catálogo.
- Si existe un clasificador configurado. No demuestra disponibilidad o exactitud del proveedor.
- Estado de la copia local, o `null` si no hay BD o no puede consultarse.

La ruta no admite parámetros de consulta, no registra peticiones y responde `no-store`. No
incluye secretos, configuración privada, firmas de usuarios ni texto de consultas. No llama
a CIMA o Gemini. La información general permanece legible si falla ese endpoint.

La ficha permite consultar, antes de rellenar la calculadora, id y versión de la regla, firma,
fecha, cita y huella de la sección 4.2 utilizada. Solo se ofrece la calculadora si la regla está
validada y coincide con la ficha local. Los metadatos de un borrador se identifican como tales
y no permiten calcular. Ninguna de estas pantallas convierte una coincidencia documental en
una recomendación personalizada.

La portada conserva el input de tres líneas y su enlace discreto de privacidad; no se añade
consentimiento obligatorio, cuentas ni un banner permanente sobre el catálogo.
