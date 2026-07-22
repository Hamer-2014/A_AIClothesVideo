DO $$ BEGIN
 CREATE TYPE "public"."capture_protocol" AS ENUM('product_showcase', 'product_rotation', 'model_turn');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "video_jobs" ADD COLUMN "capture_protocol" "capture_protocol" DEFAULT 'product_showcase' NOT NULL;
--> statement-breakpoint
ALTER TABLE "video_jobs" ADD COLUMN "sku_name" text;
