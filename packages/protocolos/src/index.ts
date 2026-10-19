import { GrupoPaciente, Urgencia } from '@rebotica/shared';
import { z } from 'zod';

/**
 * Esquema de un protocolo de indicación farmacéutica (plan §Motor clínico, punto 2).
 * Los protocolos reales viven en `data/` como JSON y los firma un farmacéutico (F4-04).
 */

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id en minúsculas separado por guiones');

export const PreguntaTriaje = z.strictObject({
  id: slug,
  texto: z.string().min(1),
  tipo: z.enum(['grupo', 'edad', 'duracion', 'siNo', 'opciones']),
  opciones: z.array(z.strictObject({ valor: z.string(), etiqueta: z.string() })).optional(),
});

export const CriterioDerivacion = z.strictObject({
  id: slug,
  descripcion: z.string().min(1),
  urgencia: Urgencia,
  /** Palabras que disparan el filtro de alarmas antes de llamar al modelo. */
  palabrasClave: z.array(z.string().min(1)),
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

export const Protocolo = z
  .strictObject({
    id: slug,
    version: z.number().int().positive(),
    titulo: z.string().min(1),
    sinonimos: z.array(z.string().min(1)).min(1),
    preguntasTriaje: z.array(PreguntaTriaje),
    criteriosDerivacion: z.array(CriterioDerivacion).min(1),
    baldas: z.array(Balda).min(1),
    vitrina: z.array(GrupoVitrina),
    consejos: z.array(z.string().min(1)),
    parafarmacia: z.array(z.string().min(1)),
    estado: z.enum(['borrador', 'validado']),
    validadoPor: z.string().min(1).nullable(),
    validadoEn: z.iso.date().nullable(),
  })
  .superRefine((p, ctx) => {
    if (p.estado === 'validado' && (!p.validadoPor || !p.validadoEn)) {
      ctx.addIssue({
        code: 'custom',
        message: 'un protocolo validado necesita firma y fecha',
        path: ['validadoPor'],
      });
    }
  });
export type Protocolo = z.infer<typeof Protocolo>;
