CREATE TYPE "public"."asset_role" AS ENUM('front', 'back', 'side', 'detail', 'scene', 'logo', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('uploaded', 'analyzing', 'ready', 'rejected', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."credit_ledger_type" AS ENUM('purchase', 'trial_grant', 'reserve', 'capture', 'release', 'refund', 'admin_adjust');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('created', 'paid', 'failed', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('draft_uploaded', 'lite_check_queued', 'lite_check_running', 'lite_check_passed', 'lite_check_failed', 'asset_analysis_queued', 'asset_analysis_running', 'asset_analysis_passed', 'asset_analysis_failed', 'storyboard_draft_ready', 'storyboard_confirmed', 'prompt_moderation_running', 'prompt_moderation_passed', 'prompt_moderation_blocked', 'credits_reserved', 'segments_queued', 'segment_generating', 'segment_succeeded', 'segment_failed', 'stitching_queued', 'stitching_running', 'stitched', 'post_qa_queued', 'post_qa_running', 'post_qa_passed', 'post_qa_failed', 'deliverable', 'retrying', 'failed_released', 'failed_refunded');--> statement-breakpoint
CREATE TYPE "public"."post_qa_mode" AS ENUM('off', 'lite', 'standard', 'strict');--> statement-breakpoint
CREATE TYPE "public"."post_qa_status" AS ENUM('queued', 'running', 'passed', 'failed', 'manual_review');--> statement-breakpoint
CREATE TYPE "public"."segment_status" AS ENUM('queued', 'generating', 'succeeded', 'failed', 'stored');--> statement-breakpoint
CREATE TYPE "public"."stitch_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."video_aspect_ratio" AS ENUM('9:16', '1:1', '16:9');--> statement-breakpoint
CREATE TYPE "public"."moderation_decision" AS ENUM('allow', 'flag', 'deny', 'error');--> statement-breakpoint
CREATE TYPE "public"."provider_call_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."provider_purpose" AS ENUM('content_safety', 'creem_prompt_moderation', 'lite_asset_check', 'standard_asset_analysis', 'strict_asset_review', 'storyboard', 'video_generation', 'post_qa', 'experimental_video');--> statement-breakpoint
CREATE TYPE "public"."provider_status" AS ENUM('active', 'paused', 'exhausted', 'error');--> statement-breakpoint
CREATE TYPE "public"."shot_template_risk" AS ENUM('low', 'medium', 'medium_high', 'high');--> statement-breakpoint
CREATE TYPE "public"."shot_template_status" AS ENUM('draft', 'beta', 'active', 'paused');--> statement-breakpoint
CREATE TYPE "public"."admin_role" AS ENUM('admin', 'operator');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'paused', 'banned');--> statement-breakpoint
CREATE TABLE "asset_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"provider_call_log_id" uuid,
	"mode" text NOT NULL,
	"asset_role" "asset_role" DEFAULT 'unknown' NOT NULL,
	"garment_category" text,
	"view_angle" text,
	"human_present" text DEFAULT 'unknown' NOT NULL,
	"visible_details" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"not_visible_details" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"quality" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence" text,
	"risk_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"analysis_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "asset_status" DEFAULT 'uploaded' NOT NULL,
	"original_key" text NOT NULL,
	"thumb_key" text,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"detected_role" "asset_role" DEFAULT 'unknown',
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "abuse_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"event_type" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid,
	"actor_email" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid,
	"reason" text,
	"before_snapshot" jsonb,
	"after_snapshot" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet_id" uuid,
	"type" "credit_ledger_type" NOT NULL,
	"amount" integer NOT NULL,
	"balance_before" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reserved_before" integer DEFAULT 0 NOT NULL,
	"reserved_after" integer DEFAULT 0 NOT NULL,
	"related_job_id" uuid,
	"related_order_id" uuid,
	"reason" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_ledger_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "credit_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"available_balance" integer DEFAULT 0 NOT NULL,
	"reserved_balance" integer DEFAULT 0 NOT NULL,
	"total_purchased" integer DEFAULT 0 NOT NULL,
	"total_granted" integer DEFAULT 0 NOT NULL,
	"total_captured" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_wallets_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'created' NOT NULL,
	"provider" text DEFAULT 'creem' NOT NULL,
	"external_order_id" text NOT NULL,
	"product_code" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"credits_granted" integer NOT NULL,
	"webhook_event_id" text,
	"checkout_snapshot" jsonb,
	"webhook_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_external_order_id_unique" UNIQUE("external_order_id")
);
--> statement-breakpoint
CREATE TABLE "job_state_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_job_id" uuid NOT NULL,
	"segment_id" uuid,
	"from_status" text,
	"to_status" text NOT NULL,
	"reason" text,
	"actor_type" text DEFAULT 'system' NOT NULL,
	"actor_id" uuid,
	"event_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_qa_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_job_id" uuid NOT NULL,
	"stitch_job_id" uuid,
	"status" "post_qa_status" DEFAULT 'queued' NOT NULL,
	"mode" "post_qa_mode" NOT NULL,
	"frame_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"result_json" jsonb,
	"failure_category" text,
	"provider_call_log_id" uuid,
	"is_test" boolean DEFAULT false NOT NULL,
	"locked_by" text,
	"locked_until" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_retry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stitch_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_job_id" uuid NOT NULL,
	"status" "stitch_status" DEFAULT 'queued' NOT NULL,
	"segment_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"final_video_key" text,
	"cover_key" text,
	"frame_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"callback_snapshot" jsonb,
	"is_test" boolean DEFAULT false NOT NULL,
	"locked_by" text,
	"locked_until" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_retry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storyboards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_job_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"selected_template_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"storyboard_json" jsonb NOT NULL,
	"final_prompt_snapshot" jsonb,
	"provider_call_log_id" uuid,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_job_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_job_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"role" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "job_status" DEFAULT 'draft_uploaded' NOT NULL,
	"user_visible_status" text DEFAULT 'uploaded' NOT NULL,
	"duration_seconds" integer NOT NULL,
	"aspect_ratio" "video_aspect_ratio" NOT NULL,
	"post_qa_mode" "post_qa_mode" DEFAULT 'standard' NOT NULL,
	"post_qa_required" text DEFAULT 'true' NOT NULL,
	"post_qa_reason" text,
	"credit_cost" integer DEFAULT 0 NOT NULL,
	"reserved_ledger_id" uuid,
	"final_video_key" text,
	"cover_key" text,
	"failure_reason" text,
	"is_test" boolean DEFAULT false NOT NULL,
	"locked_by" text,
	"locked_until" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_retry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "video_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_job_id" uuid NOT NULL,
	"storyboard_id" uuid,
	"segment_index" integer NOT NULL,
	"status" "segment_status" DEFAULT 'queued' NOT NULL,
	"template_id" text NOT NULL,
	"prompt" text NOT NULL,
	"input_asset_snapshot" jsonb NOT NULL,
	"provider" text,
	"model" text,
	"provider_task_id" text,
	"provider_call_log_id" uuid,
	"video_key" text,
	"cost_estimate" numeric(12, 6) DEFAULT '0' NOT NULL,
	"is_test" boolean DEFAULT false NOT NULL,
	"locked_by" text,
	"locked_until" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_retry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"status" "provider_status" DEFAULT 'paused' NOT NULL,
	"base_url" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "model_providers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "model_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purpose" "provider_purpose" NOT NULL,
	"environment" text DEFAULT 'development' NOT NULL,
	"primary_provider_id" uuid,
	"primary_model" text NOT NULL,
	"fallback_provider_id" uuid,
	"fallback_model" text,
	"status" "provider_status" DEFAULT 'paused' NOT NULL,
	"min_margin_percent" integer DEFAULT 45 NOT NULL,
	"allow_public_fallback" text DEFAULT 'false' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_moderation_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"video_job_id" uuid,
	"segment_id" uuid,
	"source" text NOT NULL,
	"prompt_hash" text NOT NULL,
	"prompt_summary" text,
	"external_id" text,
	"moderation_id" text,
	"decision" "moderation_decision" NOT NULL,
	"error_code" text,
	"error_message" text,
	"latency_ms" integer,
	"provider_call_log_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_call_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_key_id" uuid,
	"model" text NOT NULL,
	"purpose" "provider_purpose" NOT NULL,
	"user_id" uuid,
	"video_job_id" uuid,
	"segment_id" uuid,
	"request_snapshot" jsonb NOT NULL,
	"response_summary" jsonb,
	"cost_estimate" numeric(12, 6) DEFAULT '0' NOT NULL,
	"duration_ms" integer,
	"status" "provider_call_status" DEFAULT 'queued' NOT NULL,
	"fallback_reason" text,
	"provider_task_id" text,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"label" text NOT NULL,
	"environment" text DEFAULT 'development' NOT NULL,
	"status" "provider_status" DEFAULT 'paused' NOT NULL,
	"encrypted_key" text NOT NULL,
	"key_preview" text NOT NULL,
	"daily_cost_limit" numeric(12, 6) DEFAULT '0' NOT NULL,
	"current_daily_cost" numeric(12, 6) DEFAULT '0' NOT NULL,
	"concurrent_limit" integer DEFAULT 1 NOT NULL,
	"current_concurrency" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shot_template_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shot_template_id" uuid NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"post_qa_pass_count" integer DEFAULT 0 NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"refund_count" integer DEFAULT 0 NOT NULL,
	"average_cost" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shot_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "shot_template_status" DEFAULT 'draft' NOT NULL,
	"risk_level" "shot_template_risk" NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"required_assets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blocked_conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allowed_motion" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"base_prompt_intent" text NOT NULL,
	"system_constraints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"post_qa_checks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_trial_allowed" boolean DEFAULT false NOT NULL,
	"requires_strict_review" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "admin_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "admin_role" NOT NULL,
	"granted_by" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"display_name" text,
	"company_name" text,
	"country" text,
	"free_trial_granted_at" timestamp with time zone,
	"free_trial_source" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
