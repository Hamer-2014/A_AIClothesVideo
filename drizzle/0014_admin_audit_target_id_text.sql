ALTER TABLE "admin_audit_logs"
ALTER COLUMN "target_id" TYPE text USING "target_id"::text;
