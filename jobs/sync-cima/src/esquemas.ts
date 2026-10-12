import { z } from 'zod';

/**
 * Respuestas de CIMA validadas en la frontera (CLAUDE.md: «Zod en cada frontera»).
 * Solo se declaran los campos que usa la app; el resto se ignora.
 */

const nombreId = z.object({ nombre: z.string() });

/** Elemento de GET /medicamentos. */
export const ItemListado = z.object({
  nregistro: z.string().min(1),
  nombre: z.string(),
  cpresc: z.string().nullish(),
  receta: z.boolean(),
  comerc: z.boolean(),
  vtm: nombreId.nullish(),
  formaFarmaceutica: nombreId.nullish(),
  formaFarmaceuticaSimplificada: nombreId.nullish(),
});
export type ItemListado = z.infer<typeof ItemListado>;

export const Listado = z.object({
  totalFilas: z.number().int().nonnegative(),
  pagina: z.number().int().positive(),
  tamanioPagina: z.number().int().positive(),
  resultados: z.array(ItemListado),
});
export type Listado = z.infer<typeof Listado>;

/** Respuesta de GET /medicamento?nregistro=… */
export const Detalle = z.object({
  nregistro: z.string().min(1),
  nombre: z.string(),
  pactivos: z.string().nullish(),
  labtitular: z.string().nullish(),
  receta: z.boolean(),
  comerc: z.boolean(),
  conduc: z.boolean().default(false),
  triangulo: z.boolean().default(false),
  psum: z.boolean().default(false),
  dosis: z.string().nullish(),
  formaFarmaceutica: nombreId.nullish(),
  principiosActivos: z.array(z.object({ nombre: z.string() })).default([]),
  atcs: z.array(z.object({ codigo: z.string() })).default([]),
  presentaciones: z
    .array(
      z.object({
        cn: z.string().min(1),
        nombre: z.string(),
        comerc: z.boolean().default(true),
        psum: z.boolean().default(false),
      }),
    )
    .default([]),
  fotos: z.array(z.object({ tipo: z.string(), url: z.string() })).default([]),
});
export type Detalle = z.infer<typeof Detalle>;

/** Respuesta de GET /docSegmentado/contenido/1 (con o sin `seccion`). */
export const SeccionesFT = z.array(
  z.object({
    seccion: z.string(),
    titulo: z.string(),
    // Las secciones padre («4») llegan sin contenido: solo cuentan las que lo tienen.
    contenido: z.string().optional(),
  }),
);
export type SeccionesFT = z.infer<typeof SeccionesFT>;

/**
 * GET /registroCambios. `tipoCambio`: 1 alta, 2 baja, 3 modificación.
 * `cambio` lista qué cambió: «ft» (ficha técnica), «prosp», «estado», «comerc», «psum»…
 */
export const PaginaCambios = z.object({
  totalFilas: z.number().int().nonnegative(),
  pagina: z.number().int().positive(),
  tamanioPagina: z.number().int().positive(),
  resultados: z.array(
    z.object({
      nregistro: z.string().min(1),
      tipoCambio: z.number().int(),
      cambio: z.array(z.string()).default([]),
    }),
  ),
});
export type PaginaCambios = z.infer<typeof PaginaCambios>;
