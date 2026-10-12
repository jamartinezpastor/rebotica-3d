import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Modelo de datos (plan §Modelo de datos y contratos de API).
 * Los nombres de tabla y columna van en snake_case; los de TypeScript, en camelCase.
 */

const actualizadoEn = () =>
  timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow();

/** Copia local de CIMA, sincronizada cada noche. Un medicamento con receta no lleva foto. */
export const medicamento = pgTable(
  'medicamento',
  {
    nregistro: text('nregistro').primaryKey(),
    nombre: text('nombre').notNull(),
    pactivos: text('pactivos').notNull(),
    labtitular: text('labtitular'),
    receta: boolean('receta').notNull(),
    comerc: boolean('comerc').notNull(),
    conduc: boolean('conduc').notNull().default(false),
    triangulo: boolean('triangulo').notNull().default(false),
    psum: boolean('psum').notNull().default(false),
    forma: text('forma'),
    dosis: text('dosis'),
    atcs: text('atcs')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    fotoUrl: text('foto_url'),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [
    // Permite que regla_dosis referencie (nregistro, receta) y la base rechace recetas.
    unique('medicamento_nregistro_receta_uq').on(t.nregistro, t.receta),
    check('medicamento_receta_sin_foto', sql`NOT ${t.receta} OR ${t.fotoUrl} IS NULL`),
    index('medicamento_pactivos_idx').on(t.pactivos),
  ],
);

export const presentacion = pgTable(
  'presentacion',
  {
    cn: text('cn').primaryKey(),
    nregistro: text('nregistro')
      .notNull()
      .references(() => medicamento.nregistro, { onDelete: 'cascade' }),
    nombre: text('nombre').notNull(),
    comerc: boolean('comerc').notNull(),
    psum: boolean('psum').notNull().default(false),
  },
  (t) => [index('presentacion_nregistro_idx').on(t.nregistro)],
);

/** Secciones 4.x de la ficha técnica. `hash` detecta cambios en la 4.2 (F1-03). */
export const seccionFt = pgTable(
  'seccion_ft',
  {
    nregistro: text('nregistro')
      .notNull()
      .references(() => medicamento.nregistro, { onDelete: 'cascade' }),
    seccion: text('seccion').notNull(),
    titulo: text('titulo').notNull(),
    html: text('html').notNull(),
    texto: text('texto').notNull(),
    hash: text('hash').notNull(),
    /** Lo genera un modelo fuera de línea y lo revisa un farmacéutico; nulo hasta entonces. */
    resumenLlano: text('resumen_llano'),
  },
  (t) => [
    primaryKey({ columns: [t.nregistro, t.seccion] }),
    check(
      'seccion_ft_seccion_valida',
      sql`${t.seccion} IN ('4.1','4.2','4.3','4.4','4.5','4.6','4.7')`,
    ),
  ],
);

/** Grupos con receta para la vitrina: solo principio activo, sin marcas ni imágenes. */
export const grupoReceta = pgTable(
  'grupo_receta',
  {
    id: serial('id').primaryKey(),
    pactivo: text('pactivo').notNull(),
    forma: text('forma').notNull(),
    /** Indicación resumida (sección 4.1). */
    indicacion: text('indicacion'),
    /** Condiciones de prescripción (cpresc de CIMA). */
    condicionesPrescripcion: text('condiciones_prescripcion'),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [unique('grupo_receta_pactivo_forma_uq').on(t.pactivo, t.forma)],
);

/** Parafarmacia y productos sanitarios de catálogo propio. */
export const productoPara = pgTable('producto_para', {
  id: serial('id').primaryKey(),
  ean: text('ean').unique(),
  nombre: text('nombre').notNull(),
  categoria: text('categoria').notNull(),
  descripcion: text('descripcion'),
  fotoUrl: text('foto_url'),
  revisado: boolean('revisado').notNull().default(false),
});

/** Protocolo por síntoma en JSON versionado; solo uno `validado` y firmado se publica (F6-01). */
export const protocolo = pgTable(
  'protocolo',
  {
    id: text('id').notNull(),
    version: integer('version').notNull(),
    json: jsonb('json').notNull(),
    estado: text('estado').notNull().default('borrador'),
    validadoPor: text('validado_por'),
    validadoEn: timestamp('validado_en', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.id, t.version] }),
    check('protocolo_estado_valido', sql`${t.estado} IN ('borrador', 'revisar', 'validada')`),
    check(
      'protocolo_validado_con_firma',
      sql`${t.estado} <> 'validada' OR (${t.validadoPor} IS NOT NULL AND ${t.validadoEn} IS NOT NULL)`,
    ),
  ],
);

/**
 * Regla de dosis transcrita de la sección 4.2. `receta` repite el valor de `medicamento`
 * mediante una clave foránea compuesta, de modo que la base rechaza cualquier regla de un
 * medicamento con receta.
 */
export const reglaDosis = pgTable(
  'regla_dosis',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nregistro: text('nregistro').notNull(),
    receta: boolean('receta').notNull().default(false),
    version: integer('version').notNull(),
    json: jsonb('json').notNull(),
    hashSeccion: text('hash_seccion').notNull(),
    estado: text('estado').notNull().default('borrador'),
  },
  (t) => [
    foreignKey({
      name: 'regla_dosis_medicamento_fk',
      columns: [t.nregistro, t.receta],
      foreignColumns: [medicamento.nregistro, medicamento.receta],
    }),
    unique('regla_dosis_nregistro_version_uq').on(t.nregistro, t.version),
    check('regla_dosis_sin_receta', sql`${t.receta} = false`),
    check('regla_dosis_estado_valido', sql`${t.estado} IN ('borrador', 'revisar', 'validada')`),
  ],
);

/** Textura y forma de la caja 3D, generadas en la sincronización (F1-04). */
export const assetCaja = pgTable(
  'asset_caja',
  {
    nregistro: text('nregistro')
      .primaryKey()
      .references(() => medicamento.nregistro, { onDelete: 'cascade' }),
    atlasUrl: text('atlas_url').notNull(),
    uv: real('uv').array().notNull(),
    colorDominante: text('color_dominante').notNull(),
    forma: text('forma').notNull(),
  },
  (t) => [
    check('asset_caja_uv_rect', sql`cardinality(${t.uv}) = 4`),
    check('asset_caja_color_hex', sql`${t.colorDominante} ~ '^#[0-9a-fA-F]{6}$'`),
  ],
);

/** Analítica anónima: sin texto libre ni datos del paciente. */
export const consultaEvento = pgTable(
  'consulta_evento',
  {
    id: serial('id').primaryKey(),
    fecha: timestamp('fecha', { withTimezone: true }).notNull().defaultNow(),
    protocoloId: text('protocolo_id').notNull(),
    origen: text('origen').notNull(),
    derivado: boolean('derivado').notNull(),
  },
  (t) => [check('consulta_evento_origen_valido', sql`${t.origen} IN ('chip', 'texto')`)],
);

/** Enlace oficial de cita de atención primaria por comunidad autónoma (F4-05). */
export const citaCcaa = pgTable('cita_ccaa', {
  ccaa: text('ccaa').primaryKey(),
  nombre: text('nombre').notNull(),
  urlCita: text('url_cita').notNull(),
  telefono: text('telefono'),
  verificadoEn: timestamp('verificado_en', { withTimezone: true }),
});
