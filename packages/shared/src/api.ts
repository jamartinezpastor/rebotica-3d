import { z } from 'zod';
import { FormaCaja, GrupoPaciente } from './dominio';

/**
 * Contratos de la API pública (plan §Endpoints). Los usan la API para validar lo que envía y
 * la web para validar lo que recibe.
 */

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/**
 * Aspecto de la caja: la web la dibuja con estos colores (extraídos de la foto del envase) y los
 * datos del producto. `foto` es la miniatura de CIMA que sirve la API, si existe.
 */
export const AssetCajaPublico = z.strictObject({
  colorDominante: hexColor,
  paleta: z.array(hexColor).max(4),
  foto: z
    .string()
    .regex(/^\/media\/miniaturas\/[A-Za-z0-9._-]+$/)
    .nullable(),
});
export type AssetCajaPublico = z.infer<typeof AssetCajaPublico>;

export const ProductoResumen = z.strictObject({
  /** Clasificación clínica revisada; nunca se deduce del nombre o de la forma del envase. */
  clasificacion: z
    .strictObject({
      edadMinPediatricaMeses: z.number().int().min(0).max(215).nullable(),
      consultas: z.array(z.strictObject({ id: z.string().min(1), titulo: z.string().min(1) })),
    })
    .optional(),
  receta: z.boolean(),
  nregistro: z.string().min(1),
  nombre: z.string().min(1),
  principioActivo: z.string().min(1),
  forma: z.string().nullable(),
  formaCaja: FormaCaja,
  dosis: z.string().nullable(),
  /** Categoría terapéutica legible (p. ej. «Analgésicos»), o el grupo ATC si no hay otra. */
  categoria: z.string().nullable(),
  /** Laboratorio titular de la autorización. */
  laboratorio: z.string().nullable(),
  generico: z.boolean(),
  conduccion: z.boolean(),
  asset: AssetCajaPublico.nullable(),
  /** true si hay una regla de dosis validada y vigente: la ficha muestra la calculadora. */
  calculadora: z.boolean(),
});
export type ProductoResumen = z.infer<typeof ProductoResumen>;

export const BaldaPasillo = z.strictObject({
  titulo: z.string().min(1),
  principioActivo: z.string().min(1),
  orden: z.number().int().positive(),
  productos: z.array(ProductoResumen).refine((productos) => productos.every((p) => !p.receta), {
    message: 'Las baldas sin receta no admiten medicamentos de la vitrina',
  }),
});
export type BaldaPasillo = z.infer<typeof BaldaPasillo>;

/**
 * Grupo de la vitrina, separado del catálogo sin receta y con acceso a las mismas fichas.
 */
export const GrupoVitrinaPublico = z.strictObject({
  productos: z.array(ProductoResumen).refine((productos) => productos.every((p) => p.receta), {
    message: 'La vitrina solo contiene productos que requieren receta',
  }),
  principioActivo: z.string().min(1),
  formas: z.array(z.string().min(1)),
  paraQueSeUsa: z.string().min(1),
  porQueNecesitaReceta: z.string().min(1),
  situacion: z.string().min(1),
});
export type GrupoVitrinaPublico = z.infer<typeof GrupoVitrinaPublico>;

/** Perfil del triaje con el que se filtran las baldas (query de GET /api/pasillos/:id). */
export const PerfilPasillo = z.object({
  grupo: GrupoPaciente.optional(),
  edadMeses: z.coerce.number().int().min(0).max(1500).optional(),
  condiciones: z
    .string()
    .max(500)
    .transform((s) =>
      s
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    )
    .optional(),
});
export type PerfilPasillo = z.infer<typeof PerfilPasillo>;

export const PasilloResponse = z.strictObject({
  id: z.string().min(1),
  version: z.number().int().positive(),
  titulo: z.string().min(1),
  /** `borrador`: la UI debe mostrar «Demostración: pendiente de validación farmacéutica». */
  estado: z.enum(['borrador', 'validado', 'informativo']),
  baldas: z.array(BaldaPasillo),
  /** Baldas que el perfil del paciente deja fuera (no se detallan). */
  ocultasPorPerfil: z.number().int().min(0),
  vitrina: z.array(GrupoVitrinaPublico),
  consejos: z.array(z.string()),
  parafarmacia: z.array(z.string()),
});
export type PasilloResponse = z.infer<typeof PasilloResponse>;

export const PresentacionPublica = z.strictObject({
  cn: z.string().min(1),
  nombre: z.string(),
  problemaSuministro: z.boolean(),
});

export const SeccionFichaPublica = z.strictObject({
  /** Huella de la sección actual, necesaria para comprobar la vigencia de la calculadora. */
  hash: z.string().min(1).optional(),
  seccion: z.string().regex(/^4\.[1-7]$/),
  titulo: z.string(),
  /** Texto plano de la ficha técnica, nunca HTML. */
  texto: z.string(),
  /** Resumen en lenguaje llano ya revisado por un farmacéutico; nulo si no existe. */
  resumenLlano: z.string().nullable(),
});

export const ProductoResponse = z.strictObject({
  /** Solo metadatos: un borrador nunca se envía como regla ejecutable. */
  borradorDosis: z
    .strictObject({ id: z.string().min(1), version: z.number().int().positive() })
    .nullable()
    .optional(),
  receta: z.boolean(),
  nregistro: z.string().min(1),
  nombre: z.string().min(1),
  principioActivo: z.string().min(1),
  laboratorio: z.string().nullable(),
  categoria: z.string().nullable(),
  forma: z.string().nullable(),
  formaCaja: FormaCaja,
  dosis: z.string().nullable(),
  generico: z.boolean(),
  conduccion: z.boolean(),
  triangulo: z.boolean(),
  problemaSuministro: z.boolean(),
  asset: AssetCajaPublico.nullable(),
  presentaciones: z.array(PresentacionPublica),
  secciones: z.array(SeccionFichaPublica),
  enlaces: z.strictObject({ prospecto: z.url(), fichaTecnica: z.url() }),
  /**
   * Regla de dosis validada y vigente (esquema `ReglaDosis` de `@rebotica/dosis`, que la API
   * valida antes de enviarla). Si es null, la ficha muestra el texto de la sección 4.2.
   */
  reglaDosis: z.unknown().nullable(),
});
export type ProductoResponse = z.infer<typeof ProductoResponse>;

export const ErrorResponse = z.strictObject({ error: z.string() });
export type ErrorResponse = z.infer<typeof ErrorResponse>;
