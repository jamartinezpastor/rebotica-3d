import {
  GrupoPaciente,
  Urgencia,
  PreguntaTriaje,
  CuandoTriaje,
  respuestaValida,
} from '@rebotica/shared';
import { z } from 'zod';

/**
 * Esquema de un protocolo de indicación farmacéutica (plan §Motor clínico, punto 2).
 * Los borradores viven en `data/` (F4-04); requieren revisión y firma farmacéutica (F6-01).
 */

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id en minúsculas separado por guiones');

export { PreguntaTriaje } from '@rebotica/shared';

export const CriterioDerivacion = z.strictObject({
  id: slug,
  descripcion: z.string().min(1),
  urgencia: Urgencia,
  /** Palabras que disparan el filtro de alarmas antes de llamar al modelo. */
  palabrasClave: z.array(z.string().min(1)),
  /** Opcional para leer borradores anteriores; sin condición el triaje no autoriza pasillos. */
  cuando: CuandoTriaje.optional(),
});

/** Una balda del pasillo: un principio activo sin receta y a quién no se muestra. */
export const Balda = z.strictObject({
  titulo: z.string().min(1),
  principioActivo: z.string().min(1),
  orden: z.number().int().min(1),
  edadMinMeses: z.number().int().min(0).optional(),
  gruposExcluidos: z.array(GrupoPaciente),
  condicionesExcluidas: z.array(z.string()),
});

/**
 * Definición curada de un grupo de la vitrina. Los productos y sus fichas se resuelven desde
 * el catálogo local de CIMA, sin introducir marcas ni posología en el protocolo clínico.
 */
export const GrupoVitrina = z.strictObject({
  principioActivo: z.string().min(1),
  paraQueSeUsa: z.string().min(1),
  porQueNecesitaReceta: z.string().min(1),
  situacion: z.string().min(1),
});

/** Trazabilidad editorial; consultar una fuente no equivale a validar el protocolo. */
export const RevisionProtocolo = z.strictObject({
  consultadoEn: z.iso.date(),
  alcance: z.string().min(1),
  fuentes: z
    .array(z.strictObject({ titulo: z.string().min(1), url: z.url({ protocol: /^https$/ }) }))
    .min(1),
  pendienteDe: z.array(z.string().min(1)),
});

export const Protocolo = z
  .strictObject({
    id: slug,
    version: z.number().int().positive(),
    titulo: z.string().min(1),
    sinonimos: z.array(z.string().min(1)).min(1),
    preguntasTriaje: z.array(PreguntaTriaje).max(30),
    criteriosDerivacion: z.array(CriterioDerivacion).min(1).max(60),
    // Un protocolo puede centrarse en autocuidados/parafarmacia, sin forzar medicación.
    baldas: z.array(Balda),
    vitrina: z.array(GrupoVitrina),
    consejos: z.array(z.string().min(1)),
    parafarmacia: z.array(z.string().min(1)),
    estado: z.enum(['borrador', 'validado']),
    validadoPor: z.string().min(1).nullable(),
    validadoEn: z.iso.date().nullable(),
    revision: RevisionProtocolo.optional(),
  })
  .superRefine((p, ctx) => {
    if (!p.baldas.length && !p.parafarmacia.length && !p.consejos.length) {
      ctx.addIssue({ code: 'custom', message: 'el protocolo necesita contenido de autocuidado' });
    }
    if (p.estado === 'validado' && p.revision?.pendienteDe.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'no se puede validar un protocolo con revisión pendiente',
        path: ['revision', 'pendienteDe'],
      });
    }
    if (
      new Set(p.preguntasTriaje.map((q) => q.id)).size !== p.preguntasTriaje.length ||
      new Set(p.criteriosDerivacion.map((c) => c.id)).size !== p.criteriosDerivacion.length
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'identificadores de preguntas o criterios duplicados',
      });
    }
    for (const tipo of ['grupo', 'edad', 'duracion']) {
      if (p.preguntasTriaje.filter((q) => q.tipo === tipo).length > 1)
        ctx.addIssue({ code: 'custom', message: `pregunta ${tipo} duplicada` });
    }
    for (const c of p.criteriosDerivacion) {
      if (!c.cuando) continue;
      for (const condicion of 'todas' in c.cuando ? c.cuando.todas : c.cuando.alguna) {
        const pregunta = p.preguntasTriaje.find((q) => q.id === condicion.preguntaId);
        if (
          !pregunta ||
          !respuestaValida(pregunta, condicion.valor) ||
          (condicion.operador !== 'igual' && !['edad', 'duracion'].includes(pregunta.tipo))
        ) {
          ctx.addIssue({
            code: 'custom',
            message: 'condición con pregunta o valor incompatible',
            path: ['criteriosDerivacion'],
          });
        }
      }
    }
    if (p.estado === 'validado' && (!p.validadoPor || !p.validadoEn)) {
      ctx.addIssue({
        code: 'custom',
        message: 'un protocolo validado necesita firma y fecha',
        path: ['validadoPor'],
      });
    }
  });
export type Protocolo = z.infer<typeof Protocolo>;

export * from './triaje';
