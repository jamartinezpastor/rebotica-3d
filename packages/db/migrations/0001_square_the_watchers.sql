CREATE TABLE "sync_estado" (
	"clave" text PRIMARY KEY NOT NULL,
	"valor" text NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
