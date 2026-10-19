# Motor determinista de dosis — F3-02

`calcularDosis(regla, entrada)` es una función pura, sin red ni almacenamiento. Se ejecutará en
el navegador con la regla y la sección 4.2 actual servidas por la API propia. No contiene reglas
clínicas ni elige medicamentos. Se aplica igual a productos sin receta y de la vitrina.

## Entradas y resultados

La entrada se valida con Zod: `edadMeses` (entero entre 0 y 1200), `pesoKg` positivo,
`condiciones`, `motivo`, `pesoConfirmado` y `fuenteActual` (`nregistro`, `hashSeccion`, `texto`).
No se admite una condición desconocida ni se deduce una duración si falta en la regla.

La regla debe estar `validada`, tener firma y fecha, coincidir con el registro y hash actuales y
contener `fuente.cita`, una cita literal presente en el texto actual de la sección. `cita` es
opcional en el esquema para conservar los borradores anteriores, pero obligatoria para calcular.
El cliente debe proporcionar la sección y el hash recibidos de la API, no los copiados de la regla.

El resultado es una unión por `tipo`:

- `noDisponible`: datos o regla inválidos, falta de validación, fuente desactualizada, cita o
  duración ausentes, cantidad no medible, límite diario insuficiente o precisión no soportada.
  La ficha conserva el texto oficial y no muestra una pauta calculada.
- `derivar`: edad/peso fuera de tramo o condición bloqueante. No incluye dosis.
- `confirmarPeso`: requiere revisar y confirmar la entrada. No incluye dosis. La interfaz debe
  invalidar la confirmación cuando cambie la edad o el peso; no debe persistirla.
- `calculada`: cantidad y unidad por toma, mg por toma, intervalo mínimo, máximo de tomas en
  cualquier ventana de 24 horas, límite diario, días máximos para el motivo consultado, avisos y
  trazabilidad con versión, firma, fecha, hash y cita literal.

## Convenciones del cálculo

Los tramos usan intervalos `[mínimo, máximo)` tanto en edad como en peso. El esquema rechaza
tramos que se solapen en ambas dimensiones. Se transcribe la ficha respetando esta convención;
el motor nunca resuelve una ambigüedad escogiendo el primer tramo.

La dosis por peso o fija se limita al máximo por toma si está definido. La presentación la
convierte a ml o unidades reales y se redondea hacia abajo al paso dosificable. Los pasos
fraccionarios de unidades sólidas requieren `fraccionable: true` y comprimido o sobre. No se
fraccionan cápsulas ni supositorios.

Se utiliza aritmética decimal racional con `bigint`, sin añadir tolerancias a los límites. El
resultado debe poder expresarse exactamente como decimal en un `number`; si no, no se calcula.

Para dosis por peso se aplica `maxMgKgDia` y, cuando exista, `maxMgDia`. Para dosis fijas se
aplica `maxMgDia` y, cuando exista, `maxMgKgDia`. `maxMgToma` es obligatorio en el modo por peso y
opcional en el modo fijo, donde `mgToma` ya fija la cantidad inicial.

El máximo de tomas es el menor entre `ceil(24 / intervaloHoras)` y el número entero de tomas que
cabe en el máximo diario. Se cuenta una ventana de 24 horas que excluye su extremo final. El
intervalo es un mínimo y el máximo diario se respeta aunque no permita todas las tomas por
intervalo; el motor no reduce de nuevo la dosis por toma para llenar ese horario. Si no cabe ni
una toma, devuelve `noDisponible`.

## Referencia de peso

`data/peso-oms.json` contiene los meses 0–120, extraídos de cuatro tablas oficiales de la OMS:

- [Estándares de peso por edad, 0–5 años](https://www.who.int/tools/child-growth-standards/standards/weight-for-age).
- [Referencia de peso por edad, 5–10 años](https://www.who.int/tools/growth-reference-data-for-5to19-years/indicators/weight-for-age-5to10-years).

Se conserva la URL y SHA-256 de cada archivo fuente. `scripts/importar_peso_oms.py` reproduce la
extracción con Python estándar; no se ejecuta al calcular ni durante el build. Algunos archivos
de 5–10 años tienen un nombre que empieza por `hfa` en la web de la OMS: se usan los enlaces de
su página de **peso** por edad y sus columnas de peso.

Como la app no recoge sexo, se usa la unión de los rangos −3/+3 desviaciones estándar de niñas
y niños. Ese umbral es una decisión conservadora del prototipo para confirmar entradas; no es
un criterio diagnóstico ni una validación clínica de la pauta. Fuera del rango pide confirmación,
sin modificar el peso. Fuera de los meses cubiertos también pide confirmación: no extrapola a
adolescentes o adultos, para los que la referencia OMS de peso por edad no ofrece esos datos.

## Pruebas y validación pendiente

`pnpm --filter @rebotica/dosis test` ejecuta casos dorados **ficticios**, límites y errores de
entrada, trazabilidad, confirmación del peso y propiedades con `fast-check`: máximos diarios y
por toma, dosis no decreciente al aumentar el peso dentro de un tramo y ausencia de resultados
fuera de tramo. Las tablas OMS son datos reales de crecimiento; ningún valor de dosis procede
de ellas.

Este ticket implementa y verifica el algoritmo. No incorpora reglas de producción ni sustituye
los casos dorados clínicos que deberá revisar y firmar un farmacéutico para cada regla real.
La interfaz con sliders y dibujos está implementada en `apps/web` (F3-03); las reglas semilla
corresponden a F3-04. La UI verifica el hash de la sección actual y la cita antes de mostrar controles.
