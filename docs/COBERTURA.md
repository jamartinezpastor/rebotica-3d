# F1-06 — estado y cobertura del catálogo

La copia local se evalúa sin llamar a CIMA o Gemini y sin recibir texto de usuarios. Se cuentan
solo medicamentos comercializados; receta y sin receta permanecen separados. Esto es cobertura
documental de búsquedas, no una evaluación clínica ni una lista de tratamientos adecuados.

## Estado verificable

`GET /api/catalogo/estado` devuelve un contrato Zod con recuentos y marcas de sincronización:

- `vacio`: no hay medicamentos comercializados guardados.
- `parcial`: hay datos, pero falta una marca válida de sincronización correcta o existe una carga
  completa pendiente. Incluye las muestras de demostración y las cargas interrumpidas.
- `completo`: hay datos, existe `cima.ultima_sincronizacion` válida y no hay carga completa pendiente.

Una marca de carga pendiente no demuestra que el proceso esté ejecutándose: la interfaz habla
de «copia parcial», sin prometer una descarga activa. Marcas inválidas o futuras no certifican
completitud. La API expone recuentos de comercializados con y sin indicaciones 4.1 consultables.

`sincronizadoHasta` es la marca de agua de CIMA, no la hora en que acabó el job. En una carga
completa reanudada conserva el inicio original: los cambios posteriores se recogen con el siguiente
incremental. «Completo» no significa que todos los medicamentos tengan documentación segmentada
ni que la copia incluya cambios posteriores a su marca de agua.
Este estado describe los datos de medicamentos, no la generación de fotos y miniaturas.

Las respuestas de exploración incorporan este estado. El detalle de los resultados se puede
desplegar; la portada no añade avisos ni peticiones. Una búsqueda vacía distingue una copia parcial
de cero coincidencias documentales. Una copia completa sin ninguna indicación consultable devuelve
`503 CATALOGO_SIN_INDICACIONES`, distinto de `CATALOGO_NO_SINCRONIZADO`, y permite explorar el catálogo
general con sus enlaces a los prospectos oficiales.

La web actual pide los metadatos con `X-Rebotica-Catalogo: 1` en `/api/catalogo` y `/api/explorar`.
Sin esa cabecera se conserva el cuerpo del contrato anterior, para que una PWA que todavía tenga
la versión previa no falle al validar campos nuevos. Los endpoints de diagnóstico no necesitan
la cabecera y siempre devuelven el estado completo.

## Informe y comprobación de un registro

Con la API en marcha:

```bash
pnpm cobertura
pnpm cobertura --registro 67968
```

Para leer directamente la copia de `pnpm catalogo` sin arrancar la API ni sincronizar:

```bash
pnpm cobertura --local
pnpm cobertura --local --registro 67968
```

El modo local usa `.local/catalogo/`, o `CATALOGO_DIR`, y requiere que ningún servidor tenga abierta
esa base. Aplica las migraciones pendientes, lee la copia y libera el bloqueo al salir. No descarga
medicamentos ni modifica sus indicaciones. El modo API admite `API_URL`; nunca incorpora consultas
o perfiles en las URLs. Los diagnósticos públicos no exponen los conteos de uso de `consulta_conteo`.

`GET /api/catalogo/cobertura` e `pnpm cobertura` muestran:

- Estado y número de medicamentos con y sin sección 4.1 disponible.
- Las 14 dolencias, sus expresiones de búsqueda y recuentos separados por receta.
- Fecha de evaluación y versión de las correspondencias.
- Con `--registro`, los términos coincidentes y el hash local de la sección de ese medicamento.

Un medicamento puede coincidir con varias dolencias; la suma entre dolencias no representa
medicamentos únicos. Un cero en una copia parcial es provisional. El informe no garantiza
exhaustividad clínica, ni cambia los medicamentos que devuelve la búsqueda.

## Correspondencias y límites

La única fuente de expresiones es `packages/shared/src/indicaciones.ts`, compartida por la API,
el agrupador de consultas y el informe. Se normalizan acentos, mayúsculas y separadores, manteniendo
límites de palabra. No se añaden sinónimos nuevos en F1-06; se documenta y prueba la versión 1.

Ejemplos sintéticos del criterio:

| Texto disponible                     | Resultado                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| «cefaleas» en 4.1                    | Coincide con dolor de cabeza.                                                   |
| «microcefaleas»                      | No coincide por prefijo.                                                        |
| «dolor ocasional leve o moderado»    | No se infiere que sea dolor de cabeza.                                          |
| «cefalea» solo en 4.2 o en el nombre | No genera una asociación documental.                                            |
| 4.1 ausente o vacía                  | El producto queda en el catálogo general, sin asignarle dolencias por su grupo. |

Las expresiones son búsquedas textuales: no interpretan negaciones, el contexto clínico ni las
restricciones de edad y condiciones. Por eso el resultado mantiene las fichas completas y no se
presenta como una recomendación personalizada. Una futura ampliación necesita evidencia documental,
pruebas positivas y negativas y actualizar `VERSION_CORRESPONDENCIAS`; no basta compartir principio
activo con otro producto ni una propuesta del modelo de lenguaje.

## Verificación local del 24/10/2026

La evaluación de la copia persistente encontró 16 100 medicamentos: 1 065 sin receta y 15 035 con
receta. De ellos, 14 591 tenían indicaciones consultables y 1 509 no. La marca de agua era
`2026-10-23T19:45:50.982Z`, sin carga completa pendiente.

Para dolor de cabeza se encontraron 30 coincidencias sin receta y 248 con receta. El registro
67968 mostró coincidencia por la expresión «dolor de cabeza» de su 4.1. Son resultados de esa copia
y de la versión 1 de correspondencias; no son cantidades fijas que deban imponerse en los tests.
Las pruebas automáticas de asociaciones y recuentos usan exclusivamente productos y textos ficticios.
