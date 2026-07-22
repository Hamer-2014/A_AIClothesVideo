ALTER TYPE "public"."auth_email_event_status" ADD VALUE IF NOT EXISTS 'pending' BEFORE 'sent';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_email_events_email_created_at_idx" ON "auth_email_events" USING btree ("email", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_email_events_ip_created_at_idx" ON "auth_email_events" USING btree ("ip_address", "created_at");
