import { FormaCaja } from '@rebotica/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  unique,
  primaryKey,
  serial,
  text,
  timestamp,
  date,
} from 'drizzle-orm/pg-core';

/** Copia local de CIMA (AEMPS). Se rellena en la sincronización nocturna (F1-02). */
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
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('medicamento_receta_comerc_idx').on(t.receta, t.comerc),
    // Destino de la clave foránea compuesta de `regla_dosis`.
    unique('medicamento_nregistro_receta_uq').on(t.nregistro, t.receta),
  ],
);

export const presentacion = pgTable('presentacion', {
  cn: text('cn').primaryKey(),
  nregistro: text('nregistro')
    .notNull()
    .references(() => medicamento.nregistro, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  comerc: boolean('comerc').notNull(),
  psum: boolean('psum').notNull().default(false),
});

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
    /** Resumen en lenguaje llano; se genera fuera de línea y lo revisa un farmacéutico. */
    resumenLlano: text('resumen_llano'),
  },
  (t) => [primaryKey({ columns: [t.nregistro, t.seccion] })],
);

/** Catálogo propio de parafarmacia y productos sanitarios. */
export const productoPara = pgTable('producto_para', {
  id: serial('id').primaryKey(),
  ean: text('ean').unique(),
  nombre: text('nombre').notNull(),
  categoria: text('categoria').notNull(),
  descripcion: text('descripcion').notNull(),
  fotoUrl: text('foto_url'),
  revisado: boolean('revisado').notNull().default(false),
});

export const protocolo = pgTable(
  'protocolo',
  {
    id: text('id').notNull(),
    version: integer('version').notNull(),
    json: jsonb('json').notNull(),
    estado: text('estado', { enum: ['borrador', 'validado'] }).notNull(),
    validadoPor: text('validado_por'),
    validadoEn: date('validado_en'),
  },
  (t) => [
    primaryKey({ columns: [t.id, t.version] }),
    check(
      'protocolo_validado_firmado',
      sql`${t.estado} <> 'validado' OR (${t.validadoPor} IS NOT NULL AND ${t.validadoEn} IS NOT NULL)`,
    ),
  ],
);

/**
 * Reglas de dosis transcritas de la sección 4.2. `receta` se copia de `medicamento` y una
 * clave foránea compuesta más un CHECK impiden guardar reglas de medicamentos con receta.
 */
export const reglaDosis = pgTable(
  'regla_dosis',
  {
    id: serial('id').primaryKey(),
    nregistro: text('nregistro').notNull(),
    receta: boolean('receta').notNull().default(false),
    version: integer('version').notNull(),
    json: jsonb('json').notNull(),
    hashSeccion: text('hash_seccion').notNull(),
    estado: text('estado', { enum: ['borrador', 'revisar', 'validada'] }).notNull(),
  },
  (t) => [
    unique('regla_dosis_nregistro_version_uq').on(t.nregistro, t.version),
    check('regla_dosis_sin_receta', sql`${t.receta} = false`),
    foreignKey({
      name: 'regla_dosis_medicamento_fk',
      columns: [t.nregistro, t.receta],
      foreignColumns: [medicamento.nregistro, medicamento.receta],
    }),
  ],
);

export const assetCaja = pgTable('asset_caja', {
  nregistro: text('nregistro')
    .primaryKey()
    .references(() => medicamento.nregistro, { onDelete: 'cascade' }),
  atlasUrl: text('atlas_url').notNull(),
  uv: jsonb('uv').notNull(),
  colorDominante: text('color_dominante'),
  forma: text('forma', { enum: FormaCaja.options as [FormaCaja, ...FormaCaja[]] }),
});

/** Analítica anónima: solo cuenta protocolos. Nunca texto libre ni datos del paciente. */
export const consultaEvento = pgTable('consulta_evento', {
  id: serial('id').primaryKey(),
  fecha: timestamp('fecha', { withTimezone: true }).notNull().defaultNow(),
  protocoloId: text('protocolo_id').notNull(),
  origen: text('origen', { enum: ['chip', 'texto'] }).notNull(),
  derivado: boolean('derivado').notNull().default(false),
});

/** Enlace oficial de cita de atención primaria por comunidad autónoma (tabla curada). */
export const citaCcaa = pgTable('cita_ccaa', {
  ccaa: text('ccaa').primaryKey(),
  nombre: text('nombre').notNull(),
  url: text('url').notNull(),
  revisadoEn: date('revisado_en'),
});
