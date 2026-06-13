CREATE TABLE "trial_abuse_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"video_job_id" uuid,
	"email_hash" text,
	"oauth_provider" text,
	"oauth_account_id_hash" text,
	"ip_hash" text,
	"device_fingerprint_hash" text,
	"user_agent_hash" text,
	"event_type" text NOT NULL,
	"decision" text NOT NULL,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"reason_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
