CREATE TABLE IF NOT EXISTS "admin_job_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL,
  "admin_user_id" text NOT NULL,
  "note" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "admin_job_notes_job_id_idx"
ON "admin_job_notes" ("job_id");
