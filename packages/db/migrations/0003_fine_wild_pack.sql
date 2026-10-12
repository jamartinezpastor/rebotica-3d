ALTER TABLE "asset_caja" ADD COLUMN "paleta" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_caja" ADD COLUMN "foto" text;--> statement-breakpoint
ALTER TABLE "asset_caja" ADD CONSTRAINT "asset_caja_paleta_hex" CHECK ("asset_caja"."paleta"::text ~ '^\{(#[0-9a-fA-F]{6}(,#[0-9a-fA-F]{6})*)?\}$');--> statement-breakpoint
ALTER TABLE "asset_caja" ADD CONSTRAINT "asset_caja_foto_ruta" CHECK ("asset_caja"."foto" IS NULL OR "asset_caja"."foto" ~ '^/media/miniaturas/[A-Za-z0-9._-]+$');