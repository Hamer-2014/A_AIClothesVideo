ALTER TABLE "auth_email_events"
ALTER COLUMN "user_id" TYPE text USING "user_id"::text;

ALTER TABLE "assets"
ALTER COLUMN "user_id" TYPE text USING "user_id"::text;

ALTER TABLE "admin_audit_logs"
ALTER COLUMN "admin_user_id" TYPE text USING "admin_user_id"::text;

ALTER TABLE "abuse_events"
ALTER COLUMN "user_id" TYPE text USING "user_id"::text;

ALTER TABLE "credit_wallets"
ALTER COLUMN "user_id" TYPE text USING "user_id"::text;

ALTER TABLE "credit_ledger"
ALTER COLUMN "user_id" TYPE text USING "user_id"::text;

ALTER TABLE "orders"
ALTER COLUMN "user_id" TYPE text USING "user_id"::text;

ALTER TABLE "video_jobs"
ALTER COLUMN "user_id" TYPE text USING "user_id"::text;

ALTER TABLE "job_state_events"
ALTER COLUMN "actor_id" TYPE text USING "actor_id"::text;

ALTER TABLE "provider_call_logs"
ALTER COLUMN "user_id" TYPE text USING "user_id"::text;

ALTER TABLE "prompt_moderation_results"
ALTER COLUMN "user_id" TYPE text USING "user_id"::text;

ALTER TABLE "user_profiles"
ALTER COLUMN "user_id" TYPE text USING "user_id"::text;

ALTER TABLE "admin_roles"
ALTER COLUMN "user_id" TYPE text USING "user_id"::text;

ALTER TABLE "admin_roles"
ALTER COLUMN "granted_by" TYPE text USING "granted_by"::text;
