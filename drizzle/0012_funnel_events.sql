CREATE TABLE IF NOT EXISTS "funnel_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text,
  "anonymous_id" text,
  "session_id" text,
  "event_name" text NOT NULL,
  "source" text NOT NULL,
  "path" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "funnel_events_created_at_idx"
ON "funnel_events" ("created_at");

CREATE INDEX IF NOT EXISTS "funnel_events_event_name_idx"
ON "funnel_events" ("event_name");

CREATE INDEX IF NOT EXISTS "funnel_events_user_id_idx"
ON "funnel_events" ("user_id");

CREATE INDEX IF NOT EXISTS "funnel_events_anonymous_id_idx"
ON "funnel_events" ("anonymous_id");
