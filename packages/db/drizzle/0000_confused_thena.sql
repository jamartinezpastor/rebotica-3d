CREATE TABLE "asset_caja" (
	"nregistro" text PRIMARY KEY NOT NULL,
	"atlas_url" text NOT NULL,
	"uv" jsonb NOT NULL,
	"color_dominante" text,
	"forma" text
);
--> statement-breakpoint
CREATE TABLE "cita_ccaa" (
	"ccaa" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"url" text NOT NULL,
	"revisado_en" date
);
--> statement-breakpoint
CREATE TABLE "consulta_evento" (
	"id" serial PRIMARY KEY NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"protocolo_id" text NOT NULL,
	"origen" text NOT NULL,
	"derivado" boolean DEFAULT false NOT NULL
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
	CONSTRAINT "medicamento_nregistro_receta_uq" UNIQUE("nregistro","receta")
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
	"descripcion" text NOT NULL,
	"foto_url" text,
	"revisado" boolean DEFAULT false NOT NULL,
	CONSTRAINT "producto_para_ean_unique" UNIQUE("ean")
);
--> statement-breakpoint
CREATE TABLE "protocolo" (
	"id" text NOT NULL,
	"version" integer NOT NULL,
	"json" jsonb NOT NULL,
	"estado" text NOT NULL,
	"validado_por" text,
	"validado_en" date,
	CONSTRAINT "protocolo_id_version_pk" PRIMARY KEY("id","version"),
	CONSTRAINT "protocolo_validado_firmado" CHECK ("protocolo"."estado" <> 'validado' OR ("protocolo"."validado_por" IS NOT NULL AND "protocolo"."validado_en" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "regla_dosis" (
	"id" serial PRIMARY KEY NOT NULL,
	"nregistro" text NOT NULL,
	"receta" boolean DEFAULT false NOT NULL,
	"version" integer NOT NULL,
	"json" jsonb NOT NULL,
	"hash_seccion" text NOT NULL,
	"estado" text NOT NULL,
	CONSTRAINT "regla_dosis_nregistro_version_uq" UNIQUE("nregistro","version"),
	CONSTRAINT "regla_dosis_sin_receta" CHECK ("regla_dosis"."receta" = false)
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
	CONSTRAINT "seccion_ft_nregistro_seccion_pk" PRIMARY KEY("nregistro","seccion")
);
--> statement-breakpoint
ALTER TABLE "asset_caja" ADD CONSTRAINT "asset_caja_nregistro_medicamento_nregistro_fk" FOREIGN KEY ("nregistro") REFERENCES "public"."medicamento"("nregistro") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentacion" ADD CONSTRAINT "presentacion_nregistro_medicamento_nregistro_fk" FOREIGN KEY ("nregistro") REFERENCES "public"."medicamento"("nregistro") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regla_dosis" ADD CONSTRAINT "regla_dosis_medicamento_fk" FOREIGN KEY ("nregistro","receta") REFERENCES "public"."medicamento"("nregistro","receta") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seccion_ft" ADD CONSTRAINT "seccion_ft_nregistro_medicamento_nregistro_fk" FOREIGN KEY ("nregistro") REFERENCES "public"."medicamento"("nregistro") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "medicamento_receta_comerc_idx" ON "medicamento" USING btree ("receta","comerc");