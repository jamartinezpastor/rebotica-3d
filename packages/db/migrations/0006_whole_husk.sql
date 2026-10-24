CREATE TABLE "consulta_conteo" (
	"dia" date NOT NULL,
	"protocolo_id" text NOT NULL,
	"total" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "consulta_conteo_dia_protocolo_id_pk" PRIMARY KEY("dia","protocolo_id"),
	CONSTRAINT "consulta_conteo_total_positivo" CHECK ("consulta_conteo"."total" > 0)
);
