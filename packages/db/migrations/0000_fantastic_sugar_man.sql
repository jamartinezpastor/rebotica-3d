CREATE TABLE "asset_caja" (
	"nregistro" text PRIMARY KEY NOT NULL,
	"atlas_url" text NOT NULL,
	"uv" real[] NOT NULL,
	"color_dominante" text NOT NULL,
	"forma" text NOT NULL,
	CONSTRAINT "asset_caja_uv_rect" CHECK (cardinality("asset_caja"."uv") = 4),
	CONSTRAINT "asset_caja_color_hex" CHECK ("asset_caja"."color_dominante" ~ '^#[0-9a-fA-F]{6}$')
);
--> statement-breakpoint
CREATE TABLE "cita_ccaa" (
	"ccaa" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"url_cita" text NOT NULL,
	"telefono" text,
	"verificado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "consulta_evento" (
	"id" serial PRIMARY KEY NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"protocolo_id" text NOT NULL,
	"origen" text NOT NULL,
	"derivado" boolean NOT NULL,
	CONSTRAINT "consulta_evento_origen_valido" CHECK ("consulta_evento"."origen" IN ('chip', 'texto'))
);
--> statement-breakpoint
CREATE TABLE "grupo_receta" (
	"id" serial PRIMARY KEY NOT NULL,
	"pactivo" text NOT NULL,
	"forma" text NOT NULL,
	"indicacion" text,
	"condiciones_prescripcion" text,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grupo_receta_pactivo_forma_uq" UNIQUE("pactivo","forma")
);
--> statement-breakpoint
CREATE TABLE "medicamento" (
	"nregistro" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"pactivos" text NOT NULL,
	"labtitular" text,
	"receta" boolean NOT NULL,
	"comerc" boolean NOT NULL,
	"conduc" boolean DEFAULT false NOT NULL,
	"triangulo" boolean DEFAULT false NOT NULL,
	"psum" boolean DEFAULT false NOT NULL,
	"forma" text,
	"dosis" text,
	"atcs" text[] DEFAULT '{}'::text[] NOT NULL,
	"foto_url" text,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "medicamento_nregistro_receta_uq" UNIQUE("nregistro","receta"),
	CONSTRAINT "medicamento_receta_sin_foto" CHECK (NOT "medicamento"."receta" OR "medicamento"."foto_url" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "presentacion" (
	"cn" text PRIMARY KEY NOT NULL,
	"nregistro" text NOT NULL,
	"nombre" text NOT NULL,
	"comerc" boolean NOT NULL,
	"psum" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "producto_para" (
	"id" serial PRIMARY KEY NOT NULL,
	"ean" text,
	"nombre" text NOT NULL,
	"categoria" text NOT NULL,
	"descripcion" text,
	"foto_url" text,
	"revisado" boolean DEFAULT false NOT NULL,
	CONSTRAINT "producto_para_ean_unique" UNIQUE("ean")
);
--> statement-breakpoint
CREATE TABLE "protocolo" (
	"id" text NOT NULL,
	"version" integer NOT NULL,
	"json" jsonb NOT NULL,
	"estado" text DEFAULT 'borrador' NOT NULL,
	"validado_por" text,
	"validado_en" timestamp with time zone,
	CONSTRAINT "protocolo_id_version_pk" PRIMARY KEY("id","version"),
	CONSTRAINT "protocolo_estado_valido" CHECK ("protocolo"."estado" IN ('borrador', 'revisar', 'validada')),
	CONSTRAINT "protocolo_validado_con_firma" CHECK ("protocolo"."estado" <> 'validada' OR ("protocolo"."validado_por" IS NOT NULL AND "protocolo"."validado_en" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "regla_dosis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nregistro" text NOT NULL,
	"receta" boolean DEFAULT false NOT NULL,
	"version" integer NOT NULL,
	"json" jsonb NOT NULL,
	"hash_seccion" text NOT NULL,
	"estado" text DEFAULT 'borrador' NOT NULL,
	CONSTRAINT "regla_dosis_nregistro_version_uq" UNIQUE("nregistro","version"),
	CONSTRAINT "regla_dosis_sin_receta" CHECK ("regla_dosis"."receta" = false),
	CONSTRAINT "regla_dosis_estado_valido" CHECK ("regla_dosis"."estado" IN ('borrador', 'revisar', 'validada'))
);
--> statement-breakpoint
CREATE TABLE "seccion_ft" (
	"nregistro" text NOT NULL,
	"seccion" text NOT NULL,
	"titulo" text NOT NULL,
	"html" text NOT NULL,
	"texto" text NOT NULL,
	"hash" text NOT NULL,
	"resumen_llano" text,
	CONSTRAINT "seccion_ft_nregistro_seccion_pk" PRIMARY KEY("nregistro","seccion"),
	CONSTRAINT "seccion_ft_seccion_valida" CHECK ("seccion_ft"."seccion" IN ('4.1','4.2','4.3','4.4','4.5','4.6','4.7'))
);
--> statement-breakpoint
ALTER TABLE "asset_caja" ADD CONSTRAINT "asset_caja_nregistro_medicamento_nregistro_fk" FOREIGN KEY ("nregistro") REFERENCES "public"."medicamento"("nregistro") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentacion" ADD CONSTRAINT "presentacion_nregistro_medicamento_nregistro_fk" FOREIGN KEY ("nregistro") REFERENCES "public"."medicamento"("nregistro") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regla_dosis" ADD CONSTRAINT "regla_dosis_medicamento_fk" FOREIGN KEY ("nregistro","receta") REFERENCES "public"."medicamento"("nregistro","receta") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seccion_ft" ADD CONSTRAINT "seccion_ft_nregistro_medicamento_nregistro_fk" FOREIGN KEY ("nregistro") REFERENCES "public"."medicamento"("nregistro") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "medicamento_pactivos_idx" ON "medicamento" USING btree ("pactivos");--> statement-breakpoint
CREATE INDEX "presentacion_nregistro_idx" ON "presentacion" USING btree ("nregistro");