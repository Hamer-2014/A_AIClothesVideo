CREATE TYPE "public"."billing_mode" AS ENUM('free_trial', 'paid');--> statement-breakpoint
CREATE TYPE "public"."generation_profile" AS ENUM('trial_540p_watermarked', 'paid_720p_audio', 'paid_1080p_audio');--> statement-breakpoint
ALTER TABLE "video_jobs" ADD COLUMN "billing_mode" "billing_mode" DEFAULT 'paid' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_jobs" ADD COLUMN "generation_profile" "generation_profile" DEFAULT 'paid_720p_audio' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_jobs" ADD COLUMN "watermark_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "video_jobs" ADD COLUMN "trial_eligibility_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "video_segments" ADD COLUMN "generation_profile" "generation_profile" DEFAULT 'paid_720p_audio' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_segments" ADD COLUMN "resolution" text DEFAULT '720p' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_segments" ADD COLUMN "audio_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "video_segments" ADD COLUMN "watermark_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE TABLE "free_trial_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"video_job_id" uuid NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_seconds" integer NOT NULL,
	"generation_profile" "generation_profile" NOT NULL,
	"resolution" text NOT NULL,
	"watermark_enabled" boolean DEFAULT true NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_access_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"event_type" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"path" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
