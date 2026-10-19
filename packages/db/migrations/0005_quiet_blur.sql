ALTER TABLE "medicamento" DROP CONSTRAINT "medicamento_receta_sin_foto";--> statement-breakpoint
ALTER TABLE "regla_dosis" DROP CONSTRAINT "regla_dosis_sin_receta";--> statement-breakpoint
ALTER TABLE "regla_dosis" DROP CONSTRAINT "regla_dosis_medicamento_fk";
--> statement-breakpoint
ALTER TABLE "regla_dosis" ADD CONSTRAINT "regla_dosis_medicamento_fk" FOREIGN KEY ("nregistro","receta") REFERENCES "public"."medicamento"("nregistro","receta") ON DELETE no action ON UPDATE cascade;