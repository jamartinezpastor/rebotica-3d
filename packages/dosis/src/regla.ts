import { z } from 'zod';

/**
 * Esquema de una regla de dosis (plan §Motor clínico, punto 3).
 *
 * Una regla se transcribe a mano de la sección 4.2 (posología) de la ficha técnica de CIMA
 * y la firma un farmacéutico. Este paquete NUNCA inventa valores: solo valida la forma de la
 * regla y ejecuta el cálculo determinista sobre reglas validadas.
 */

/** Condiciones del paciente que pueden bloquear una regla o generar un aviso. */
export const CondicionPaciente = z.enum([
  'embarazo',
  'lactancia',
  'hepatopatiaGrave',
  'insuficienciaRenal',
  'anticoagulantes',
  'alergiaAINE',
  'ulceraPeptica',
]);
export type CondicionPaciente = z.infer<typeof CondicionPaciente>;

/** Solo una regla `validada` puede alimentar la calculadora. */
export const EstadoRegla = z.enum(['borrador', 'revisar', 'validada']);
export type EstadoRegla = z.infer<typeof EstadoRegla>;

const positivo = z.number().positive();

const Fuente = z.strictObject({
  nregistro: z.string().min(1),
  seccion: z.literal('4.2'),
  /** Hash del texto de la sección 4.2 cuando se transcribió; si CIMA cambia, la regla pasa a `revisar`. */
  hashSeccion: z.string().min(1),
  validadoPor: z.string().min(1).nullable(),
  fecha: z.iso.date().nullable(),
  /** Cita literal de la sección 4.2, necesaria para obtener un resultado del motor. */
  cita: z.string().trim().min(1).optional(),
});

const Presentacion = z.strictObject({
  concentracion: positivo,
  unidad: z.enum(['mg/ml', 'mg/unidad']),
  unidadToma: z.enum(['ml', 'comprimido', 'capsula', 'sobre', 'supositorio']),
  /** Menor cantidad que el paciente puede medir (0,1 ml en jeringa, 1 comprimido…). */
  pasoDosificable: positivo,
  /** Si el comprimido o sobre se puede partir según la ficha técnica. */
  fraccionable: z.boolean().default(false),
});

const limitesTramo = {
  edadMinMeses: z.number().int().min(0),
  edadMaxMeses: z.number().int().positive().optional(),
  pesoMinKg: positivo.optional(),
  pesoMaxKg: positivo.optional(),
  intervaloHoras: positivo,
};

const TramoPorPeso = z.strictObject({
  ...limitesTramo,
  modo: z.literal('porPeso'),
  mgKgToma: positivo,
  maxMgKgDia: positivo,
  maxMgToma: positivo,
  maxMgDia: positivo.optional(),
});

const TramoFija = z.strictObject({
  ...limitesTramo,
  modo: z.literal('fija'),
  mgToma: positivo,
  maxMgDia: positivo,
  maxMgToma: positivo.optional(),
  maxMgKgDia: positivo.optional(),
});

export const Tramo = z
  .discriminatedUnion('modo', [TramoPorPeso, TramoFija])
  .refine((t) => t.edadMaxMeses === undefined || t.edadMaxMeses > t.edadMinMeses, {
    message: 'edadMaxMeses debe ser mayor que edadMinMeses',
    path: ['edadMaxMeses'],
  })
  .refine(
    (t) => t.pesoMinKg === undefined || t.pesoMaxKg === undefined || t.pesoMaxKg > t.pesoMinKg,
    { message: 'pesoMaxKg debe ser mayor que pesoMinKg', path: ['pesoMaxKg'] },
  );
export type Tramo = z.infer<typeof Tramo>;

export const ReglaDosis = z
  .strictObject({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id en minúsculas separado por guiones'),
    version: z.number().int().positive(),
    fuente: Fuente,
    presentacion: Presentacion,
    tramos: z.array(Tramo).min(1),
    diasMaxSinConsultar: z.record(z.string(), z.number().int().positive()),
    bloqueos: z.array(CondicionPaciente),
    avisos: z.array(CondicionPaciente),
    estado: EstadoRegla,
  })
  .superRefine((regla, ctx) => {
    const { unidad, unidadToma } = regla.presentacion;
    if ((unidad === 'mg/ml') !== (unidadToma === 'ml')) {
      ctx.addIssue({
        code: 'custom',
        message: 'mg/ml solo se toma en ml, y mg/unidad nunca en ml',
        path: ['presentacion', 'unidadToma'],
      });
    }
    const { pasoDosificable, fraccionable } = regla.presentacion;
    if (
      unidad === 'mg/unidad' &&
      !Number.isInteger(pasoDosificable) &&
      (!fraccionable || !['comprimido', 'sobre'].includes(unidadToma))
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'El paso fraccionario requiere un comprimido o sobre fraccionable',
        path: ['presentacion', 'pasoDosificable'],
      });
    }
    // Edades y pesos usan intervalos [mínimo, máximo). No se elige por orden de aparición.
    for (let i = 0; i < regla.tramos.length; i++) {
      const a = regla.tramos[i]!;
      for (let j = i + 1; j < regla.tramos.length; j++) {
        const b = regla.tramos[j]!;
        if (
          Math.max(a.edadMinMeses, b.edadMinMeses) <
            Math.min(a.edadMaxMeses ?? Infinity, b.edadMaxMeses ?? Infinity) &&
          Math.max(a.pesoMinKg ?? 0, b.pesoMinKg ?? 0) <
            Math.min(a.pesoMaxKg ?? Infinity, b.pesoMaxKg ?? Infinity)
        ) {
          ctx.addIssue({
            code: 'custom',
            message: 'Los tramos no pueden solaparse',
            path: ['tramos', j],
          });
        }
      }
    }
    if (regla.estado === 'validada' && (!regla.fuente.validadoPor || !regla.fuente.fecha)) {
      ctx.addIssue({
        code: 'custom',
        message: 'una regla validada necesita firma (validadoPor) y fecha',
        path: ['fuente', 'validadoPor'],
      });
    }
  });
export type ReglaDosis = z.infer<typeof ReglaDosis>;

/**
 * Principio de producto: la calculadora solo aparece con reglas validadas.
 * En cualquier otro estado la ficha muestra la posología en texto.
 */
export function puedeMostrarCalculadora(regla: ReglaDosis): boolean {
  return regla.estado === 'validada';
}
