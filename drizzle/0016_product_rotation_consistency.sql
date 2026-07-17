CREATE TYPE "public"."asset_subject_kind" AS ENUM(
  'product',
  'human_model',
  'unknown'
);

ALTER TABLE "asset_analyses"
ADD COLUMN "subject_kind" "asset_subject_kind" DEFAULT 'unknown' NOT NULL;

ALTER TABLE "shot_templates"
ADD COLUMN "subject_kind" text DEFAULT 'any' NOT NULL;

ALTER TABLE "shot_templates"
ADD COLUMN "consistency_requirements" jsonb DEFAULT '[]'::jsonb NOT NULL;

ALTER TABLE "shot_templates"
ADD COLUMN "auto_select_allowed" boolean DEFAULT true NOT NULL;

CREATE TABLE "asset_consistency_analyses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "video_job_id" uuid NOT NULL,
  "analysis_kind" text NOT NULL,
  "status" text NOT NULL,
  "garment_match" text NOT NULL,
  "model_match" text NOT NULL,
  "color_match" boolean DEFAULT false NOT NULL,
  "pattern_match" boolean DEFAULT false NOT NULL,
  "view_coverage" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "confidence" text,
  "risk_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "result_json" jsonb NOT NULL,
  "provider_call_log_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "asset_consistency_job_kind_unique"
ON "asset_consistency_analyses" USING btree (
  "video_job_id",
  "analysis_kind"
);
