CREATE TYPE "public"."rights_attestation_scope" AS ENUM(
  'upload',
  'generation_reconfirmation'
);

CREATE TYPE "public"."rights_removal_status" AS ENUM(
  'received',
  'triaging',
  'awaiting_information',
  'action_required',
  'resolved_removed',
  'resolved_rejected'
);

CREATE TYPE "public"."rights_type" AS ENUM(
  'likeness',
  'copyright',
  'trademark',
  'privacy',
  'other'
);

CREATE TABLE "rights_attestations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "version" text NOT NULL,
  "statement_snapshot" text NOT NULL,
  "scope" "rights_attestation_scope" NOT NULL,
  "locale" text DEFAULT 'zh-CN' NOT NULL,
  "ip_hash" text,
  "user_agent_hash" text,
  "accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "redacted_at" timestamp with time zone
);

CREATE TABLE "asset_rights_attestations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asset_id" uuid NOT NULL,
  "rights_attestation_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "rights_removal_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "public_reference" text NOT NULL,
  "status" "rights_removal_status" DEFAULT 'received' NOT NULL,
  "reporter_name" text NOT NULL,
  "reporter_email" text NOT NULL,
  "rights_type" "rights_type" NOT NULL,
  "content_references" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "description" text NOT NULL,
  "good_faith_confirmed" boolean NOT NULL,
  "accuracy_confirmed" boolean NOT NULL,
  "ip_hash" text,
  "user_agent_hash" text,
  "resolution_summary" text,
  "resolved_at" timestamp with time zone,
  "redacted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "asset_rights_attestation_unique"
ON "asset_rights_attestations" USING btree (
  "asset_id",
  "rights_attestation_id"
);

CREATE UNIQUE INDEX "rights_removal_public_reference_unique"
ON "rights_removal_requests" USING btree ("public_reference");

ALTER TABLE "video_jobs"
ADD COLUMN "rights_attestation_snapshot" jsonb;
